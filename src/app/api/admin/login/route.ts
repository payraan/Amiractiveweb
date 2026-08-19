import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { checkAdminPassword, signAdmin, ADMIN_COOKIE, ADMIN_MAX_AGE } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ok = await checkAdminPassword((body.password ?? "").trim());
  if (!ok) {
    // ⚠️ پنل ادمین می‌تواند موجودی شارژ کند و بازار را تسویه کند. هر تلاش
    // ناموفق باید دیده شود — این حساس‌ترین در پلتفرم است.
    log.warn("admin.login_failed", { ip });
    return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
  }
  log.warn("admin.login", { ip });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, signAdmin(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
