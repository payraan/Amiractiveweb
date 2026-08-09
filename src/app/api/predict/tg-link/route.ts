import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { botReady, createLinkCode, getTgStatus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: true, authed: false, status: null });
  }
  const status = await getTgStatus(playerId);
  // botReady به کلاینت می‌گوید کارت اتصال را اصلا نشان ندهد — تا وقتی ربات
  // ست نشده، دکمه‌ای که همیشه شکست می‌خورد بدتر از نبودنش است.
  return NextResponse.json({ ok: true, authed: true, status, botReady: botReady() });
}

export async function POST() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  if (!botReady()) {
    return NextResponse.json(
      { ok: false, error: "bot_not_configured" },
      { status: 503 }
    );
  }
  const { deepLink } = await createLinkCode(playerId);
  return NextResponse.json({ ok: true, deepLink });
}
