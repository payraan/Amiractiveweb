// Server-side OHLC (candlestick) data for the live charts.
// Fetched by our server so Iranian visitors never hit the upstream directly.

import type { Asset } from "@/lib/game";

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

const YF: Record<Asset, string> = { BTC: "BTC-USD", XAU: "GC=F" };

// interval → yahoo range+interval params
const PARAMS: Record<string, { range: string; interval: string }> = {
  "1h": { range: "5d", interval: "15m" },
  "4h": { range: "1mo", interval: "1h" },
  "12h": { range: "3mo", interval: "1h" },
  "24h": { range: "6mo", interval: "1d" },
};

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

  const sym = encodeURIComponent(YF[asset]);
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

    if (candles.length) {
      cache.set(key, { data: candles, ts: Date.now() });
      return candles;
    }
    if (hit) return hit.data;
    return [];
  } catch {
    if (hit) return hit.data;
    return [];
  }
}
