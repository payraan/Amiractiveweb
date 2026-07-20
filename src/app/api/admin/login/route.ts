import { NextResponse } from "next/server";
import { checkAdminPassword, signAdmin, ADMIN_COOKIE, ADMIN_MAX_AGE } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ok = await checkAdminPassword((body.password ?? "").trim());
  if (!ok) {
    return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
  }

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
