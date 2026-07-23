import { NextResponse } from "next/server";
import { botKeyValid, grantGroupBonus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * ربات پس از تأیید عضویت کاربر در گروه این را صدا می‌زند.
 * body: { tgUserId }
 */
export async function POST(req: Request) {
  if (!botKeyValid(req.headers.get("x-bot-key"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { tgUserId?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const tgUserId = Number(body.tgUserId);
  if (!Number.isFinite(tgUserId) || tgUserId <= 0) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const bonus = await grantGroupBonus(tgUserId);
  return NextResponse.json({ ok: true, ...bonus });
}
