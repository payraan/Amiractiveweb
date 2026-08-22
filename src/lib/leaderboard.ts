// ── تعریف مشترک لیدربورد ──────────────────────────────────────────
//
// تنها منبع حقیقتِ «چه بازه‌ای، چند نتیجه شمرده می‌شود». مصرف‌کننده‌ها:
// روت `/api/predict/leaderboard`، رتبه‌ی پروفایل در `profile.ts`، و
// رابط‌های سایت و مینی‌اپ.
//
// ⚠️ **این فایل نباید هیچ وابستگی سروری بگیرد** (مثل `game.ts`): کلاینت
// هم import می‌کند. به همین دلیل `POLY_FREE_PER_DAY` از `poly-scoring.ts`
// می‌آید نه از `poly.ts` که به `db` وصل است.
//
// چرا ساخته شد: سقف ۶۰ و بازه‌ی «۳۰ روز» در دو جای جدا نوشته شده بودند
// (روت لیدربورد و `profile.ts`). هر تغییری در یکی، دیگری را بی‌صدا از آن
// جدا می‌کرد — و «دو رتبه‌ی متفاوت با یک نام» باگی است که تازه رفع شد.

import { TIMEFRAMES } from "@/lib/game";
import { POLY_FREE_PER_DAY } from "@/lib/poly-scoring";

/** بازه‌های لیدربورد. */
export type LbRange = "weekly" | "monthly" | "all";

/**
 * ⚠️ بازه‌ی «روزانه» عمداً حذف شد.
 *
 * سقف روزانه ۱۰ بود ولی کل سهمیه‌ی رایگان روزانه ۷ است (۲ نبض بازار +
 * ۵ ترید). یعنی سه خانه‌ی **شمرده‌شونده** با MOON خریدنی بود — دقیقاً
 * همان «پول رتبه می‌خرد» که کل معماری سقف برای بستنش ساخته شد.
 *
 * راه دیگر، پایین‌آوردن سقف روزانه به ۷ بود؛ ولی بورد یک‌روزه با ۷
 * پیش‌بینی بیشتر شانس را می‌سنجد تا مهارت، و بازه‌ی جایزه ماهانه است.
 */
export const RANGES: LbRange[] = ["weekly", "monthly", "all"];

export const RANGE_LABEL: Record<LbRange, string> = {
  weekly: "هفتگی",
  monthly: "ماهانه",
  all: "کل",
};

/** پنجره‌ی SQL هر بازه. رشته‌ی خالی یعنی بدون فیلتر زمانی. */
export const WINDOWS: Record<LbRange, string> = {
  weekly: "7 days",
  monthly: "30 days",
  all: "",
};

/** طول بازه به روز — مبنای محاسبه‌ی سهمیه‌ی رایگان. «کل» مثل ماهانه. */
export const RANGE_DAYS: Record<LbRange, number> = {
  weekly: 7,
  monthly: 30,
  all: 30,
};

/** سهمیه‌ی رایگان روزانه‌ی نبض بازار — جمع `freeFirst` همه‌ی تایم‌فریم‌ها. */
export const FREE_PULSE_PER_DAY = TIMEFRAMES.reduce((n, t) => n + t.freeFirst, 0);

/** سهمیه‌ی رایگان روزانه‌ی ترید. */
export const FREE_TRADE_PER_DAY = POLY_FREE_PER_DAY;

/** بازی‌هایی که تخته‌ی امتیازی دارند. بازار ایران جداست (اقتصاد دیگری دارد). */
export type LbGame = "pulse" | "trade" | "main" | "combo";

/** سهمیه‌ی رایگان روزانه‌ی هر تخته. `main` جمع دو بازی است. */
export const FREE_PER_DAY: Record<LbGame, number> = {
  pulse: FREE_PULSE_PER_DAY,
  trade: FREE_TRADE_PER_DAY,
  main: FREE_PULSE_PER_DAY + FREE_TRADE_PER_DAY,
  // کمبو اهرمش با MOON خریده می‌شود و سهمیه‌ی رایگان روزانه ندارد؛
  // سقفش دستی و محافظه‌کارانه است، نه مشتق‌شده.
  combo: Number.POSITIVE_INFINITY,
};

/**
 * سقف تعداد نتیجه‌ی شمرده‌شونده در هر بازه — **نخستین‌ها، نه بهترین‌ها**.
 *
 * ⚠️ **ناوردِ حیاتی:** هیچ سقفی نباید از سهمیه‌ی رایگانِ همان بازه بیشتر
 * باشد. اگر بیشتر شود، MOON خانه‌ی شمرده‌شونده می‌خرد و رتبه خریدنی
 * می‌شود. با `capsExceedingFreeSupply()` بسنجش.
 */
