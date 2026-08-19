import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import { redeemBonusCode } from "@/lib/bonus-codes";

export const dynamic = "force-dynamic";

// مصرف کد بونوس — یک روت برای هر سه سطح (سایت، مینی‌اپ، ربات).
//
// ⚠️ عمدا زیر `/api/wallet/` است تا سقف نرخِ مسیرهای پولی شاملش شود:
// حدس‌زدنِ کد با تلاش پیاپی، دقیقا همان الگویی است که باید کند شود.
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const r = await redeemBonusCode(playerId, String(body.code ?? ""));
  const status: Record<string, number> = {
    bad_code: 400,
    not_found: 404,
    expired: 410,
    exhausted: 409,
    already_used: 409,
    server_error: 500,
  };
  return NextResponse.json(r, { status: r.ok ? 200 : status[r.error] ?? 400 });
}
