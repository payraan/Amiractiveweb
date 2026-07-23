import { NextResponse } from "next/server";
import { botKeyValid, consumeLinkCode, grantGroupBonus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * ربات پس از دریافت /start link_<code> این را صدا می‌زند.
 * body: { code, tgUserId, inGroup? }
 */
export async function POST(req: Request) {
  if (!botKeyValid(req.headers.get("x-bot-key"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { code?: string; tgUserId?: number | string; inGroup?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim();
  const tgUserId = Number(body.tgUserId);
  if (!code || !Number.isFinite(tgUserId) || tgUserId <= 0) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await consumeLinkCode(code, tgUserId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  let bonus = { granted: false, credits: 0 };
  if (body.inGroup) {
    bonus = await grantGroupBonus(tgUserId);
  }

  return NextResponse.json({
    ok: true,
    displayName: result.displayName,
    bonusGranted: bonus.granted,
    credits: bonus.credits,
  });
}
