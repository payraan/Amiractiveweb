import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import { CHALLENGES, getChallengeState, startChallenge } from "@/lib/challenge";
import { requireLinkedTelegram } from "@/lib/money-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  const tiers = CHALLENGES.map((c) => ({
    id: c.id,
    track: c.track,
    label: c.label,
    fee: c.fee,
    target: c.target,
    maxDrawdown: c.maxDrawdown,
    dailyLoss: c.dailyLoss,
    minPreds: c.minPreds,
    minDays: c.minDays,
    days: c.days,
    prize: c.prize,
    payoutNote: c.payoutNote ?? null,
    popular: c.popular ?? false,
  }));
  if (!playerId) return NextResponse.json({ ok: true, authed: false, tiers, state: null });

  const state = await getChallengeState(playerId);
  return NextResponse.json({ ok: true, authed: true, tiers, state });
}

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  // ورود به چالش با MOON پرداخت می‌شود ولی جایزه‌اش حساب واقعی است، پس از
  // نظر ضدتقلب هم‌رده‌ی مسیرهای پولی است. بدون این قفل، حسابِ بی‌هویتِ سایتی
  // می‌توانست با MOONـی که از پورسانت رفرال گرفته وارد چالش شود.
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;

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
      entry_limit: 429,
      insufficient_credits: 402,
      not_authed: 401,
    };
    return NextResponse.json(result, { status: codes[result.error ?? ""] ?? 500 });
  }
  return NextResponse.json(result);
}
