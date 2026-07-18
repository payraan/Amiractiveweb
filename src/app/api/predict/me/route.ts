import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) return NextResponse.json({ ok: true, player: null });

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, display_name, total_points, streak FROM players WHERE id=$1`,
    [playerId]
  );
  if (!rows.length) return NextResponse.json({ ok: true, player: null });

  // which assets has this player already predicted in the current open round?
  const preds = await pool.query(
    `SELECT r.asset
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1 AND r.status = 'open'`,
    [playerId]
  );

  return NextResponse.json({
    ok: true,
    player: {
      id: rows[0].id,
      displayName: rows[0].display_name,
      totalPoints: rows[0].total_points,
      streak: rows[0].streak,
    },
    predicted: preds.rows.map((r) => r.asset),
  });
}
