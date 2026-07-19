import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Ranking windows. Points are summed from settled predictions in the window.
// Only display_name is ever exposed — tg_username stays private.
const WINDOWS: Record<string, string> = {
  daily: "1 day",
  weekly: "7 days",
  monthly: "30 days",
  all: "",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "monthly";
  const window = WINDOWS[range] ?? WINDOWS.monthly;

  const pool = await db();

  const where =
    range === "all"
      ? "r.status = 'settled'"
      : `r.status = 'settled' AND r.settle_at >= now() - interval '${window}'`;

  const { rows } = await pool.query(
    `SELECT pl.display_name,
            COALESCE(SUM(p.points), 0)::int AS points,
            COUNT(p.id)::int AS plays
       FROM predictions p
       JOIN rounds r  ON r.id = p.round_id
       JOIN players pl ON pl.id = p.player_id
      WHERE ${where}
      GROUP BY pl.id, pl.display_name
      HAVING COUNT(p.id) > 0
      ORDER BY points DESC, plays ASC
      LIMIT 50`
  );

  return NextResponse.json({
    ok: true,
    range,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      points: r.points,
      plays: r.plays,
    })),
  });
}