export const CAPS: Record<LbGame, Record<LbRange, number>> = {
  // ۲ در روز → ۱۴ در هفته، ۶۰ در ماه (۲×۳۰). دقیقاً روی سهمیه.
  pulse: { weekly: 14, monthly: 60, all: 60 },
  // ۵ در روز → ۳۵ در هفته. ماهانه ۱۵۰ می‌شد، ولی روی ۶۰ بسته شده تا
  // وزن دو تخته در بازه‌ی جایزه برابر بماند.
  trade: { weekly: 35, monthly: 60, all: 60 },
  // ⚠️ عمداً دست‌نخورده از نسخه‌ی قبل (منهای روزانه): این تخته مبنای
  // پاداش و رتبه‌ی پروفایل است و عوض‌کردن اعدادش یعنی «قانون وسط بازی
  // عوض شد».
  main: { weekly: 25, monthly: 60, all: 60 },
  combo: { weekly: 10, monthly: 20, all: 20 },
};

/**
 * فهرست سقف‌هایی که از سهمیه‌ی رایگان بیشترند — باید همیشه خالی باشد.
 *
 * تابع خالص است تا بشود در اسکریپت یا تست صدایش زد؛ عمداً خودش خطا
 * پرتاب نمی‌کند که import شدنِ این فایل هیچ‌وقت اپ را نکشد.
 */
export function capsExceedingFreeSupply(): string[] {
  const bad: string[] = [];
  for (const game of Object.keys(CAPS) as LbGame[]) {
    for (const range of RANGES) {
      const free = FREE_PER_DAY[game] * RANGE_DAYS[range];
      if (CAPS[game][range] > free) {
        bad.push(`${game}/${range}: سقف ${CAPS[game][range]} > سهمیه ${free}`);
      }
    }
  }
  return bad;
}

/** سقف امن، با محافظ در برابر بازه‌ی ناشناخته. */
export function capFor(game: LbGame, range: string): number {
  const r = (RANGES as string[]).includes(range) ? (range as LbRange) : "monthly";
  return CAPS[game][r];
}

/** پنجره‌ی امن، با همان محافظ. */
export function windowFor(range: string): string {
  const r = (RANGES as string[]).includes(range) ? (range as LbRange) : "monthly";
  return WINDOWS[r];
}

// ── درصد برتر، پله‌ای ─────────────────────────────────────────────
//
// ⚠️ درصدِ **دقیق** در کنار رتبه، تعداد کل کاربران را لو می‌دهد:
//     total = above ÷ (۱ − percentile ÷ ۱۰۰)
// با جمعیت کوچک این جبر یک جواب دقیق می‌دهد (با ۱۵ کاربرِ رتبه‌دار،
// دقیقاً ۱۵ درمی‌آید) — و «تعداد کاربران هرگز عمومی نمی‌شود» خط قرمز
// محصول است. بدتر اینکه نشتی دقیقاً وقتی شدید است که عدد حساس‌تر است:
// با ۵۰۰ کاربر صدها جواب ممکن دارد، با ۱۵ کاربر فقط یکی.
//
// پله‌ای‌کردن همان حالت را به بازه‌ی «۸ تا ۱۹» می‌برد. کامل نمی‌بندد —
// هر درصدی مقیاس تقریبی را می‌گوید — ولی فرق «دقیقاً ۱۵» با «عددی زیر
// ۲۰» زیاد است، و انگیزه‌ی «جزو برترها بودن» حفظ می‌شود.
//
// ⚠️ پله‌ها عمداً شامل ۵۰ و ۹۰ و ۹۹ هستند چون سه نشان دقیقاً روی همین
// آستانه‌ها تعریف شده‌اند (`badges.ts`). اگر پله‌ای برداشته شود که یک
// آستانه‌ی نشان روی آن است، آن نشان دیگر هرگز کسب نمی‌شود.
export const PERCENTILE_BUCKETS = [99, 90, 75, 50, 25];

/** درصد دقیق → نزدیک‌ترین پله‌ی پایین‌تر. زیر کمترین پله ۰ برمی‌گردد. */
export function bucketPercentile(exact: number): number {
  for (const b of PERCENTILE_BUCKETS) if (exact >= b) return b;
  return 0;
}
