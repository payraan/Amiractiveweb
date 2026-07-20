import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { normalizeUsername } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const username = normalizeUsername(searchParams.get("username") ?? "");
  if (!username) return NextResponse.json({ ok: false, error: "bad_username" }, { status: 400 });

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT tg_username, display_name, credits, total_points, streak, created_at
       FROM players WHERE tg_username=$1`,
    [username]
  );
  if (!rows.length) return NextResponse.json({ ok: false, error: "player_not_found" }, { status: 404 });

  const p = rows[0];
  return NextResponse.json({
    ok: true,
    player: {
      username: p.tg_username,
      displayName: p.display_name,
      credits: p.credits,
      totalPoints: p.total_points,
      streak: p.streak,
      createdAt: p.created_at,
    },
  });
}
