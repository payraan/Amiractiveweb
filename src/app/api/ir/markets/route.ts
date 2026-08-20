import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { isTgAdmin } from "@/lib/broadcast";
import {
  ensureIrTables,
  oddsFor,
  impliedPct,
  MIN_STAKE_USDT,
  COMMISSION,
  BOOST_PRICE_USDT,
  BOOST_HOURS,
} from "@/lib/iran";

export const dynamic = "force-dynamic";

/** فهرست بازارهای ایران — باز و در حال تسویه */
export async function GET(req: Request) {
  await ensureIrTables();
  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("category");
  const pool = await db();

  const { rows } = await pool.query(
    `SELECT m.id, m.question, m.category, m.source_note, m.closes_at,
            m.status, m.outcome, m.yes_total, m.no_total, m.bettors,
            m.boosted_until, m.cover_file_id, m.creator_id, m.creator_cut, m.early_cut,
            p.display_name AS creator
       FROM ir_markets m
       LEFT JOIN players p ON p.id = m.creator_id
      WHERE m.status IN ('open','locked','settling')
        ${cat && cat !== "all" ? "AND m.category = $1" : ""}
      ORDER BY (m.yes_total + m.no_total) DESC, m.closes_at ASC
      LIMIT 100`,
    cat && cat !== "all" ? [cat] : []
  );

  const playerIdEarly = await currentPlayerId();

  const markets = rows.map((r) => {
    const yes = Number(r.yes_total);
    const no = Number(r.no_total);
    // سازنده‌ی حذف‌شده سهمی ندارد؛ همان قاعده‌ی تسویه.
    const cut = r.creator_id === null ? 0 : Number(r.creator_cut);
    // سهم نفرات اول برخلاف سهم سازنده به وجودِ سازنده وابسته نیست.
    const early = Number(r.early_cut ?? 0);
    return {
      id: r.id,
      question: r.question,
      category: r.category,
      sourceNote: r.source_note,
      closesAt: r.closes_at,
      status: r.status,
      outcome: r.outcome,
      creator: r.creator,
      yesTotal: yes,
      noTotal: no,
      volume: yes + no,
      bettors: r.bettors,
      // بوست فقط دیده‌شدن است. عمدا **تاریخ انقضا** بیرون می‌رود و نه یک
      // بولین: کلاینت خودش با زمان جاری می‌سنجد، پس بازارِ منقضی‌شده حتی
      // بدون یک درخواست تازه هم از پنل طلایی می‌افتد.
      boostedUntil: r.boosted_until,
      hasCover: Boolean(r.cover_file_id),
      // بوست فقط کار سازنده است، پس رابط باید بداند این بازار مال کیست.
      // شناسه‌ی سازنده عمدا بیرون نمی‌رود — فقط همین بولین.
      isMine: playerIdEarly !== null && r.creator_id === playerIdEarly,
      yesPct: impliedPct(yes, no),
      // ⚠️ سهم سازنده حتما پاس داده می‌شود، وگرنه ضریبِ نمایش‌داده‌شده از
      // چیزی که تسویه می‌پردازد بالاتر است.
      yesOdds: Math.round(oddsFor(yes, no, "yes", cut, early) * 100) / 100,
      noOdds: Math.round(oddsFor(yes, no, "no", cut, early) * 100) / 100,
    };
  });

  const playerId = playerIdEarly;
  let balance = 0;
  let boostPriceFor = BOOST_PRICE_USDT;
  let canCover = false;
  const myBets: Record<number, { side: string; stake: number }> = {};
  if (playerId) {
    const [b, mine] = await Promise.all([
      // ⚠️ **مجموع واقعی و دمو**، نه فقط واقعی.
      //
      // خرجِ پیش‌بینی از `moveFunds` بدون `realOnly` می‌گذرد، یعنی اول از
      // دمو برداشته می‌شود و سقفِ واقعیِ خرج، مجموع این دو است. وقتی اینجا
      // فقط `usdt_balance` برمی‌گشت، کاربری که تنها پول هدیه داشت در فرم
      // «موجودی: $0.00» می‌دید، دکمه‌های درصدی‌اش قفل بود و در مینی‌اپ اصلا
      // نمی‌توانست ثبت کند (`stake <= balance`) — یعنی هر کاربر تازه‌ای که
      // بونوس خوش‌آمد می‌گرفت، عملا از بازار ایران بیرون می‌ماند.
      //
      // قاعده: فرم باید همان عددی را نشان بدهد که سرور می‌پذیرد. «قابل
      // برداشت» عدد دیگری است و جایش کیف پول است، نه فرم پیش‌بینی.
      pool.query(
        "SELECT usdt_balance + demo_balance AS spendable, tg_user_id FROM players WHERE id=$1",
        [playerId]
      ),
      pool.query(
        `SELECT market_id, side, SUM(stake)::float AS stake
           FROM ir_bets WHERE player_id=$1 AND status='open'
          GROUP BY market_id, side`,
        [playerId]
      ),
    ]);
    balance = Number(b.rows[0]?.spendable ?? 0);
    // ادمین پلتفرم رایگان بوست می‌کند. رابط باید همان عددی را نشان بدهد که
    // سرور می‌گیرد، وگرنه ادمین «۵ تتر» می‌بیند و صفر پرداخت می‌کند —
    // همان ناسازگاری فرم و سرور که یک بار در برداشت دیدیم.
    const tgId = Number(b.rows[0]?.tg_user_id ?? 0);
    if (tgId && isTgAdmin(tgId)) {
      boostPriceFor = 0;
      // کاور فقط برای ادمین — رابط نباید دکمه‌ای نشان بدهد که سرور ردش
      // می‌کند. دکمه‌ی کارنکن بدتر از نبودن دکمه است.
      canCover = true;
    }
    for (const r of mine.rows) {
      myBets[r.market_id] = { side: r.side, stake: Number(r.stake) };
    }
  }

  return NextResponse.json({
    ok: true,
    markets,
    balance,
    myBets,
    config: {
      minStake: MIN_STAKE_USDT,
      commission: COMMISSION,
      // قیمت بوستِ **همین کاربر** — برای ادمین صفر است. رابط نباید عدد
      // ثابت نشان بدهد و بعد سرور چیز دیگری بگیرد.
      boostPrice: boostPriceFor,
      boostHours: BOOST_HOURS,
      // ⚠️ لینک عمیقِ کاور را **سرور** می‌سازد چون نام ربات فقط اینجاست.
      // پیش از این فقط در پیام موفقیتِ ساخت بازار برمی‌گشت، یعنی سازنده‌ای
      // که از آن صفحه رد شده بود، هیچ راهی برای گذاشتن کاور نداشت.
      botUsername: (process.env.TG_BOT_USERNAME ?? "").replace(/^@/, ""),
      canCover,
    },
  });
}
