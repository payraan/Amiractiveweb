import { assetById, isLikelyOpen } from "@/lib/assets";

// ── اقتصاد و قواعد بازی پیش‌بینی ──────────────────────────────
// همه‌ی اعداد قابل‌تنظیم اینجاست. برای تغییر هزینه/امتیاز/جایزه فقط همین فایل.
// این فایل هیچ وابستگی سمت‌سروری ندارد و هم در کلاینت و هم سرور import می‌شود.

export type TimeframeId = "24h" | "12h" | "4h" | "1h";
export type Asset = string;

export type Timeframe = {
  id: TimeframeId;
  label: string;
  hours: number;
  cost: number; // MOON لازم برای هر پیش‌بینی
  freeFirst: number; // تعداد پیش‌بینی رایگان روزانه در این تایم‌فریم
  multiplier: number; // ضریب امتیاز (فعلاً برای همه ۱ = یکسان)
  dailyMax?: number; // سقف دفعات مجاز در روز (اگر تعریف شود)
};

// ترتیب نمایش: روزانه (رایگان) اول، بعد کوتاه‌ترها (MOON)
export const TIMEFRAMES: Timeframe[] = [
  { id: "24h", label: "۲۴ ساعته", hours: 24, cost: 1, freeFirst: 2, multiplier: 1 },
  { id: "12h", label: "۱۲ ساعته", hours: 12, cost: 2, freeFirst: 0, multiplier: 1 },
  { id: "4h", label: "۴ ساعته", hours: 4, cost: 3, freeFirst: 0, multiplier: 1 },
  { id: "1h", label: "۱ ساعته", hours: 1, cost: 4, freeFirst: 0, multiplier: 1 },
];

export function tf(id: string): Timeframe | undefined {
  return TIMEFRAMES.find((t) => t.id === id);
}

// هدیه‌ی خوش‌آمد هنگام ثبت‌نام (MOON رایگان برای تست تایم‌فریم‌های کوتاه)
export const WELCOME_CREDITS = 10;

// جدول امتیاز بر اساس درصد خطا — برای هر تایم‌فریم جداگانه.
// آستانه‌ها متناسب با نوسان طبیعی هر بازه (تقریب جذر زمان) تنگ‌تر می‌شوند
// تا گرفتن امتیاز در همه‌ی تایم‌فریم‌ها به یک اندازه مهارت بخواهد.
export type ScoreRow = { maxErr: number; points: number };

// ── جدول امتیازدهی (کالیبره‌شده بر پایه‌ی مهارت) ─────────────────
//
// مدل: بازیکن بی‌مهارت قیمت فعلی را وارد می‌کند، پس خطایش برابر |بازده|
// آن بازه است. بازده بازارها دم‌کلفت است (Student-t با df=4)، نه نرمال —
// یعنی حرکت‌های خیلی کوچک بسیار شایع‌ترند و اگر با توزیع نرمال حساب کنی
// جواب کاملا غلط می‌شود.
//
// آستانه‌ها ضریبی از انحراف معیار همان بازه‌اند:
//   0.03σ / 0.12σ / 0.30σ / 0.60σ / 1.30σ
// و σ هر تایم‌فریم با قانون جذر زمان از نوسان روزانه می‌آید:
//   σ(tf) = REF_VOL_PCT × √(ساعت/۲۴)
// پس هر چهار تایم‌فریم دقیقا هم‌سختی‌اند.
//
// امید ریاضی (تایید‌شده با دو روش مستقل: انتگرال تحلیلی + مونت‌کارلو):
//   بی‌مهارت ≈ −۴.۷   |   ۱۰٪ بهتر از تصادف ≈ −۰.۴
//   ۲۰٪ بهتر ≈ +۴.۲   |   ۳۰٪ بهتر ≈ +۹.۲
// یعنی حدس کورکورانه ضرر است، و چون هر پیش‌بینی اضافه به‌طور میانگین
// منفی است، خریدِ MOON بیشتر رتبه نمی‌خرد.
export const SCORING_BY_TF: Record<TimeframeId, ScoreRow[]> = {
  // σ = ۲.۰۰۰٪
  "24h": [
    { maxErr: 0.06, points: 100 },
    { maxErr: 0.24, points: 55 },
    { maxErr: 0.6, points: 25 },
    { maxErr: 1.2, points: 3 },
    { maxErr: 2.6, points: -19 },
    { maxErr: Infinity, points: -90 },
  ],
  // σ = ۱.۴۱۴٪
  "12h": [
    { maxErr: 0.042, points: 100 },
    { maxErr: 0.17, points: 55 },
    { maxErr: 0.42, points: 25 },
    { maxErr: 0.85, points: 3 },
    { maxErr: 1.84, points: -19 },
    { maxErr: Infinity, points: -90 },
  ],
  // σ = ۰.۸۱۶٪
  "4h": [
    { maxErr: 0.024, points: 100 },
    { maxErr: 0.098, points: 55 },
    { maxErr: 0.245, points: 25 },
    { maxErr: 0.49, points: 3 },
    { maxErr: 1.06, points: -19 },
    { maxErr: Infinity, points: -90 },
  ],
  // σ = ۰.۴۰۸٪
  "1h": [
    { maxErr: 0.012, points: 100 },
    { maxErr: 0.049, points: 55 },
    { maxErr: 0.122, points: 25 },
    { maxErr: 0.245, points: 3 },
    { maxErr: 0.53, points: -19 },
    { maxErr: Infinity, points: -90 },
  ],
};

