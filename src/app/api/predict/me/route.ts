import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { TIMEFRAMES } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) return NextResponse.json({ ok: true, player: null });

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, display_name, total_points, streak, credits FROM players WHERE id=$1`,
    [playerId]
  );
  if (!rows.length) return NextResponse.json({ ok: true, player: null });

  // predictions in currently-open rounds → which (asset,timeframe) are locked
  const preds = await pool.query(
    `SELECT r.asset, r.timeframe
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1 AND r.close_at > now()`,
    [playerId]
  );

  // free predictions used today per timeframe (Tehran day)
  const freeUsed = await pool.query(
    `SELECT timeframe, count(*)::int AS n
       FROM predictions
      WHERE player_id=$1 AND charged=0
        AND (created_at AT TIME ZONE 'Asia/Tehran')::date
          = (now() AT TIME ZONE 'Asia/Tehran')::date
      GROUP BY timeframe`,
    [playerId]
  );
  const usedMap: Record<string, number> = {};
  for (const r of freeUsed.rows) usedMap[r.timeframe] = r.n;

  const freeRemaining: Record<string, number> = {};
  for (const t of TIMEFRAMES) {
    freeRemaining[t.id] = Math.max(0, t.freeFirst - (usedMap[t.id] ?? 0));
  }

  // recent settled results for this player (last 8)
  const results = await pool.query(
    `SELECT r.asset, p.timeframe, p.guess, r.settle_price, p.error_pct, p.points, r.settle_at
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1 AND r.status = 'settled'
      ORDER BY r.settle_at DESC
      LIMIT 8`,
    [playerId]
  );

  return NextResponse.json({
    ok: true,
    player: {
      id: rows[0].id,
      displayName: rows[0].display_name,
      totalPoints: rows[0].total_points,
      streak: rows[0].streak,
      credits: rows[0].credits,
    },
    predicted: preds.rows.map((r) => ({ asset: r.asset, timeframe: r.timeframe })),
    freeRemaining,
    results: results.rows.map((r) => ({
      asset: r.asset,
      timeframe: r.timeframe,
      guess: Number(r.guess),
      settlePrice: r.settle_price == null ? null : Number(r.settle_price),
      errorPct: r.error_pct == null ? null : Number(r.error_pct),
      points: r.points,
    })),
  });
}
