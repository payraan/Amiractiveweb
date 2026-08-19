// سرویس دیتای بازار برای نبض بازار — سمت سرور (Railway)،
// تا بازدیدکننده‌ی ایرانی هیچ‌وقت به منبع اصلی نیاز نداشته باشد.

import { assetById, isLikelyOpen, type AssetDef } from "@/lib/assets";

export type Asset = string;

export type MarketPoint = { t: number; p: number };

export type MarketData = {
  asset: Asset;
  label: string;
  category: string;
  decimals: number;
  price: number | null;
  changePct: number | null;
  series: MarketPoint[];
  /** نوسان تحقق‌یافته‌ی روزانه بر حسب درصد — پایه‌ی امتیازدهی عادلانه */
  dailyVolPct: number | null;
  marketState: string | null;
  updatedAt: number;
};

const TTL_MS = 60_000;
const cache = new Map<Asset, { data: MarketData; ts: number }>();

/**
 * تعداد کندل ۵ دقیقه‌ایِ یک **روز معاملاتی کامل** برای این دارایی.
 *
 * ⚠️ این عدد ثابت نیست و همین جای اشتباه قبلی بود. یاهو با
 * `interval=5m` فقط کندل ساعت‌های **باز** را می‌دهد:
 *   کریپتو ۲۸۸ (۲۴ ساعت) · فارکس ~۲۵۸ · طلا ~۲۴۶ · **سهام فقط ۷۸**
 *
 * از روی مُد (پرتکرارترین) شمارشِ روزانه حساب می‌شود، نه میانگین:
 * روزهای ناقصِ ابتدا و انتهای پنجره میانگین را پایین می‌کشند ولی روی مُد
 * اثری ندارند.
 */
function barsPerDay(points: MarketPoint[]): number {
  const perDay = new Map<string, number>();
  for (const pt of points) {
    const d = new Date(pt.t * 1000).toISOString().slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const counts = [...perDay.values()];
  if (!counts.length) return 288;
  // مُد: پرتکرارترین شمارش. با پنجره‌ی ۵ روزه، روزهای کامل اکثریت‌اند.
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  let best = counts[0];
  let bestN = 0;
  for (const [c, n] of freq) {
    if (n > bestN || (n === bestN && c > best)) {
      best = c;
      bestN = n;
    }
  }
  // محافظ: عدد بی‌معنی نباید وارد ریشه شود.
  return Math.min(288, Math.max(12, best));
}

/**
 * انحراف معیار بازده‌های ۵ دقیقه‌ای، مقیاس‌شده به یک روز معاملاتی.
 *
 * ⚠️ **ریشه‌ی مقیاس، تعداد کندل واقعی است نه ۲۸۸.** نسخه‌ی قبلی همیشه
 * `√288` می‌زد، یعنی فرض می‌کرد هر دارایی ۲۴ ساعت معامله می‌شود. برای
 * کریپتو درست بود، ولی سهام فقط ۷۸ کندل در روز دارد و نوسانش
 * `√(288/78) = ۱.۹۲` برابر **بزرگ‌تر از واقعیت** گزارش می‌شد.
 *
 * پیامدش مستقیم روی امتیاز بود: ضریب نوسانِ باد‌کرده یعنی آستانه‌های دو
 * برابر گشادتر، و امید امتیازِ یک بازیکنِ بی‌مهارت روی سهام از ۴.۶−
 * می‌رفت به حدود ۲۰+. یعنی هر ده سهم فهرست، مزرعه‌ی امتیاز بودند.
 *
 * با داده‌ی واقعی یاهو سنجیده شد: AAPL اریب ×۱.۹۲ · BTC ×۱.۰۰ ·
 * EURUSD ×۱.۰۶ · طلا ×۱.۰۸.
 */
function dailyVol(points: MarketPoint[]): number | null {
  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].p;
    const b = points[i].p;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 24) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const varr = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const n = barsPerDay(points);
  return Math.round(Math.sqrt(varr) * Math.sqrt(n) * 100 * 1000) / 1000;
}

async function fetchYahoo(def: AssetDef): Promise<MarketData> {
  const sym = encodeURIComponent(def.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=5m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error("yahoo empty");

  const ts: number[] = r?.timestamp ?? [];
  const rawCloses: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];

  const full = ts
    .map((t, i) => ({ t, p: rawCloses[i] }))
    .filter((x): x is MarketPoint => typeof x.p === "number");

  // نوسان از کل پنجره‌ی ۵ روزه، ولی نمودار فقط آخرین روز را نشان می‌دهد
  const vol = dailyVol(full);
  const series = full.slice(-288);

  const price: number | null =
    r?.meta?.regularMarketPrice ?? series[series.length - 1]?.p ?? null;
  const prev: number | null =
    r?.meta?.chartPreviousClose ?? series[0]?.p ?? null;
  const changePct =
    price != null && prev != null && prev !== 0
      ? ((price - prev) / prev) * 100
      : null;

  return {
    asset: def.id,
    label: def.label,
    category: def.category,
    decimals: def.decimals,
    price,
    changePct,
    series,
    dailyVolPct: vol,
    marketState: r?.meta?.marketState ?? null,
    updatedAt: Date.now(),
  };
}

export async function getMarket(asset: Asset): Promise<MarketData> {
  const def = assetById(asset);
  if (!def) {
    return {
      asset,
      label: asset,
      category: "crypto",
      decimals: 2,
      price: null,
      changePct: null,
      series: [],
      dailyVolPct: null,
      marketState: null,
      updatedAt: Date.now(),
    };
  }

  const hit = cache.get(asset);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  try {
    const data = await fetchYahoo(def);
    cache.set(asset, { data, ts: Date.now() });
    return data;
  } catch {
    if (hit) return hit.data;
    return {
      asset: def.id,
      label: def.label,
      category: def.category,
      decimals: def.decimals,
      price: null,
      changePct: null,
      series: [],
      dailyVolPct: null,
      marketState: null,
      updatedAt: Date.now(),
    };
  }
}

/** چند دارایی به‌صورت موازی — برای فهرست کتگوری. */
export async function getMarkets(assets: Asset[]): Promise<MarketData[]> {
  return Promise.all(assets.map((a) => getMarket(a)));
}

/** آیا بازار این دارایی الان باز است؟ ترکیب تقویم و وضعیت یاهو. */
export function isMarketOpen(data: MarketData): boolean {
  const def = assetById(data.asset);
  if (!def) return false;
  if (def.category === "crypto") return true;
  if (data.marketState && data.marketState !== "REGULAR") return false;
  return isLikelyOpen(def.category);
}