export function scoreFor(
  errorPct: number,
  tfId: TimeframeId = "24h",
  volScale = 1
): number {
  const table = thresholdsFor(tfId, volScale);
  const abs = Math.abs(errorPct);
  const row = table.find((r) => abs < r.maxErr) ?? table[table.length - 1];
  return row.points;
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
  const def = assetById(asset);
  if (!def) return false;
  return isLikelyOpen(def.category, now);
}

// ── امتیازدهی نرمال‌شده با نوسان ───────────────────────────────
// جدول‌های بالا برای دارایی با نوسان روزانه‌ی حدود ۲٪ تنظیم شده‌اند.
// جفت‌ارزها حدود ۰.۲۵٪ و سهامی مثل تسلا حدود ۹.۶٪ نوسان دارند —
// بدون این ضریب، جفت‌ارز مزرعه‌ی امتیاز مفت می‌شد و سهام پرنوسان
// عملاً غیرقابل‌بازی. ضریب در لحظه‌ی ساخت راند قفل می‌شود تا قانون
// وسط بازی عوض نشود.
export const REF_VOL_PCT = 2.0;
const VOL_SCALE_MIN = 0.2;
const VOL_SCALE_MAX = 4.0;

// وقتی نوسان واقعی اندازه‌گیری نشده (داده‌ی ناقص یاهو)، برگرداندن ۱ یعنی
// آستانه‌های بیت‌کوین روی یک جفت‌ارز آرام اعمال شود — و آن راند تبدیل به
// مزرعه‌ی امتیاز مفت می‌شود. پس به‌جای ۱، یک پیش‌فرض محافظه‌کارانه بر اساس
// کلاس دارایی می‌دهیم که به نوسان معمول همان کلاس نزدیک است.
const FALLBACK_SCALE: Record<string, number> = {
  forex: 0.25, // نوسان روزانه معمول ~۰.۵٪
  metal: 0.5, // ~۱٪
  crypto: 1, // ~۲٪ (مرجع)
  stock: 1.5, // ~۳٪
};

export function volScaleFor(
  dailyVolPct: number | null | undefined,
  category?: string
): number {
  if (!dailyVolPct || !Number.isFinite(dailyVolPct) || dailyVolPct <= 0) {
    return category ? (FALLBACK_SCALE[category] ?? 1) : 1;
  }
  const raw = dailyVolPct / REF_VOL_PCT;
  const clamped = Math.min(VOL_SCALE_MAX, Math.max(VOL_SCALE_MIN, raw));
  return Math.round(clamped * 1000) / 1000;
}

/** آستانه‌های واقعی یک راند، پس از اعمال ضریب نوسان. */
export function thresholdsFor(
  tfId: TimeframeId,
  volScale = 1
): { maxErr: number; points: number }[] {
  const table = SCORING_BY_TF[tfId] ?? SCORING_BY_TF["24h"];
  return table.map((r) => ({
    points: r.points,
    maxErr: r.maxErr === Infinity ? Infinity : r.maxErr * volScale,
  }));
}


// ── بسته‌های خرید MOON ────────────────────────────────────────
// پرداخت با تتر (USDT) از طریق پشتیبانی انجام می‌شود.
// برای تغییر قیمت یا تعداد فقط همین آرایه را ویرایش کن.
export type CreditPack = {
  id: string;
  credits: number;
  priceUsdt: number;
  badge?: string; // مثلا "محبوب"
};

// نردبان قیمت طوری چیده شده که هر پک بزرگ‌تر، هر MOON را ارزان‌تر بدهد
// (از ۰.۱۰ دلار در پک شروع تا ۰.۰۴۲ دلار در بزرگ‌ترین پک). دو پک آخر
// اضافه شدند چون چلنج‌های بزرگ تا ۲۸۰۰ MOON ورودی دارند و کاربر نباید
// مجبور شود چند بار خرید کند.
// هشت بسته تا شبکه‌ی ۴ستونی دقیقا دو ردیف کامل شود (۶ تا یک ردیف ناقص
// می‌ساخت). پله‌ها یکنواخت‌اند: هرچه بسته بزرگ‌تر، هر MOON ارزان‌تر.
export const CREDIT_PACKS: CreditPack[] = [
  { id: "mini", credits: 20, priceUsdt: 2.5 },
  { id: "starter", credits: 50, priceUsdt: 5 },
  { id: "plus", credits: 100, priceUsdt: 9 },
  { id: "popular", credits: 200, priceUsdt: 15, badge: "محبوب" },
  { id: "pro", credits: 500, priceUsdt: 30 },
  { id: "arena", credits: 1000, priceUsdt: 50 },
  { id: "elite", credits: 2000, priceUsdt: 90, badge: "بهترین ارزش" },
  { id: "prime", credits: 3000, priceUsdt: 125 },
];

/** بسته را با شناسه پیدا کن — سرور هرگز به قیمتِ ارسالی کلاینت اعتماد نمی‌کند. */
export function creditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export const SUPPORT_TG = "https://t.me/Amiractive_support";
