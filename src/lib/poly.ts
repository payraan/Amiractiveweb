// آرنای پیش‌بینی رویدادها — دیتای بازار از Gamma API پالی‌مارکت، سمت سرور.
// امتیازدهی صفر-انتظار (zero-EV): برد = +(۱۰۰−احتمال٪)، باخت = −(احتمال٪).
// یعنی فقط «بهتر از بازار فهمیدن» امتیاز مثبت می‌سازد — مهارت، نه شانس.

import { db } from "@/lib/db";

export const POLY_FREE_PER_DAY = 5; // پیش‌بینی رایگان روزانه
export const POLY_EXTRA_COST = 1; // هزینه‌ی هر پیش‌بینی اضافه (کردیت)

const UA = { "User-Agent": "Mozilla/5.0" };
const GAMMA = "https://gamma-api.polymarket.com";

export type PolyMarket = {
  id: string;
  question: string;
  eventTitle: string;
  endDate: string;
  yesPct: number; // 0..100
  volume: number;
  category: string; // شناسه‌ی کتگوری
  categoryLabel: string;
  yesToken: string; // برای تاریخچه‌ی قیمت (سمت سرور)
};

// ── کتگوری‌ها: نگاشت تگ‌های پالی‌مارکت به دسته‌های فارسی ─────
const CATS: { id: string; label: string; match: string[] }[] = [
  { id: "crypto", label: "کریپتو", match: ["crypto", "bitcoin", "ethereum", "solana", "defi"] },
  { id: "politics", label: "سیاست", match: ["politic", "election", "president", "senate", "congress", "primaries", "trump", "government"] },
  { id: "sports", label: "ورزش", match: ["sport", "nba", "nfl", "mlb", "nhl", "soccer", "football", "epl", "ufc", "tennis", "olympic", "world-cup", "ballon"] },
  { id: "economy", label: "اقتصاد", match: ["finance", "econom", "fed", "rates", "inflation", "stock", "business", "earn"] },
  { id: "tech", label: "تکنولوژی", match: ["tech", "ai", "openai", "science", "space"] },
  { id: "geo", label: "ژئوپلیتیک", match: ["geopolit", "world", "israel", "russia", "ukraine", "china", "iran", "war", "nato", "middle-east"] },
];

export const CATEGORY_LIST: { id: string; label: string }[] = [
  { id: "all", label: "همه" },
  ...CATS.map((c) => ({ id: c.id, label: c.label })),
  { id: "other", label: "سایر" },
];

function categoryFor(slugs: string[]): { id: string; label: string } {
  const joined = slugs.join(" ");
  for (const c of CATS) {
    if (c.match.some((m) => joined.includes(m))) return { id: c.id, label: c.label };
  }
  return { id: "other", label: "سایر" };
}

export function winPoints(probPct: number): number {
  return Math.max(1, Math.round(100 - probPct));
}
export function losePoints(probPct: number): number {
  return -Math.max(1, Math.round(probPct));
}

// ── curated markets cache ──────────────────────────────────────
let marketsCache: { data: PolyMarket[]; ts: number } | null = null;
const MARKETS_TTL = 5 * 60 * 1000;

