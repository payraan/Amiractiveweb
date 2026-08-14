import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { requestWithdrawal } from "@/lib/withdrawal";

export const dynamic = "force-dynamic";

// منطق برداشت در `src/lib/withdrawal.ts` است، نه اینجا: ربات هم همان را صدا
// می‌زند. دو پیاده‌سازی موازی برای تنها عمل برگشت‌ناپذیر پلتفرم یعنی روزی
// یکی‌شان یک بررسی کمتر دارد.

/** کد خطا → وضعیت HTTP. */
const STATUS: Record<string, number> = {
  gateway_off: 503,
  amount_too_low: 400,
  bad_address: 400,
  insufficient_funds: 402,
  rate_limited: 429,
  server_error: 500,
};

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  // تنها مسیری که بلاک‌بودن ربات قفلش نمی‌کند. اگر اینجا هم قفل می‌شد، یک
  // بلاک‌کردن ساده پول کاربر را در پلتفرم حبس می‌کرد — و راه بازکردنش بیرون
  // از دست ما بود. اتصال تلگرام همچنان لازم است، فقط بلاک‌بودن مانع نیست.
  const linked = await requireLinkedTelegram(playerId, { evenIfBlocked: true });
  if (!linked.ok) return linked.response;

  let body: { amount?: number; toAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const r = await requestWithdrawal(
    playerId,
    Number(body.amount),
    String(body.toAddress ?? "")
  );
  if (!r.ok) {
    // خطای ناشناخته از درگاه می‌آید و ۵۰۲ است — همان رفتار قبلی.
    return NextResponse.json(
      { ok: false, error: r.error },
      { status: STATUS[r.error] ?? 502 }
    );
  }
  return NextResponse.json({ ok: true, uuid: r.uuid, amount: r.amount });
}
