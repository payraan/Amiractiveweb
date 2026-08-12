import { NextResponse } from "next/server";
import { hasLinkedTelegram } from "@/lib/telegram";

// ═══ شرط اتصال تلگرام برای اعمال پولی ═══════════════════════
//
// مرز مصوب مالک: مرز روی «ورود پول» است نه «خروج پول».
//
// اگر فقط برداشت قفل می‌شد، کاربر واریز و شرط می‌کرد و تازه آن‌وقت می‌فهمید
// پولش گیر کرده — بدترین حالت ممکن برای اعتماد. با قفل‌کردن همه‌ی مسیرهای
// پولی، اصلا موجودیِ بدون هویت شکل نمی‌گیرد، پس تله ساخته نمی‌شود.
//
// این «قفل» بن‌بست نیست: راه بازش یک کلیک است — صفحه‌ی دعوت در سایت یا باز
// کردن مینی‌اپ. کاربری که از مینی‌اپ آمده همیشه از پیش متصل است، چون حسابش
// با همان initData ساخته شده.
//
// چرا اصلا: ضدتقلبِ رفرال، چالش، لیدربورد و پاداش‌ها همه روی «یک نفر = یک
// حساب» ایستاده‌اند، و تنها لنگر واقعی این ادعا هویت تلگرام است.

export type MoneyGuardResult = { ok: true } | { ok: false; response: Response };

export async function requireLinkedTelegram(
  playerId: number
): Promise<MoneyGuardResult> {
  if (await hasLinkedTelegram(playerId)) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "telegram_required" },
      { status: 403 }
    ),
  };
}
