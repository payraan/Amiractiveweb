import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { currentPlayerId } from "@/lib/current-player";
import { botReady, createLinkCode, getTgStatus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: true, authed: false, status: null });
  }
  const status = await getTgStatus(playerId);
  // botReady به کلاینت می‌گوید کارت اتصال را اصلا نشان ندهد — تا وقتی ربات
  // ست نشده، دکمه‌ای که همیشه شکست می‌خورد بدتر از نبودنش است.
  return NextResponse.json({ ok: true, authed: true, status, botReady: botReady() });
}

export async function POST() {
  const playerId = await currentPlayerId();
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
  // شروع اتصال. با `tg.linked` جفت می‌شود و نشان می‌دهد چند نفر لینک
  // گرفتند ولی هرگز تمامش نکردند — یعنی جایی از قیف اتصال می‌شکند.
  log.info("tg.link_started", { playerId });
  return NextResponse.json({ ok: true, deepLink });
}
