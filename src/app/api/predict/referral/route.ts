import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import {
  getReferralStats,
  REFERRAL_PERCENT,
  REFERRAL_BONUS,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
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
