import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { createLinkCode, getTgStatus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: true, authed: false, status: null });
  }
  const status = await getTgStatus(playerId);
  return NextResponse.json({ ok: true, authed: true, status });
}

export async function POST() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const { deepLink } = await createLinkCode(playerId);
  return NextResponse.json({ ok: true, deepLink });
}
