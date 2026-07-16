// تنظیمات مرکزی سایت
// برای کمپین و جشنواره فقط همین فایل را ویرایش کن:
// - تخفیف: originalPrice را پر کن (قیمت قبلی خط می‌خورد) و price را قیمت جدید بگذار
// - بج کارت: badge را بنویس، مثلا "جشنواره ۳۰٪"

export const LINKS = {
  telegramChannel: "https://t.me/CashflowFactorys",
  telegramSupport: "https://t.me/CashflowFactorys", // TODO: آیدی پشتیبانی
  myfxbook: "https://www.myfxbook.com", // TODO: لینک عمومی پورتفوی
};

export type Plan = {
  id: string;
  title: string;
  price: string;
  originalPrice?: string;
  period: string;
  badge?: string;
  note?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "trial",
    title: "تست رایگان",
    price: "$0",
    period: "/ یک هفته",
    note: "روی حساب دمو — عملکرد را بدون ریسک خودتان بسنجید.",
    features: [
      "دسترسی کامل به ربات",
      "فعال‌سازی روی حساب دمو",
      "راهنمای نصب قدم‌به‌قدم",
      "پشتیبانی در تلگرام",
    ],
    cta: "دریافت نسخه‌ی تست",
  },
  {
    id: "ib",
    title: "با بروکر معرفی ما",
    price: "$100",
    period: "/ ماه",
    badge: "پیشنهاد ما",
    note: "چرا ارزان‌تر؟ چون بخشی از هزینه را همکاری ما با بروکر پوشش می‌دهد.",
    features: [
      "لایسنس کامل ربات",
      "راهنمای نصب قدم‌به‌قدم روی MT5",
      "پشتیبانی مستقیم در تلگرام",
      "ثبت‌نام بروکر با راهنمایی ما",
    ],
    cta: "خرید و فعال‌سازی",
    highlight: true,
  },
  {
    id: "free-broker",
    title: "با بروکر دلخواه شما",
    price: "$150",
    period: "/ ماه",
    note: "روی هر بروکری که خودتان انتخاب کرده‌اید فعال می‌شود.",
    features: [
      "لایسنس کامل ربات",
      "راهنمای نصب قدم‌به‌قدم روی MT5",
      "پشتیبانی مستقیم در تلگرام",
      "بدون نیاز به تغییر بروکر",
    ],
    cta: "خرید و فعال‌سازی",
  },
];
