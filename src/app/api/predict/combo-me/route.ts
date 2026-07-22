import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensureComboTables, COMBO_FREE_PER_DAY } from "@/lib/combos";

export const dynamic = "force-dynamic";

type LegRow = {
  ticket_id: number;
  market_id: string;
  question: string;
  choice: string;
  prob: string;
  result: string | null;
};

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) return NextResponse.json({ ok: true, tickets: [], freeLeft: 0 });

  await ensureComboTables();
  const pool = await db();

  const [tk, cnt] = await Promise.all([
    pool.query(
      `SELECT id, prob, legs_count, charged, points, status, created_at
         FROM combo_tickets
        WHERE player_id=$1
        ORDER BY created_at DESC
        LIMIT 15`,
      [playerId]
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM combo_tickets
        WHERE player_id=$1
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date
            = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [playerId]
    ),
  ]);

  const ids = tk.rows.map((r) => r.id);
  let legsByTicket = new Map<number, LegRow[]>();
  if (ids.length) {
    const legs = await pool.query<LegRow>(
      `SELECT ticket_id, market_id, question, choice, prob, result
         FROM combo_legs
        WHERE ticket_id = ANY($1::int[])
        ORDER BY id ASC`,
      [ids]
    );
    legsByTicket = legs.rows.reduce((map, l) => {
      const arr = map.get(l.ticket_id) ?? [];
      arr.push(l);
      map.set(l.ticket_id, arr);
      return map;
    }, new Map<number, LegRow[]>());
  }

  return NextResponse.json({
    ok: true,
    freeLeft: Math.max(0, COMBO_FREE_PER_DAY - cnt.rows[0].n),
    tickets: tk.rows.map((t) => ({
      id: t.id,
      probPct: Math.round(Number(t.prob) * 1000) / 10,
      legsCount: t.legs_count,
      charged: t.charged,
      points: t.points,
      status: t.status,
      legs: (legsByTicket.get(t.id) ?? []).map((l) => ({
        marketId: l.market_id,
        question: l.question,
        choice: l.choice,
        probPct: Math.round(Number(l.prob) * 100),
        result: l.result,
      })),
    })),
  });
}
