import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { db, touchActivity } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import {
  ensureIrTables,
  moveFunds,
  creatorRate,
  MIN_STAKE_USDT,
} from "@/lib/iran";
import { requireLinkedTelegram } from "@/lib/money-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;

  let body: { marketId?: number; side?: string; stake?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = Number(body.marketId);
  const side = body.side === "yes" || body.side === "no" ? body.side : null;
  const stake = Number(body.stake);

  if (!Number.isInteger(marketId) || !side) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!Number.isFinite(stake) || stake < MIN_STAKE_USDT) {
    return NextResponse.json({ ok: false, error: "stake_too_low" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ **ترتیب قفل: اول بازار، بعد بازیکن.** این ترتیب در کل کدبیس یکی
    // است و باید بماند.
    //
    // تسویه ناچار است اول بازار را قفل کند (تا وضعیتش عوض نشود) و بعد
    // برنده‌ها را. اگر اینجا برعکس بود — بازیکن اول، بازار بعد — دو مسیر
    // ترتیب معکوس داشتند و شرطِ هم‌زمان با تسویه به بن‌بست می‌خورد.
    // Postgres بن‌بست را می‌گیرد و یکی را می‌کشد، ولی آن یکی می‌تواند تسویه
    // باشد؛ یعنی پول برنده‌ها معلق می‌ماند.
    const m = await client.query(
      "SELECT status, closes_at, creator_id FROM ir_markets WHERE id=$1 FOR UPDATE",
      [marketId]
    );
    if (!m.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (m.rows[0].status !== "open") {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "market_closed" }, { status: 409 });
    }
    if (new Date(m.rows[0].closes_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "market_closed" }, { status: 409 });
    }

    const pl = await client.query(
      "SELECT usdt_balance, demo_balance, referred_by FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }
    // قدرت خرید = واقعی + دمو. پول دمو با پول واقعی شرط می‌بندد و همین
    // هدفش است؛ چیزی که ممنوع است برداشتِ آن است، نه خرج‌کردنش.
    const buyingPower =
      Number(pl.rows[0].usdt_balance) + Number(pl.rows[0].demo_balance);
    if (buyingPower < stake) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_funds" },
        { status: 402 }
      );
    }

    // moveFunds اول از دمو کم می‌کند و می‌گوید چقدرش دمو بود. همان عدد روی
    // خودِ شرط ثبت می‌شود، چون تسویه باید بداند اصلِ این پول از کجا آمده:
    // اصل به دمو برمی‌گردد و سود واقعی می‌شود.
    const spent = await moveFunds(client, playerId, -stake, "ir_bet", `m${marketId}`);

    // ── سهم سازنده ──────────────────────────────────────────
    //
    // نرخ **همین‌جا** تعیین و ذخیره می‌شود، نه در تسویه: «آیا این شرط‌بند را
    // سازنده آورده» واقعیتی در لحظه‌ی ثبت است. اگر در تسویه دوباره حساب
    // می‌شد، هر تغییری در رابطه‌ی دعوت، سهمِ شرط‌های گذشته را بازنویسی
    // می‌کرد.
    //
    // ⚠️ سازنده‌ی حذف‌شده (`creator_id IS NULL`) سهمی ندارد و آن مبلغ هم
    // برداشته نمی‌شود — یعنی به برنده‌ها می‌رسد، نه به پلتفرم. سهمی که
    // صاحب ندارد نباید بی‌صدا به درآمد تبدیل شود.
    const creatorId = m.rows[0].creator_id as number | null;
    const referredByCreator =
      creatorId !== null && Number(pl.rows[0].referred_by) === creatorId;
    const rate = creatorId === null ? 0 : creatorRate(referredByCreator);
    const cut = Math.round(stake * rate * 1e6) / 1e6;
    // سهم دمو به همان نسبتِ سهم دمو در خودِ شرط. بدون این، سهمی که از پول
    // هدیه آمده به پول واقعیِ قابل‌برداشت تبدیل می‌شد.
    const cutDemo = Math.round(spent.demoPart * rate * 1e6) / 1e6;

    // آیا این کاربر برای اولین بار روی این بازار شرط می‌بندد؟
    const prev = await client.query(
      "SELECT 1 FROM ir_bets WHERE market_id=$1 AND player_id=$2 LIMIT 1",
      [marketId, playerId]
    );

    await client.query(
      `INSERT INTO ir_bets (market_id, player_id, side, stake, demo_stake,
                            creator_cut, creator_cut_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [marketId, playerId, side, stake, spent.demoPart, cut, cutDemo]
    );
    await client.query(
      `UPDATE ir_markets
          SET yes_total = yes_total + $1,
              no_total  = no_total  + $2,
              bettors   = bettors   + $3,
              creator_cut = creator_cut + $5,
              creator_cut_demo = creator_cut_demo + $6
        WHERE id = $4`,
      [
        side === "yes" ? stake : 0,
        side === "no" ? stake : 0,
        prev.rowCount ? 0 : 1,
        marketId,
        cut,
        cutDemo,
      ]
    );

    // بدون این، شرط‌بندی در بازار ایران کاربر را فعال حساب نمی‌کرد و آمار
    // «کاربران فعال ۷ روز» همیشه صفر می‌ماند.
    await touchActivity(client, playerId);

    await client.query("COMMIT");
    // ⚠️ تنها بازیِ پلتفرم که پول واقعی جابه‌جا می‌کند. `demo` سهم بونوس
    // را جدا نگه می‌دارد، پس با `@evt:ir.bet` می‌شود گفت چقدر از حجم
    // بازارها پول واقعی بوده و چقدر هدیه‌ی خودمان.
    log.info("ir.bet", {
      playerId,
      marketId,
      side,
      stake,
      demo: spent.demoPart,
      firstOnMarket: !prev.rowCount,
      creatorCut: cut,
      referredByCreator,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "error";
    if (msg === "insufficient_funds") {
      log.info("ir.bet_rejected", { playerId, marketId, stake, reason: msg });
    } else {
      log.error("ir.bet_failed", { playerId, marketId, stake, err: msg });
    }
    return NextResponse.json(
      { ok: false, error: msg === "insufficient_funds" ? msg : "server_error" },
      { status: msg === "insufficient_funds" ? 402 : 500 }
    );
  } finally {
    client.release();
  }
}
