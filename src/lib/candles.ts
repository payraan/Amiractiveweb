// Server-side OHLC (candlestick) data for the live charts.
// Fetched by our server so Iranian visitors never hit the upstream directly.

import type { Asset } from "@/lib/game";
import { assetById } from "@/lib/assets";

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

// نماد یاهو از کاتالوگ کامل دارایی‌ها می‌آید (همان منبعی که market.ts
// استفاده می‌کند). قبلا اینجا فقط BTC و XAU هارد‌کد شده بودند و برای بقیه
// undefined به URL می‌رفت، پس چارت ۴۰ دارایی از ۴۲ تا خالی می‌ماند.

// ═══ چرا کندل‌ها تجمیع می‌شوند ════════════════════════════════
//
// **یاهو کندل ۴ ساعته و ۱۲ ساعته ندارد.** بازه‌هایش ۱، ۵، ۱۵، ۳۰، ۶۰ و ۹۰
// دقیقه و روزانه است. پس برای این دو تایم‌فریم چاره‌ای جز ساختنشان نیست.
//
// دو تلاش قبلی همین‌جا شکست خورد:
//  ۱. هر دو `interval=1h` بودند و فقط `range` فرق داشت — یعنی عملا یک
//     نمودار با دو بازه‌ی زمانی.
//  ۲. ۱۲ ساعته به `90m` تغییر کرد. داده واقعا فرق می‌کرد، ولی **کندل ۶۰
//     دقیقه‌ای و ۹۰ دقیقه‌ای با چشم تفکیک‌ناپذیرند** و برچسب «12h candles»
//     همچنان دروغ بود.
//
// حالا کندل ساعتی گرفته و به سطل‌های ۴ و ۱۲ ساعته تبدیل می‌شود: باز = باز
// اولین، بسته = بسته آخرین، سقف و کف = بیشینه و کمینه‌ی بازه. این همان
// تعریف استاندارد است و نتیجه‌اش کندلی است که واقعا ۱۲ ساعت را نشان می‌دهد.
type Spec = { range: string; interval: string; bucketHours?: number };

const PARAMS: Record<string, Spec> = {
  "1h": { range: "5d", interval: "15m" },
  "4h": { range: "1mo", interval: "1h", bucketHours: 4 },
  // ۳ ماه داده‌ی ساعتی ≈ ۲۲۰۰ کندل ← حدود ۱۸۰ کندل ۱۲ ساعته.
  "12h": { range: "3mo", interval: "1h", bucketHours: 12 },
  "24h": { range: "6mo", interval: "1d" },
};

/**
 * کندل‌های ریز را به سطل‌های چندساعته تبدیل می‌کند.
 *
 * مرزها روی ساعت گرد می‌شوند (`floor` روی خودِ timestamp)، نه از اولین
 * کندلِ داده — وگرنه با هر بار واکشی، مرزها کمی جابه‌جا می‌شدند و نمودار
 * بین دو رفرش تکان می‌خورد.
 */
function bucket(candles: Candle[], hours: number): Candle[] {
  const size = hours * 3600;
  const out: Candle[] = [];
  for (const c of candles) {
    const t = Math.floor(c.time / size) * size;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
    }
  }
  return out;
}

const TTL_MS = 60_000;
const cache = new Map<string, { data: Candle[]; ts: number }>();

export async function getCandles(
  asset: Asset,
  interval: string
): Promise<Candle[]> {
  const p = PARAMS[interval] ?? PARAMS["4h"];
  const key = `${asset}:${interval}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  const def = assetById(asset);
  if (!def) return [];
  const sym = encodeURIComponent(def.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${p.range}&interval=${p.interval}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`yahoo ${res.status}`);
    const j = await res.json();
    const r = j?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const q = r?.indicators?.quote?.[0] ?? {};
    const o = q.open ?? [];
    const h = q.high ?? [];
    const l = q.low ?? [];
    const c = q.close ?? [];

    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (
        typeof o[i] === "number" &&
        typeof h[i] === "number" &&
        typeof l[i] === "number" &&
        typeof c[i] === "number"
      ) {
        candles.push({ time: ts[i], open: o[i], high: h[i], low: l[i], close: c[i] });
      }
    }

    const final = p.bucketHours ? bucket(candles, p.bucketHours) : candles;

    if (final.length) {
      cache.set(key, { data: final, ts: Date.now() });
      return final;
    }
    if (hit) return hit.data;
    return [];
  } catch {
    if (hit) return hit.data;
    return [];
  }
}