export async function getCuratedMarkets(): Promise<PolyMarket[]> {
  if (marketsCache && Date.now() - marketsCache.ts < MARKETS_TTL) {
    return marketsCache.data;
  }
  try {
    // برای پوشش همه‌ی کتگوری‌ها، علاوه بر پرحجم‌ترین‌های کلی،
    // هر کتگوری را جداگانه با tag_slug از Gamma می‌کشیم و ادغام می‌کنیم.
    const sources = [
      { slug: "", limit: 20 },
      { slug: "crypto", limit: 10 },
      { slug: "politics", limit: 10 },
      { slug: "sports", limit: 10 },
      { slug: "finance", limit: 10 },
      { slug: "tech", limit: 10 },
      { slug: "geopolitics", limit: 10 },
    ];
    const results = await Promise.all(
      sources.map((src) =>
        fetch(
          `${GAMMA}/events?limit=${src.limit}&active=true&closed=false&order=volume&ascending=false${src.slug ? `&tag_slug=${src.slug}` : ""}`,
          { headers: UA, cache: "no-store" }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventsById = new Map<string, any>();
    for (const arr of results) {
      if (!Array.isArray(arr)) continue;
      for (const ev of arr) {
        const id = String(ev?.id ?? "");
        if (id && !eventsById.has(id)) eventsById.set(id, ev);
      }
    }

    const out: PolyMarket[] = [];
    const seen = new Set<string>();

    for (const ev of eventsById.values()) {
      const markets = Array.isArray(ev?.markets) ? ev.markets : [];
      let perEvent = 0;
      for (const m of markets) {
        if (m?.closed) continue;
        let outcomes: string[] = [];
        let prices: number[] = [];
        try {
          outcomes = JSON.parse(m.outcomes ?? "[]");
          prices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(Number);
        } catch {
          continue;
        }
        if (outcomes.length !== 2 || outcomes[0] !== "Yes") continue;
        const yes = prices[0];
        if (!Number.isFinite(yes) || yes < 0.03 || yes > 0.97) continue;
        const q = String(m.question ?? "").trim();
        if (!q || seen.has(q)) continue;
        seen.add(q);
        const slugs: string[] = Array.isArray(ev.tags)
          ? ev.tags.map((t: { slug?: string }) => String(t?.slug ?? "").toLowerCase())
          : [];
        const cat = categoryFor(slugs);
        let yesToken = "";
        try {
          yesToken = String((JSON.parse(m.clobTokenIds ?? "[]") as string[])[0] ?? "");
        } catch {
          yesToken = "";
        }
        out.push({
          id: String(m.id),
          question: q,
          eventTitle: String(ev.title ?? ""),
          endDate: String(m.endDate ?? ev.endDate ?? ""),
          yesPct: Math.round(yes * 1000) / 10,
          volume: Number(ev.volume) || 0,
          category: cat.id,
          categoryLabel: cat.label,
          yesToken,
        });
        perEvent++;
        if (perEvent >= 3) break;
        if (out.length >= 60) break;
      }
      if (out.length >= 60) break;
    }

    out.sort((a, b) => b.volume - a.volume);

    if (out.length) {
      marketsCache = { data: out, ts: Date.now() };
      return out;
    }
    return marketsCache?.data ?? [];
  } catch {
    return marketsCache?.data ?? [];
  }
}

export function findMarket(markets: PolyMarket[], id: string): PolyMarket | null {
  return markets.find((m) => m.id === id) ?? null;
}

// ── tables ─────────────────────────────────────────────────────
let polyReady: Promise<void> | null = null;
export async function ensurePolyTables(): Promise<void> {
  if (!polyReady) {
    polyReady = db().then((pool) =>
      pool
        .query(
          `CREATE TABLE IF NOT EXISTS poly_predictions (
             id SERIAL PRIMARY KEY,
             player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
             market_id TEXT NOT NULL,
             question TEXT NOT NULL,
             choice TEXT NOT NULL,
             prob NUMERIC NOT NULL,
             charged INTEGER NOT NULL DEFAULT 0,
             points INTEGER,
             status TEXT NOT NULL DEFAULT 'open',
             created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
             UNIQUE (market_id, player_id)
           )`
        )
        .then(() =>
          pool.query(
            "ALTER TABLE poly_predictions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ"
          )
        )
        .then(() => undefined)
    );
  }
  return polyReady;
}

// ── settlement ─────────────────────────────────────────────────
// بازارهایی که پالی‌مارکت بسته و نتیجه‌شان قطعی شده را تسویه می‌کند.
export async function settlePolyDue(): Promise<{ settled: number }> {
  await ensurePolyTables();
  const pool = await db();

  const due = await pool.query<{ market_id: string }>(
    `SELECT DISTINCT market_id FROM poly_predictions WHERE status='open' LIMIT 15`
  );

  let settled = 0;
  for (const { market_id } of due.rows) {
    try {
      const res = await fetch(`${GAMMA}/markets/${market_id}`, {
        headers: UA,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const m = await res.json();
      if (!m?.closed) continue;

      let prices: number[] = [];
      try {
        prices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(Number);
      } catch {
        continue;
      }
      if (prices.length !== 2) continue;
      // بازار بسته ولی هنوز نتیجه قطعی نشده (قیمت وسط) → صبر
      if (prices[0] > 0.05 && prices[0] < 0.95) continue;
      const yesWon = prices[0] >= 0.95;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const preds = await client.query<{
          id: number;
          player_id: number;
          choice: string;
          prob: string;
        }>(
          `SELECT id, player_id, choice, prob FROM poly_predictions
            WHERE market_id=$1 AND status='open' FOR UPDATE`,
          [market_id]
        );
        for (const p of preds.rows) {
          const probPct = Number(p.prob) * 100;
          const won = (p.choice === "yes") === yesWon;
          const points = won ? winPoints(probPct) : losePoints(probPct);
          await client.query(
            `UPDATE poly_predictions SET points=$1, status='settled', settled_at=now() WHERE id=$2`,
            [points, p.id]
          );
          await client.query(
            `UPDATE players SET total_points = total_points + $1 WHERE id=$2`,
            [points, p.player_id]
          );
        }
        await client.query("COMMIT");
        settled++;
      } catch {
        await client.query("ROLLBACK").catch(() => {});
      } finally {
        client.release();
      }
    } catch {
      continue;
    }
  }
  return { settled };
}

// ── تاریخچه‌ی احتمال برای نمودار بازار ─────────────────────────
export type PricePoint = { t: number; p: number };
const histCache = new Map<string, { data: PricePoint[]; ts: number }>();
const HIST_TTL = 10 * 60 * 1000;

export async function getMarketHistory(marketId: string): Promise<PricePoint[]> {
  const hit = histCache.get(marketId);
  if (hit && Date.now() - hit.ts < HIST_TTL) return hit.data;

  const markets = await getCuratedMarkets();
  const m = findMarket(markets, marketId);
  if (!m || !m.yesToken) return hit?.data ?? [];

  try {
    const res = await fetch(
      `https://clob.polymarket.com/prices-history?market=${m.yesToken}&interval=1w&fidelity=120`,
      { headers: UA, cache: "no-store" }
    );
    if (!res.ok) return hit?.data ?? [];
    const j = await res.json();
    const raw = Array.isArray(j?.history) ? j.history : [];
    const data: PricePoint[] = raw
      .map((r: { t?: number; p?: number }) => ({ t: Number(r.t) || 0, p: Number(r.p) || 0 }))
      .filter((r: PricePoint) => r.t > 0);
    if (data.length) histCache.set(marketId, { data, ts: Date.now() });
    return data.length ? data : (hit?.data ?? []);
  } catch {
    return hit?.data ?? [];
  }
}
