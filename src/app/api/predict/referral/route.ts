import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import {
  getReferralStats,
  REFERRAL_PERCENT,
  REFERRAL_BONUS,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({
      ok: true,
      authed: false,
      percent: REFERRAL_PERCENT,
      bonus: REFERRAL_BONUS,
      stats: null,
    });
  }
  const stats = await getReferralStats(playerId);
  return NextResponse.json({
    ok: true,
    authed: true,
    percent: REFERRAL_PERCENT,
    bonus: REFERRAL_BONUS,
    stats,
  });
}
