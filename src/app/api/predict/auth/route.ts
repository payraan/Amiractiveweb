import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, normalizeUsername } from "@/lib/auth";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { WELCOME_CREDITS } from "@/lib/game";
import { attachReferral } from "@/lib/referral";

export const dynamic = "force-dynamic";

type Body = {
  mode?: "register" | "login";
  username?: string;
  password?: string;
  displayName?: string;
  ref?: string;
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
  // رمز عبور: حداقل ۸ کاراکتر و ترکیبی از حرف و عدد.
  // حساب‌ها کردیت خریداری‌شده نگه می‌دارند، پس سخت‌گیری اینجا لازم است.
  const strongEnough =
    password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  if (mode === "register" && !strongEnough) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
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
      `INSERT INTO players (tg_username, display_name, password_hash, credits)
       VALUES ($1, $2, $3, $4) RETURNING id, display_name, credits`,
      [username, displayName, password_hash, WELCOME_CREDITS]
    );

    // اتصال به دعوت‌کننده (در صورت وجود کد معتبر)
    let credits = rows[0].credits;
    if (body.ref) {
      try {
        const linked = await attachReferral(rows[0].id, body.ref);
        if (linked) {
          const fresh = await pool.query("SELECT credits FROM players WHERE id=$1", [
            rows[0].id,
          ]);
          credits = fresh.rows[0]?.credits ?? credits;
        }
      } catch {
        /* ثبت‌نام نباید به‌خاطر کد دعوت شکست بخورد */
      }
    }

    const res = NextResponse.json({
      ok: true,
      player: { id: rows[0].id, displayName: rows[0].display_name, credits },
    });
    setCookie(res, signSession(rows[0].id));
    return res;
  }

  if (mode === "login") {
    const { rows } = await pool.query(
      "SELECT id, display_name, password_hash, credits FROM players WHERE tg_username=$1",
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
      player: { id: rows[0].id, displayName: rows[0].display_name, credits: rows[0].credits },
    });
    setCookie(res, signSession(rows[0].id));
    return res;
  }

  return NextResponse.json({ ok: false, error: "bad_mode" }, { status: 400 });
}
