import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { CHALLENGES, getChallengeState, startChallenge } from "@/lib/challenge";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  const tiers = CHALLENGES.map((c) => ({
    id: c.id,
    label: c.label,
    fee: c.fee,
    target: c.target,
    maxDrawdown: c.maxDrawdown,
    dailyLoss: c.dailyLoss,
    minPreds: c.minPreds,
    days: c.days,
    prize: c.prize,
    popular: c.popular ?? false,
  }));
  if (!playerId) return NextResponse.json({ ok: true, authed: false, tiers, state: null });

  const state = await getChallengeState(playerId);
  return NextResponse.json({ ok: true, authed: true, tiers, state });
}

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  let body: { tierId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const result = await startChallenge(playerId, String(body.tierId ?? ""));
  if (!result.ok) {
    const codes: Record<string, number> = {
      bad_tier: 400,
      active_exists: 409,
      insufficient_credits: 402,
      not_authed: 401,
    };
    return NextResponse.json(result, { status: codes[result.error ?? ""] ?? 500 });
  }
  return NextResponse.json(result);
}
