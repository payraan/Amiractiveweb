// ── اقتصاد و قواعد بازی پیش‌بینی ──────────────────────────────
// همه‌ی اعداد قابل‌تنظیم اینجاست. برای تغییر هزینه/امتیاز/جایزه فقط همین فایل.
// این فایل هیچ وابستگی سمت‌سروری ندارد و هم در کلاینت و هم سرور import می‌شود.

export type TimeframeId = "24h" | "12h" | "4h" | "1h";
export type Asset = "BTC" | "XAU";

export type Timeframe = {
  id: TimeframeId;
  label: string;
  hours: number;
  cost: number; // کردیت لازم برای هر پیش‌بینی
  freeFirst: number; // تعداد پیش‌بینی رایگان روزانه در این تایم‌فریم
  multiplier: number; // ضریب امتیاز (فعلاً برای همه ۱ = یکسان)
  dailyMax?: number; // سقف دفعات مجاز در روز (اگر تعریف شود)
};

// ترتیب نمایش: روزانه (رایگان) اول، بعد کوتاه‌ترها (کردیتی)
export const TIMEFRAMES: Timeframe[] = [
  { id: "24h", label: "۲۴ ساعته", hours: 24, cost: 1, freeFirst: 2, multiplier: 1 },
  { id: "12h", label: "۱۲ ساعته", hours: 12, cost: 2, freeFirst: 0, multiplier: 1 },
  { id: "4h", label: "۴ ساعته", hours: 4, cost: 3, freeFirst: 0, multiplier: 1 },
  { id: "1h", label: "۱ ساعته", hours: 1, cost: 4, freeFirst: 0, multiplier: 1 },
];

export function tf(id: string): Timeframe | undefined {
  return TIMEFRAMES.find((t) => t.id === id);
}

// هدیه‌ی خوش‌آمد هنگام ثبت‌نام (کردیت رایگان برای تست تایم‌فریم‌های کوتاه)
export const WELCOME_CREDITS = 10;

// جدول امتیاز بر اساس درصد خطا (پیش از اعمال ضریب تایم‌فریم)
export const SCORING: { maxErr: number; points: number }[] = [
  { maxErr: 0.1, points: 100 },
  { maxErr: 0.5, points: 50 },
  { maxErr: 1, points: 25 },
  { maxErr: 2, points: 5 },
  { maxErr: 5, points: -10 },
  { maxErr: Infinity, points: -25 },
];

export function scoreFor(errorPct: number, multiplier: number): number {
  const abs = Math.abs(errorPct);
  const row = SCORING.find((r) => abs < r.maxErr) ?? SCORING[SCORING.length - 1];
  return Math.round(row.points * multiplier);
}

// ── مرزهای زمانی راندها ───────────────────────────────────────
// لنگر: ۲۱:۰۰ تهران = ۱۷:۳۰ UTC. همه‌ی تایم‌فریم‌ها روی همین لنگر تراز می‌شوند.
const ANCHOR_UTC_H = 17;
const ANCHOR_UTC_M = 30;

/** نزدیک‌ترین زمان بسته‌شدن راند (اکیداً بعد از الان) برای یک تایم‌فریم. */
export function nextClose(tfHours: number, now: Date = new Date()): Date {
  const stepMs = tfHours * 3_600_000;
  const base = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      ANCHOR_UTC_H,
      ANCHOR_UTC_M,
      0,
      0
    )
  );
  const diff = now.getTime() - base.getTime();
  const n = Math.floor(diff / stepMs) + 1;
  return new Date(base.getTime() + n * stepMs);
}

/** زمان تسویه = یک دوره پس از بسته‌شدن (کاربر قیمت این لحظه را حدس می‌زند). */
export function settleFor(closeAt: Date, tfHours: number): Date {
  return new Date(closeAt.getTime() + tfHours * 3_600_000);
}

// ── بازار طلا: تعطیلی آخر هفته ────────────────────────────────
// فارکس/طلا از جمعه ~۲۱:۰۰ UTC تا یکشنبه ~۲۲:۰۰ UTC بسته است.
export function isGoldOpen(now: Date = new Date()): boolean {
  const day = now.getUTCDay(); // 0=یکشنبه ... 6=شنبه
  const h = now.getUTCHours();
  if (day === 6) return false; // شنبه
  if (day === 5 && h >= 21) return false; // جمعه بعد از ۲۱:۰۰
  if (day === 0 && h < 22) return false; // یکشنبه پیش از ۲۲:۰۰
  return true;
}

export function isAssetOpen(asset: Asset, now: Date = new Date()): boolean {
  return asset === "XAU" ? isGoldOpen(now) : true; // کریپتو ۲۴/۷
}


// ── بسته‌های خرید کردیت ────────────────────────────────────────
// پرداخت با تتر (USDT) از طریق پشتیبانی انجام می‌شود.
// برای تغییر قیمت یا تعداد فقط همین آرایه را ویرایش کن.
export type CreditPack = {
  id: string;
  credits: number;
  priceUsdt: number;
  badge?: string; // مثلا "محبوب"
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 50, priceUsdt: 5 },
  { id: "popular", credits: 200, priceUsdt: 15, badge: "محبوب" },
  { id: "pro", credits: 500, priceUsdt: 30 },
  { id: "arena", credits: 1000, priceUsdt: 50 },
];

export const SUPPORT_TG = "https://t.me/Amiractive_support";
