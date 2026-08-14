import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { ensureIrTables, moveFunds, recordRevenue } from "@/lib/iran";
import { creditPack } from "@/lib/game";
import { payReferralCommission } from "@/lib/referral";

export const dynamic = "force-dynamic";

/**
 * خرید MOON مستقیم از موجودی تتر کیف پول.
 *
 * جایگزین مسیر قبلی (هدایت به تلگرام و شارژ دستی). حالا که کیف پول داخلی
 * داریم، خرید باید همان‌جا و آنی تمام شود.
 *
 * دو نکته‌ی امنیتی:
 *  ۱. قیمت هرگز از کلاینت خوانده نمی‌شود؛ فقط شناسه‌ی بسته می‌آید و قیمت از
 *     game.ts خوانده می‌شود. وگرنه کاربر می‌توانست priceUsdt=0 بفرستد.
 *  ۲. کسر تتر و افزودن MOON در یک ترنزاکشن با قفل ردیف بازیکن انجام می‌شود،
 *     پس دو درخواست همزمان نمی‌توانند یک موجودی را دوبار خرج کنند.
 */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;

  let body: { packId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const pack = creditPack(String(body.packId ?? ""));
  if (!pack) {
    return NextResponse.json({ ok: false, error: "bad_pack" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pl = await client.query(
      "SELECT usdt_balance, credits FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }
    if (Number(pl.rows[0].usdt_balance) < pack.priceUsdt) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_funds",
          need: pack.priceUsdt,
          have: Number(pl.rows[0].usdt_balance),
        },
        { status: 402 }
      );
    }

    const paid = await moveFunds(
      client,
      playerId,
      -pack.priceUsdt,
      "credit_purchase",
      `${pack.credits} MOON`
    );
    const upd = await client.query(
      "UPDATE players SET credits = credits + $1 WHERE id=$2 RETURNING credits",
      [pack.credits, playerId]
    );
    // فروش MOON درآمد پلتفرم است و باید در دفترکل دیده شود
    await recordRevenue(client, "credit_sale", pack.priceUsdt, {
      playerId,
      note: `${pack.credits} MOON`,
      demoAmount: paid.demoPart,
    });

    await client.query("COMMIT");

    // پورسانت معرف — خطایش نباید خرید انجام‌شده را خراب کند
    let commission = 0;
    try {
      const r = await payReferralCommission(playerId, pack.credits);
      commission = r.paid;
    } catch {
      commission = 0;
    }

    return NextResponse.json({
      ok: true,
      credits: upd.rows[0].credits,
      spent: pack.priceUsdt,
      gained: pack.credits,
      referralCommission: commission,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json(
      { ok: false, error: msg === "insufficient_funds" ? msg : "server_error" },
      { status: msg === "insufficient_funds" ? 402 : 500 }
    );
  } finally {
    client.release();
  }
}
