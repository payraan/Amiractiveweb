import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// پروب موقت: بررسی پوشش یاهو برای چهار کتگوری + تخمین نوسان هر دارایی.
// GET /api/predict/yf-probe با هدر x-settle-key

const SYMBOLS: { sym: string; cat: string }[] = [
  { sym: "BTC-USD", cat: "crypto" },
  { sym: "ETH-USD", cat: "crypto" },
  { sym: "SOL-USD", cat: "crypto" },
  { sym: "DOGE-USD", cat: "crypto" },
  { sym: "EURUSD=X", cat: "forex" },
  { sym: "GBPUSD=X", cat: "forex" },
  { sym: "USDJPY=X", cat: "forex" },
  { sym: "GC=F", cat: "metal" },
  { sym: "SI=F", cat: "metal" },
  { sym: "HG=F", cat: "metal" },
  { sym: "PL=F", cat: "metal" },
  { sym: "AAPL", cat: "stock" },
  { sym: "NVDA", cat: "stock" },
  { sym: "TSLA", cat: "stock" },
];

type Row = {
  sym: string;
  cat: string;
  ok: boolean;
  price?: number | null;
  currency?: string;
  marketState?: string;
  points?: number;
  dailyVolPct?: number | null;
  error?: string;
};

/** انحراف معیار بازده‌های ۵ دقیقه‌ای، مقیاس‌شده به یک روز. */
function dailyVol(closes: number[]): number | null {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 12) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const varr =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(varr);
  // 288 بازه‌ی ۵ دقیقه‌ای در یک شبانه‌روز
  return Math.round(sd * Math.sqrt(288) * 100 * 1000) / 1000;
}

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rows: Row[] = await Promise.all(
    SYMBOLS.map(async ({ sym, cat }): Promise<Row> => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          sym
        )}?range=5d&interval=5m`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
        });
        if (!res.ok) return { sym, cat, ok: false, error: `http ${res.status}` };
        const j = await res.json();
        const r = j?.chart?.result?.[0];
        if (!r) return { sym, cat, ok: false, error: "no result" };
        const closes: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter(
          (x: unknown): x is number => typeof x === "number"
        );
        return {
          sym,
          cat,
          ok: true,
          price: r?.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null,
          currency: r?.meta?.currency,
          marketState: r?.meta?.marketState,
          points: closes.length,
          dailyVolPct: dailyVol(closes),
        };
      } catch (err) {
        return {
          sym,
          cat,
          ok: false,
          error: err instanceof Error ? err.message : "failed",
        };
      }
    })
  );

  const okCount = rows.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    tested: rows.length,
    succeeded: okCount,
    rows,
  });
}
