import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
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

  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  let balance = 0;
  const myBets: Record<number, { side: string; stake: number }> = {};
  if (playerId) {
    const [b, mine] = await Promise.all([
      pool.query("SELECT usdt_balance FROM players WHERE id=$1", [playerId]),
      pool.query(
        `SELECT market_id, side, SUM(stake)::float AS stake
           FROM ir_bets WHERE player_id=$1 AND status='open'
          GROUP BY market_id, side`,
        [playerId]
      ),
    ]);
    balance = Number(b.rows[0]?.usdt_balance ?? 0);
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
