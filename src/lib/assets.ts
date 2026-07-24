// کاتالوگ دارایی‌های نبض بازار.
// شناسه‌ها در دیتابیس ذخیره می‌شوند، پس هرگز تغییرشان نده — فقط اضافه کن.
// BTC و XAU عمداً همان شناسه‌های قبلی را دارند تا تاریخچه‌ی بازیکنان حفظ شود.

export type AssetCategory = "crypto" | "forex" | "metal" | "stock";

export type AssetDef = {
  id: string;
  symbol: string; // نماد یاهو فایننس
  label: string; // نام فارسی
  category: AssetCategory;
  decimals: number; // رقم اعشار برای نمایش قیمت
};

export const CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: "crypto", label: "کریپتو" },
  { id: "forex", label: "فارکس" },
  { id: "metal", label: "فلزات" },
  { id: "stock", label: "سهام" },
];

export const ASSETS: AssetDef[] = [
  // ── کریپتو ────────────────────────────────────────────
  { id: "BTC", symbol: "BTC-USD", label: "بیت‌کوین", category: "crypto", decimals: 0 },
  { id: "ETH", symbol: "ETH-USD", label: "اتریوم", category: "crypto", decimals: 1 },
  { id: "XRP", symbol: "XRP-USD", label: "ریپل", category: "crypto", decimals: 4 },
  { id: "BNB", symbol: "BNB-USD", label: "بایننس‌کوین", category: "crypto", decimals: 1 },
  { id: "SOL", symbol: "SOL-USD", label: "سولانا", category: "crypto", decimals: 2 },
  { id: "DOGE", symbol: "DOGE-USD", label: "دوج‌کوین", category: "crypto", decimals: 5 },
  { id: "ADA", symbol: "ADA-USD", label: "کاردانو", category: "crypto", decimals: 4 },
  { id: "TRX", symbol: "TRX-USD", label: "ترون", category: "crypto", decimals: 4 },
  { id: "LINK", symbol: "LINK-USD", label: "چین‌لینک", category: "crypto", decimals: 3 },
  { id: "AVAX", symbol: "AVAX-USD", label: "آوالانچ", category: "crypto", decimals: 3 },
  { id: "XLM", symbol: "XLM-USD", label: "استلار", category: "crypto", decimals: 5 },
  { id: "DOT", symbol: "DOT-USD", label: "پولکادات", category: "crypto", decimals: 3 },
  { id: "LTC", symbol: "LTC-USD", label: "لایت‌کوین", category: "crypto", decimals: 2 },
  { id: "BCH", symbol: "BCH-USD", label: "بیت‌کوین‌کش", category: "crypto", decimals: 2 },
  { id: "NEAR", symbol: "NEAR-USD", label: "نیر", category: "crypto", decimals: 4 },
  { id: "ICP", symbol: "ICP-USD", label: "اینترنت‌کامپیوتر", category: "crypto", decimals: 3 },
  { id: "ETC", symbol: "ETC-USD", label: "اتریوم‌کلاسیک", category: "crypto", decimals: 3 },
  { id: "FIL", symbol: "FIL-USD", label: "فایل‌کوین", category: "crypto", decimals: 4 },
  { id: "ATOM", symbol: "ATOM-USD", label: "کازموس", category: "crypto", decimals: 4 },
  { id: "HBAR", symbol: "HBAR-USD", label: "هدرا", category: "crypto", decimals: 5 },

  // ── فارکس ─────────────────────────────────────────────
  { id: "EURUSD", symbol: "EURUSD=X", label: "یورو / دلار", category: "forex", decimals: 5 },
  { id: "GBPUSD", symbol: "GBPUSD=X", label: "پوند / دلار", category: "forex", decimals: 5 },
  { id: "USDJPY", symbol: "USDJPY=X", label: "دلار / ین", category: "forex", decimals: 3 },
  { id: "USDCHF", symbol: "USDCHF=X", label: "دلار / فرانک", category: "forex", decimals: 5 },
  { id: "AUDUSD", symbol: "AUDUSD=X", label: "دلار استرالیا / دلار", category: "forex", decimals: 5 },
  { id: "USDCAD", symbol: "USDCAD=X", label: "دلار / دلار کانادا", category: "forex", decimals: 5 },
  { id: "NZDUSD", symbol: "NZDUSD=X", label: "دلار نیوزیلند / دلار", category: "forex", decimals: 5 },
  { id: "EURJPY", symbol: "EURJPY=X", label: "یورو / ین", category: "forex", decimals: 3 },

  // ── فلزات ─────────────────────────────────────────────
  { id: "XAU", symbol: "GC=F", label: "طلا", category: "metal", decimals: 2 },
  { id: "XAG", symbol: "SI=F", label: "نقره", category: "metal", decimals: 3 },
  { id: "XPT", symbol: "PL=F", label: "پلاتین", category: "metal", decimals: 2 },
  { id: "COPPER", symbol: "HG=F", label: "مس", category: "metal", decimals: 4 },

  // ── سهام ──────────────────────────────────────────────
  { id: "AAPL", symbol: "AAPL", label: "اپل", category: "stock", decimals: 2 },
  { id: "MSFT", symbol: "MSFT", label: "مایکروسافت", category: "stock", decimals: 2 },
  { id: "NVDA", symbol: "NVDA", label: "انویدیا", category: "stock", decimals: 2 },
  { id: "GOOGL", symbol: "GOOGL", label: "آلفابت", category: "stock", decimals: 2 },
  { id: "AMZN", symbol: "AMZN", label: "آمازون", category: "stock", decimals: 2 },
  { id: "META", symbol: "META", label: "متا", category: "stock", decimals: 2 },
  { id: "TSLA", symbol: "TSLA", label: "تسلا", category: "stock", decimals: 2 },
  { id: "AVGO", symbol: "AVGO", label: "برادکام", category: "stock", decimals: 2 },
  { id: "JPM", symbol: "JPM", label: "جی‌پی‌مورگان", category: "stock", decimals: 2 },
  { id: "V", symbol: "V", label: "ویزا", category: "stock", decimals: 2 },
];

const BY_ID = new Map(ASSETS.map((a) => [a.id, a]));

export function assetById(id: string): AssetDef | null {
  return BY_ID.get(id) ?? null;
}

export function assetsByCategory(cat: AssetCategory): AssetDef[] {
  return ASSETS.filter((a) => a.category === cat);
}

export function categoryLabel(cat: AssetCategory): string {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

/**
 * آیا بازار این دارایی الان باز است؟
 * کریپتو همیشه باز؛ فارکس و فلزات از یکشنبه‌شب تا جمعه‌شب؛
 * سهام فقط روزهای کاری. تشخیص دقیق‌تر از marketState یاهو می‌آید،
 * این فقط یک محافظ اولیه است.
 */
export function isLikelyOpen(cat: AssetCategory, now = new Date()): boolean {
  if (cat === "crypto") return true;
  const day = now.getUTCDay(); // 0=یکشنبه ... 6=شنبه
  const hour = now.getUTCHours();
  if (cat === "stock") return day >= 1 && day <= 5;
  // فارکس و فلزات: بسته از جمعه ۲۲:۰۰ UTC تا یکشنبه ۲۲:۰۰ UTC
  if (day === 6) return false;
  if (day === 5 && hour >= 22) return false;
  if (day === 0 && hour < 22) return false;
  return true;
}
