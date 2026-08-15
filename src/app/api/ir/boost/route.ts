import { log } from "@/lib/log";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { broadcastBoostedMarket } from "@/lib/boost-broadcast";
import { isTgAdmin } from "@/lib/broadcast";
import {
  ensureIrTables,
  moveFunds,
  recordRevenue,
  BOOST_PRICE_USDT,
  BOOST_HOURS,
} from "@/lib/iran";

export const dynamic = "force-dynamic";

// ── خرید بوست ────────────────────────────────────────────────
//
// بوست فقط **دیده‌شدن** می‌خرد: بازار به پنل طلایی می‌آید و یک بار به
// کاربران اطلاع داده می‌شود. هیچ اثری بر ضریب، تسویه یا شانس برد ندارد.
// این مرز حیاتی است — لحظه‌ای که پول بتواند نتیجه را عوض کند، تز محصول
// («امتیاز و برد خریدنی نیست») شکسته است.
//
// ⚠️ پرداخت **فقط از پول واقعی**. برخلاف بقیه‌ی خرج‌ها که اول از بونوس
// برداشته می‌شوند، اینجا `realOnly` است: بوست قرار است درآمد باشد، و
// درآمدی که از پول هدیه‌ی خودمان بیاید درآمد نیست.

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;

  let body: { marketId?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const marketId = Number(body.marketId);
  if (!Number.isInteger(marketId) || marketId <= 0) {
    return NextResponse.json({ ok: false, error: "bad_market" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ ترتیب قفل سراسری: **اول بازار، بعد بازیکن**. برعکسش بن‌بست ABBA
    // می‌سازد، چون تسویه هم همین دو را به همین ترتیب قفل می‌کند.
    const m = await client.query<{
      creator_id: number | null;
      status: string;
      boosted_until: string | null;
    }>(
      "SELECT creator_id, status, boosted_until FROM ir_markets WHERE id=$1 FOR UPDATE",
      [marketId]
    );
    if (!m.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const mk = m.rows[0];

    // فقط بازار باز. بوستِ بازارِ بسته یعنی پول گرفتن بابت چیزی که کسی
    // نمی‌تواند رویش پیش‌بینی کند.
    if (mk.status !== "open") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "market_not_open" },
        { status: 409 }
      );
    }
    // فقط سازنده. بوست کردنِ بازار دیگری یعنی می‌شود بازار رقیب را هم
    // بالا آورد یا با پول به کسی تبلیغ ناخواسته چسباند.
    if (mk.creator_id !== playerId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_creator" }, { status: 403 });
    }

    const now = Date.now();
    const activeUntil = mk.boosted_until ? new Date(mk.boosted_until).getTime() : 0;
    // بوست روی بوست تمدید می‌شود، نه اینکه از نو شروع شود — کسی که دو بار
    // پرداخت کرده باید دو برابر زمان بگیرد.
    const base = activeUntil > now ? activeUntil : now;
    const until = new Date(base + BOOST_HOURS * 3600_000);

    const pl = await client.query<{ tg_user_id: string | null }>(
      "SELECT tg_user_id FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    const tgId = Number(pl.rows[0]?.tg_user_id ?? 0);

    // ادمین پلتفرم رایگان بوست می‌کند — همان قاعده‌ی کارمزد ساخت بازار.
    // در ماه‌های اول، بازارساز و بوست‌کننده‌ی اصلی خودِ گرداننده است؛
    // گرفتن پول از او فقط پول را از یک جیب به جیب دیگر می‌برد و دفترکل
    // درآمد را با درآمدی که وجود ندارد آلوده می‌کند.
    const price = tgId && isTgAdmin(tgId) ? 0 : BOOST_PRICE_USDT;

    if (price > 0) {
      // realOnly: بونوس اینجا لمس نمی‌شود.
      try {
        await moveFunds(client, playerId, -price, "ir_boost", `m${marketId}`, {
          realOnly: true,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        const msg = err instanceof Error ? err.message : "server_error";
        return NextResponse.json(
          { ok: false, error: msg === "insufficient_funds" ? msg : "server_error" },
          { status: msg === "insufficient_funds" ? 402 : 500 }
        );
      }
      // demoAmount صفر است چون realOnly بود — این تنها درآمدی است که
      // همیشه صددرصد واقعی است.
      await recordRevenue(client, "ir_boost", price, {
        marketId,
        playerId,
        demoAmount: 0,
      });
    }

    await client.query(
      `UPDATE ir_markets
          SET boosted_until=$2, boost_paid = boost_paid + $3
        WHERE id=$1`,
      [marketId, until.toISOString(), price]
    );

    await client.query("COMMIT");

    log.info("boost.purchased", {
      marketId,
      playerId,
      paid: price,
      until: until.toISOString(),
    });

    // ── پخش سراسری، **بیرون** از ترنزاکشن و best-effort ──────
    //
    // اگر ساختن کار پخش شکست بخورد، پرداخت نباید برگردد: بوست خریداری شده
    // و پنل طلایی — که اصل قابلیت است — همین حالا فعال است. برعکسش یعنی
    // یک خطای تلگرام، یک پرداخت موفق را باطل می‌کند.
    //
    // نتیجه در پاسخ برمی‌گردد تا اگر پخش نشد، ساکت نماند.
    let broadcast: { queued: boolean; targets?: number; error?: string } = {
      queued: false,
    };
    try {
      const b = await broadcastBoostedMarket(marketId, tgId);
      broadcast = b.ok
        ? { queued: true, targets: b.targets }
        : { queued: false, error: b.error };
      if (!b.ok) {
        log.warn("boost.broadcast_failed", { marketId, err: b.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      broadcast = { queued: false, error: msg };
      log.error("boost.broadcast_error", { marketId, err: msg });
    }

    return NextResponse.json({
      ok: true,
      boostedUntil: until.toISOString(),
      paid: price,
      broadcast,
    });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
