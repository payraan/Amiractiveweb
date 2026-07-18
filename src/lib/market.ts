// Server-side market data service for the prediction game.
// Prices are fetched by OUR server (Railway), so Iranian visitors
// never need direct access to the upstream sources.

export type Asset = "BTC" | "XAU";

export type MarketPoint = { t: number; p: number };

export type MarketData = {
  asset: Asset;
  price: number | null;
  changePct: number | null;
  series: MarketPoint[];
  updatedAt: number;
};

const TTL_MS = 60_000;
const cache = new Map<Asset, { data: MarketData; ts: number }>();

const YAHOO_SYMBOL: Record<Asset, string> = {
  BTC: "BTC-USD",
  XAU: "GC=F",
};

async function fetchYahoo(asset: Asset): Promise<MarketData> {
  const sym = encodeURIComponent(YAHOO_SYMBOL[asset]);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=5m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
  const series = ts
    .map((t, i) => ({ t, p: closes[i] }))
    .filter((x): x is MarketPoint => typeof x.p === "number");
  const price: number | null =
    r?.meta?.regularMarketPrice ?? series[series.length - 1]?.p ?? null;
  const prev: number | null =
    r?.meta?.chartPreviousClose ?? series[0]?.p ?? null;
  const changePct =
    price != null && prev != null && prev !== 0
      ? ((price - prev) / prev) * 100
      : null;
  return { asset, price, changePct, series, updatedAt: Date.now() };
}

async function fetchCoinGeckoBtc(): Promise<number | null> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const j = await res.json();
  return typeof j?.bitcoin?.usd === "number" ? j.bitcoin.usd : null;
}

export async function getMarket(asset: Asset): Promise<MarketData> {
  const hit = cache.get(asset);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  let data: MarketData;
  try {
    data = await fetchYahoo(asset);
    if (asset === "BTC" && data.price == null) {
      data = { ...data, price: await fetchCoinGeckoBtc() };
    }
  } catch {
    if (asset === "BTC") {
      try {
        const p = await fetchCoinGeckoBtc();
        data = {
          asset,
          price: p,
          changePct: null,
          series: hit?.data.series ?? [],
          updatedAt: Date.now(),
        };
      } catch {
        data =
          hit?.data ?? {
            asset,
            price: null,
            changePct: null,
            series: [],
            updatedAt: Date.now(),
          };
      }
    } else {
      data =
        hit?.data ?? {
          asset,
          price: null,
          changePct: null,
          series: [],
          updatedAt: Date.now(),
        };
    }
  }

  cache.set(asset, { data, ts: Date.now() });
  return data;
}

export async function getAllMarket() {
  const [btc, xau] = await Promise.all([getMarket("BTC"), getMarket("XAU")]);
  return { btc, xau };
}
