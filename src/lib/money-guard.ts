import { NextResponse } from "next/server";
import { checkTelegramLink } from "@/lib/telegram";

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

// ── بلاک‌کردن ربات ──
//
// اتصال تلگرام وقتی کاربر ربات را بلاک می‌کند بی‌صدا بی‌اثر می‌شود: آیدی در
// دیتابیس می‌ماند ولی هیچ پیامی — از جمله اعلان برداشت — دیگر نمی‌رسد. پس
// حساب بلاک‌شده برای مسیرهای *ورودِ* پول مثل حساب وصل‌نشده رفتار می‌کند.
//
// ⚠️ **برداشت هرگز به این دلیل قفل نمی‌شود.** همان مرزی که این فایل رویش
// نوشته شده: قفل روی ورود پول است، نه خروج. کسی نباید بین خودش و پولش
// دیوار ببیند — مخصوصا دیواری که برداشتنش به یک اپ سوم وابسته است.
// روت برداشت با `evenIfBlocked` صریحا از این قاعده خارج می‌شود.

export type MoneyGuardResult = { ok: true } | { ok: false; response: Response };

export async function requireLinkedTelegram(
  playerId: number,
  opts: { evenIfBlocked?: boolean } = {}
): Promise<MoneyGuardResult> {
  const link = await checkTelegramLink(playerId);

  if (!link.linked) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "telegram_required" },
        { status: 403 }
      ),
    };
  }

  if (link.blocked && !opts.evenIfBlocked) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "telegram_blocked" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
