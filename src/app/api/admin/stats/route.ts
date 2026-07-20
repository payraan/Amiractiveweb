import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE, ensureTopupTable } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await ensureTopupTable();
  const pool = await db();

  const [overview, users, topups, credits] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*) FROM players)::int AS total_players,
         (SELECT count(*) FROM players WHERE last_played >= (now() AT TIME ZONE 'Asia/Tehran')::date - 7)::int AS active_players,
         (SELECT count(*) FROM predictions)::int AS total_predictions,
         (SELECT count(*) FROM predictions WHERE charged > 0)::int AS paid_predictions,
         (SELECT count(*) FROM rounds WHERE status='settled')::int AS settled_rounds`
    ),
    pool.query(
      `SELECT tg_username, display_name, credits, total_points, created_at,
              (SELECT count(*) FROM predictions p WHERE p.player_id = players.id)::int AS plays
         FROM players ORDER BY created_at DESC LIMIT 20`
    ),
    pool.query(
      `SELECT t.amount, t.note, t.created_at, pl.tg_username, pl.display_name
         FROM credit_topups t JOIN players pl ON pl.id = t.player_id
        ORDER BY t.created_at DESC LIMIT 20`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::int AS credits_sold,
         COALESCE(SUM(amount), 0)::int AS credits_net,
         count(*) FILTER (WHERE amount > 0)::int AS topup_count`
    ).then((r) => r).catch(() => ({ rows: [{ credits_sold: 0, credits_net: 0, topup_count: 0 }] })),
  ]);

  return NextResponse.json({
    ok: true,
    overview: overview.rows[0],
    sales: credits.rows[0],
    users: users.rows.map((u) => ({
      username: u.tg_username,
      displayName: u.display_name,
      credits: u.credits,
      totalPoints: u.total_points,
      plays: u.plays,
      createdAt: u.created_at,
    })),
    topups: topups.rows.map((t) => ({
      username: t.tg_username,
      displayName: t.display_name,
      amount: t.amount,
      note: t.note,
      createdAt: t.created_at,
    })),
  });
}
