import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/current-player";
import {
  logEvent,
  isEventKind,
  isSurface,
  isGame,
  type AppEvent,
} from "@/lib/events";

export const dynamic = "force-dynamic";

// دریافت رویدادهای رفتاری از کلاینت.
//
// بعضی از پله‌های قیف هیچ روت دیگری ندارند: «فهرست را دیدم» و «این بازار
// را باز کردم» در مینی‌اپ فقط تغییر state هستند و به سرور نمی‌رسند. بدون
// این روت، بالای قیف نامرئی می‌ماند و نرخ تبدیل قابل محاسبه نیست.
//
// ── چند تصمیم امنیتی ──
// • احراز هویت **اختیاری** است. بازدیدکننده‌ی ناشناسِ سایت دقیقا همان
//   بالای قیف است؛ اگر فقط کاربر واردشده ثبت شود، تبدیل همیشه ۱۰۰٪
//   به نظر می‌رسد.
// • ولی `playerId` **هرگز از بدنه خوانده نمی‌شود** — از کوکی/هدر خودِ
//   سرور می‌آید. وگرنه هر کسی می‌توانست رویداد به نام دیگری بسازد.
// • همه‌ی مقادیر با فهرست سفید سنجیده می‌شوند، نه با «هرچه فرستادی».
// • دسته‌ای، تا سقف ۲۰ رویداد؛ و سقف نرخ در میدل‌ور.

const MAX_BATCH = 20;
const MAX_ID = 64;
const MAX_CAT = 32;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const raw = (body as { events?: unknown })?.events;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ ok: false, error: "bad_events" }, { status: 400 });
  }

  // ⚠️ هویت از سرور، نه از بدنه. این خط تنها چیزی است که جلوی ساختنِ
  // رویداد به نام کاربر دیگر را می‌گیرد.
  const playerId = await currentPlayerId();

  let accepted = 0;
  for (const item of raw.slice(0, MAX_BATCH)) {
    const e = item as Record<string, unknown>;
    if (!isEventKind(e.kind) || !isSurface(e.surface)) continue;

    const ev: AppEvent = {
      playerId,
      kind: e.kind,
      surface: e.surface,
      game: isGame(e.game) ? e.game : null,
      marketId:
        typeof e.marketId === "string" || typeof e.marketId === "number"
          ? String(e.marketId).slice(0, MAX_ID)
          : null,
      category:
        typeof e.category === "string" ? e.category.slice(0, MAX_CAT) : null,
    };
    logEvent(ev);
    accepted++;
  }

  // ۲۰۲ و نه ۲۰۰: نوشتن عمدا آتش‌کن-و-فراموش‌کن است و این پاسخ فقط
  // می‌گوید «تحویل گرفتم»، نه «در دیتابیس نشست».
  return NextResponse.json({ ok: true, accepted }, { status: 202 });
}
