import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensurePolyTables, POLY_FREE_PER_DAY } from "@/lib/poly";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) return NextResponse.json({ ok: true, predictions: [], freeLeft: 0 });

  await ensurePolyTables();
  const pool = await db();

  const [preds, cnt] = await Promise.all([
    pool.query(
      `SELECT market_id, question, choice, prob, points, status, created_at
         FROM poly_predictions
        WHERE player_id=$1
        ORDER BY created_at DESC
        LIMIT 20`,
      [playerId]
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM poly_predictions
        WHERE player_id=$1
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date
            = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [playerId]
    ),
  ]);

  return NextResponse.json({
    ok: true,
    freeLeft: Math.max(0, POLY_FREE_PER_DAY - cnt.rows[0].n),
    predictions: preds.rows.map((r) => ({
      marketId: r.market_id,
      question: r.question,
      choice: r.choice,
      probPct: Math.round(Number(r.prob) * 100),
      points: r.points,
      status: r.status,
    })),
  });
}
