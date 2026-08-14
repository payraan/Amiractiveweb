// جست‌وجوی فارسی — بخشنده، نه دقیق.
//
// مقایسه‌ی خام دو رشته برای فارسی جواب نمی‌دهد. یک متن ممکن است «ي» عربی
// داشته باشد و کاربر «ی» فارسی بزند؛ یا کلمه با نیم‌فاصله نوشته شده باشد و
// کاربر با فاصله بنویسد؛ یا عدد فارسی در برابر عدد لاتین. هیچ‌کدام از این‌ها
// از دید کاربر «غلط تایپی» نیست، ولی includes ساده هر کدامشان را رد می‌کند.
//
// عمدا هیچ ایمپورتی ندارد تا کامپوننت‌های "use client" هم بتوانند بخوانندش.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * شکل یکسان‌شده‌ی یک رشته برای مقایسه.
 *
 * نیم‌فاصله حذف می‌شود نه تبدیل به فاصله: «پیش‌بینی» و «پیشبینی» باید یکی
 * حساب شوند، و کاربری که «پیش بینی» می‌نویسد هم با حذف فاصله‌ها در مقایسه‌ی
 * بدون‌فاصله پیدایش می‌کند.
 */
export function normalizeFa(input: string): string {
  let s = (input ?? "").toLowerCase();

  // گونه‌های عربی حروف فارسی
  s = s.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه");
  // همزه‌های روی الف — کاربر معمولا الف ساده می‌زند
  s = s.replace(/[أإآ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ی");
  // اعراب و کشیده و نیم‌فاصله
  s = s.replace(/[ً-ْـ‌‏‎]/g, "");
  // ارقام فارسی و عربی به لاتین
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

  return s.replace(/\s+/g, " ").trim();
}

/**
 * آیا عبارت جست‌وجو در این متن‌ها هست؟
 *
 * هر واژه‌ی عبارت باید جایی پیدا شود، ولی لازم نیست کنار هم باشند: کسی که
 * «دلار آزاد» می‌نویسد باید «قیمت دلار در بازار آزاد» را هم پیدا کند.
 */
export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = normalizeFa(query);
  if (!q) return true;

  const hay = normalizeFa(fields.filter(Boolean).join(" "));
  const flat = hay.replace(/ /g, "");

  return q
    .split(" ")
    .filter(Boolean)
    .every((w) => hay.includes(w) || flat.includes(w.replace(/ /g, "")));
}

/**
 * عنوان قابل نمایش یک بازار خارجی.
 *
 * ⚠️ اگر ترجمه نبود، **عنوان انگلیسی** برمی‌گردد نه رشته‌ی خالی. عنوان
 * ترجمه‌نشده ناخوشایند است؛ کارتِ بی‌عنوان خراب است.
 */
export function displayTitle(en: string, fa?: string | null): string {
  return (fa ?? "").trim() || en;
}
