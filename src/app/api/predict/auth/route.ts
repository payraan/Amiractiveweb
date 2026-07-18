import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, normalizeUsername } from "@/lib/auth";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export const dynamic = "force-dynamic";

type Body = {
  mode?: "register" | "login";
  username?: string;
  password?: string;
  displayName?: string;
};

function setCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const mode = body.mode;
  const username = normalizeUsername(body.username ?? "");
  const password = (body.password ?? "").trim();

  if (!username || username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ ok: false, error: "bad_username" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  const pool = await db();

  if (mode === "register") {
    const displayName = (body.displayName ?? "").trim().slice(0, 40) || username;
    const existing = await pool.query("SELECT id FROM players WHERE tg_username=$1", [
      username,
    ]);
    if (existing.rowCount) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }
    const password_hash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO players (tg_username, display_name, password_hash)
       VALUES ($1, $2, $3) RETURNING id, display_name`,
      [username, displayName, password_hash]
    );
    const res = NextResponse.json({
      ok: true,
      player: { id: rows[0].id, displayName: rows[0].display_name },
    });
    setCookie(res, signSession(rows[0].id));
    return res;
  }

  if (mode === "login") {
    const { rows } = await pool.query(
      "SELECT id, display_name, password_hash FROM players WHERE tg_username=$1",
      [username]
    );
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const okPass = await verifyPassword(password, rows[0].password_hash);
    if (!okPass) {
      return NextResponse.json({ ok: false, error: "bad_credentials" }, { status: 401 });
    }
    const res = NextResponse.json({
      ok: true,
      player: { id: rows[0].id, displayName: rows[0].display_name },
    });
    setCookie(res, signSession(rows[0].id));
    return res;
  }

  return NextResponse.json({ ok: false, error: "bad_mode" }, { status: 400 });
}
