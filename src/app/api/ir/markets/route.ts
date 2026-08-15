import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import {
  ensureIrTables,
  oddsFor,
  impliedPct,
  MIN_STAKE_USDT,
  COMMISSION,
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
            p.display_name AS creator
       FROM ir_markets m
       LEFT JOIN players p ON p.id = m.creator_id
      WHERE m.status IN ('open','locked','settling')
        ${cat && cat !== "all" ? "AND m.category = $1" : ""}
      ORDER BY (m.yes_total + m.no_total) DESC, m.closes_at ASC
      LIMIT 100`,
    cat && cat !== "all" ? [cat] : []
  );

  const markets = rows.map((r) => {
    const yes = Number(r.yes_total);
    const no = Number(r.no_total);
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
      yesPct: impliedPct(yes, no),
      yesOdds: Math.round(oddsFor(yes, no, "yes") * 100) / 100,
      noOdds: Math.round(oddsFor(yes, no, "no") * 100) / 100,
    };
  });

  const playerId = await currentPlayerId();
  let balance = 0;
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
        "SELECT usdt_balance + demo_balance AS spendable FROM players WHERE id=$1",
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
    },
  });
}
