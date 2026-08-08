// تبدیل دقیق تاریخ هجری شمسی ↔ میلادی.
//
// چرا کتابخانه اضافه نکردیم: این الگوریتم استاندارد و شناخته‌شده است
// (همان چیزی که jalaali-js پیاده می‌کند) و افزودن یک وابستگی برای ~۷۰ خط
// ریاضی محض، برای مخاطب ایران که باندل برایش گران است، منطقی نبود.
//
// درستی خروجی با تقویم فارسی خود مرورگر (Intl با ca-persian) روی چند هزار
// روز پیاپی راستی‌آزمایی شده است.
//
// نکته: این توابع فقط با «تاریخ تقویمی» کار می‌کنند، نه لحظه‌ی زمانی. برای
// ساختن یک Date واقعی باید ساعت و منطقه‌ی زمانی جداگانه اعمال شود.

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`سال شمسی نامعتبر: ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** شماره‌ی روز ژولیَن از تاریخ میلادی */
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** تاریخ میلادی از شماره‌ی روز ژولیَن */
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export type Ymd = { y: number; m: number; d: number };

/** میلادی → شمسی */
export function toJalali(gy: number, gm: number, gd: number): Ymd {
  const jdn = g2d(gy, gm, gd);
  const gyy = d2g(jdn).gy;
  let jy = gyy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) return { y: jy, m: 1 + div(k, 31), d: mod(k, 31) + 1 };
    k -= 186;
  } else {
    // مهم: کبیسه‌بودنِ سالِ *قبل از* کاهش ملاک است (r، نه jalCal(jy-1)).
    // اگر اینجا سال کاهش‌یافته را بگیری، آخرین روز سال‌های غیرکبیسه یک روز
    // جلو می‌افتد و «۳۰ اسفند»ی ساخته می‌شود که اصلا وجود ندارد.
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { y: jy, m: 7 + div(k, 30), d: mod(k, 30) + 1 };
}

/** شمسی → میلادی */
export function toGregorian(jy: number, jm: number, jd: number): Ymd {
  const r = jalCal(jy);
  const jdn = g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  const g = d2g(jdn);
  return { y: g.gy, m: g.gm, d: g.gd };
}

/** آیا این سال شمسی کبیسه است؟ */
export function isJalaliLeap(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

/** تعداد روزهای یک ماه شمسی */
export function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/** آیا این تاریخ شمسی اصلا وجود دارد؟ (مثلا ۳۱ اسفند وجود ندارد) */
export function isValidJalali(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
    return false;
  }
  if (jy < 1200 || jy > 1700) return false;
  if (jm < 1 || jm > 12) return false;
  if (jd < 1) return false;
  try {
    return jd <= jalaliMonthDays(jy, jm);
  } catch {
    return false;
  }
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// ── ارقام فارسی ──────────────────────────────────────────────
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** «۱۴۰۵» → «1405» — کاربر ایرانی معمولا با کیبورد فارسی عدد می‌زند. */
export function toEnglishDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa > -1) return String(fa);
    return String(AR_DIGITS.indexOf(ch));
  });
}

/** «1405» → «۱۴۰۵» */
export function toPersianDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

// ── پل بین تاریخ شمسی و لحظه‌ی واقعی زمان ────────────────────
//
// تهران از سال ۱۴۰۱ ساعت تابستانی ندارد و آفست ثابت +۳:۳۰ است. برای
// تاریخ‌های آینده (که تنها کاربرد این فرم است) همین درست است.
const TEHRAN_OFFSET_MIN = 3 * 60 + 30;

/**
 * تاریخ و ساعت شمسیِ تهران → لحظه‌ی واقعی (ISO با منطقه‌ی UTC).
 * برمی‌گرداند null اگر تاریخ وجود نداشته باشد.
 */
export function jalaliToInstant(
  jy: number,
  jm: number,
  jd: number,
  hh: number,
  mi: number
): Date | null {
  if (!isValidJalali(jy, jm, jd)) return null;
  if (hh < 0 || hh > 23 || mi < 0 || mi > 59) return null;
  const g = toGregorian(jy, jm, jd);
  const utcMs = Date.UTC(g.y, g.m - 1, g.d, hh, mi) - TEHRAN_OFFSET_MIN * 60_000;
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** لحظه‌ی واقعی → تاریخ و ساعت شمسیِ تهران */
export function instantToJalali(
  date: Date
): { y: number; m: number; d: number; hh: number; mi: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + TEHRAN_OFFSET_MIN * 60_000);
  const j = toJalali(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
  return { y: j.y, m: j.m, d: j.d, hh: shifted.getUTCHours(), mi: shifted.getUTCMinutes() };
}
