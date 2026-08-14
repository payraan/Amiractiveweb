import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import { loadProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

// داده‌ی پنل کاربری در `src/lib/profile.ts` است، نه اینجا: ربات هم همان را
// می‌خواند و نباید کوئری موازی خودش را داشته باشد.
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const data = await loadProfile(playerId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...data });
}
