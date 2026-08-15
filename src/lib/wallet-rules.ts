// قواعد برداشت — مشترک بین سرور و فرم‌ها.
//
// چرا اینجا و نه iran.ts (که خانه‌ی بقیه‌ی اعداد اقتصادی است): دو فرم برداشت
// ("use client") به همین قواعد نیاز دارند و iran.ts به @/lib/db وابسته است؛
// ایمپورت مستقیمش درایور pg را به باندل مرورگر می‌کشد. پس این فایل عمداً
// **هیچ ایمپورتی ندارد** — همان قراری که game.ts برای اقتصاد امتیازی دارد.
//
// قانون: عدد و قاعده فقط اینجا نوشته می‌شود. اگر جای دیگری کپی شود، روزی
// یکی از نسخه‌ها عوض می‌شود و بقیه نه — و کاربر فرمی می‌بیند که «تأیید»
// می‌گوید ولی سرور ردش می‌کند.

/** حداقل برداشت — باید بالاتر از کارمزد شبکه باشد وگرنه بی‌معنی است. */
export const MIN_WITHDRAW = 10;

/**
 * موجودی قابل برداشت، بریده به دو رقم — **هرگز رو به بالا**.
 *
 * ⚠️ چرا بریدن و نه گرد کردن: موجودی واقعی شش رقم اعشار دارد (۳۶.۰۸۶۸۳۱).
 * `toFixed(2)` آن را ۳۶.۰۹ نشان می‌داد — عددی **بزرگ‌تر از موجودی**. کاربر
 * همان را می‌زد، سرور با «بیشتر از موجودی» ردش می‌کرد، و چون فرم پیش از
 * ارسال هم همین را می‌سنجید، دکمه بی‌هیچ توضیحی مرده می‌ماند. یعنی کاربری
 * که کل موجودی‌اش را می‌خواست، اصلا نمی‌توانست برداشت کند.
 *
 * هر جا عددِ «قابل برداشت» به کاربر نشان داده می‌شود یا در فرم گذاشته
 * می‌شود، باید از این بگذرد — وگرنه همان ناسازگاری برمی‌گردد.
 */
export function floorUsdt(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * 100) / 100;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * دیکد Base58 (الفبای بیت‌کوین). خروجی بایت‌های خام، یا null اگر رشته
 * کاراکتر خارج از الفبا داشته باشد.
 *
 * ضرب دستی در ۵۸ به‌جای BigInt: آدرس ۳۴ کاراکتری است و این حلقه ارزان‌تر و
 * قابل اجرا در هر دو محیط است.
 */
export function base58Decode(s: string): Uint8Array | null {
  if (!s) return null;
  const bytes: number[] = [];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // هر «1» ابتدایی یک بایت صفرِ ابتدایی است که در ریاضیات بالا گم می‌شود.
  for (let k = 0; k < s.length && s[k] === "1"; k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/**
 * چک شکلی آدرس ترون — بدون چک‌سام.
 *
 * آدرس ترون ۲۵ بایت است: یک بایت پیشوند 0x41، بیست بایت آدرس، و چهار بایت
 * چک‌سام؛ که در Base58 دقیقاً ۳۴ کاراکتر با شروع «T» می‌شود.
 *
 * همین چک، آدرس شبکه‌ی اشتباه (اتریوم `0x…`، بیت‌کوین)، آدرس بریده‌شده و
 * کاراکتر جاافتاده را می‌گیرد. تشخیص «یک حرف غلط تایپ شده» کار چک‌سام است
 * که به SHA-256 نیاز دارد و سمت سرور انجام می‌شود (withdraw-address.ts).
 */
export function tronAddressShapeValid(addr: string): boolean {
  const a = addr.trim();
  if (a.length !== 34 || a[0] !== "T") return false;
  const raw = base58Decode(a);
  return raw !== null && raw.length === 25 && raw[0] === 0x41;
}

/**
 * چک شکلی آدرس مقصد بر اساس شبکه‌ی درگاه (ZOVIX_USDT_NETWORK).
 *
 * برای شبکه‌ی ناشناخته عمداً به همان چک قدیمی (طول ≥ ۲۰) برمی‌گردد: اگر روزی
 * شبکه‌ی درگاه عوض شود، برداشت نباید کامل قفل شود.
 */
export function withdrawAddressShapeValid(addr: string, network: string): boolean {
  const n = network.trim().toUpperCase();
  if (n === "TRON" || n === "TRC20") return tronAddressShapeValid(addr);
  return addr.trim().length >= 20;
}
