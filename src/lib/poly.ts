// ترید پیش‌بینی رویدادها — دیتای بازار از Gamma API پالی‌مارکت، سمت سرور.
// امتیازدهی صفر-انتظار (zero-EV): برد = +(۱۰۰−احتمال٪)، باخت = −(احتمال٪).
// یعنی فقط «بهتر از بازار فهمیدن» امتیاز مثبت می‌سازد — مهارت، نه شانس.

import { db } from "@/lib/db";
import { queueNotify, ensureOutboxTable } from "@/lib/notify-outbox";
import { tradeSettledMessage } from "@/lib/settle-messages";
import { winPoints, losePoints } from "@/lib/poly-scoring";

export const POLY_FREE_PER_DAY = 5; // پیش‌بینی رایگان روزانه
export const POLY_EXTRA_COST = 1; // هزینه‌ی هر پیش‌بینی اضافه (MOON)

const UA = { "User-Agent": "Mozilla/5.0" };

/**
 * عنوان‌های قالبیِ پر‌نشده‌ی پالی‌مارکت.
 *
 * دو یا چند زیرخط پشت‌سرهم (`__`, `___`) و برچسب‌های ژنریک مثل `Company A`
 * یا `Team B` نشانه‌ی قالبی‌اند که مقدارش جا نیفتاده.
 */
const PLACEHOLDER = /__|\b(Company|Team|Player|Candidate|Option) [A-Z]\b/;

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
  startDate: string; // برای مرتب‌سازی جدیدترین‌ها
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

// از فایل مستقل می‌آید تا کلاینت هم بتواند همان فرمول را نشان بدهد.
export { winPoints, losePoints };

// ── curated markets cache ──────────────────────────────────────
let marketsCache: { data: PolyMarket[]; ts: number } | null = null;
const MARKETS_TTL = 5 * 60 * 1000;

// ── حالت توسعه ──────────────────────────────────────────────
//
// پالی‌مارکت از شبکه‌ی داخل ایران در دسترس نیست، پس روی لوکال هر درخواست
// تا تایم‌اوت پیش می‌رود (~۱۰ ثانیه) و لیست خالی برمی‌گردد — کار روی رابط
// کاربری را عملا غیرممکن می‌کند.
//
// با NEXT_PUBLIC_DEV_FIXTURES=1 در .env.local، به‌جای درخواست شبکه
// داده‌ی نمونه برگردانده می‌شود. در تولید هرگز فعال نیست چون متغیر ست نمی‌شود.
const USE_FIXTURES = process.env.NEXT_PUBLIC_DEV_FIXTURES === "1";

const FIXTURE_MARKETS: PolyMarket[] = [
  ["نمونه: بیت‌کوین تا پایان سال بالای ۱۰۰ هزار دلار؟", "Crypto Milestones", 42.9, 12_400_000, "crypto"],
  ["نمونه: فدرال رزرو در نشست بعدی نرخ را کاهش می‌دهد؟", "Fed Decisions", 63.1, 8_900_000, "economy"],
  ["نمونه: اتریوم تا پایان فصل از ۵ هزار دلار عبور می‌کند؟", "Crypto Milestones", 28.4, 5_600_000, "crypto"],
  ["نمونه: قهرمان جام جهانی از اروپا خواهد بود؟", "World Cup", 71.2, 24_000_000, "sports"],
  ["نمونه: طلا تا پایان ماه رکورد جدید می‌زند؟", "Commodities", 35.8, 3_200_000, "economy"],
  ["نمونه: توافق تجاری تا پایان سال امضا می‌شود؟", "Geopolitics", 47.5, 6_100_000, "politics"],
  ["نمونه: سولانا وارد سه رمزارز برتر می‌شود؟", "Crypto Rankings", 18.9, 2_800_000, "crypto"],
  ["نمونه: نرخ تورم آمریکا زیر ۳ درصد بسته می‌شود؟", "Inflation", 55.3, 4_700_000, "economy"],
].map(([q, ev, yes, vol, cat], i) => {
  const end = new Date(Date.now() + (30 + i * 15) * 86400000).toISOString();
  return {
    id: `fixture-${i + 1}`,
    question: q as string,
    eventTitle: ev as string,
    endDate: end,
    yesPct: yes as number,
    volume: vol as number,
    category: cat as string,
    categoryLabel: CATS.find((c) => c.id === cat)?.label ?? "سایر",
    startDate: new Date(Date.now() - 20 * 86400000).toISOString(),
    yesToken: "",
  };
});

export async function getCuratedMarkets(): Promise<PolyMarket[]> {
  if (USE_FIXTURES) return FIXTURE_MARKETS;
  if (marketsCache && Date.now() - marketsCache.ts < MARKETS_TTL) {
    return marketsCache.data;
  }
  try {
    // برای پوشش همه‌ی کتگوری‌ها، علاوه بر پرحجم‌ترین‌های کلی،
    // هر کتگوری را جداگانه با tag_slug از Gamma می‌کشیم و ادغام می‌کنیم.
    // پرحجم‌ترین‌ها + جدیدترین‌ها + پوشش تک‌تک کتگوری‌ها
    // حداقل حجم استخر. بازار با نقدینگی نزدیک صفر (مثل «نتیجه‌ی دقیق» یک
    // مسابقه‌ی ناشناخته) درصدش معنا ندارد: با چند دلار جابه‌جا می‌شود، پس نه
    // سیگنالی در آن هست و نه امتیازی که از آن دربیاید ارزش دارد. این‌ها فهرست
    // را شلوغ می‌کردند و کاربر چالش پراپ را وادار می‌کردند بین نویز بگردد.
    const MIN_VOLUME_USD = 10_000;

    // افق زمانی. قبلا فهرست عملا به بازارهای نزدیک محدود می‌شد و کسی که در
    // چالش ۳۰ روزه است، انتخاب کافی نداشت. حالا تا ۶ ماه آینده هم واکشی
    // می‌شود تا تنوع برای بازه‌ی چالش کافی باشد.
    const MAX_HORIZON_MS = 6 * 30 * 24 * 3600_000;

    const sources: { slug: string; limit: number; order?: string }[] = [
      { slug: "", limit: 40 },
      { slug: "", limit: 40, order: "startDate" }, // تازه‌ترین بازارها
      { slug: "crypto", limit: 20 },
      { slug: "politics", limit: 20 },
      { slug: "sports", limit: 20 },
      { slug: "finance", limit: 20 },
      { slug: "tech", limit: 20 },
      { slug: "geopolitics", limit: 20 },
      { slug: "business", limit: 15 },
      { slug: "science", limit: 15 },
      { slug: "esports", limit: 15 },
      { slug: "pop-culture", limit: 15 },
      { slug: "elections", limit: 15 },
      { slug: "world-cup", limit: 15 },
      { slug: "weather", limit: 10 },
      { slug: "ai", limit: 10 },
    ];
    const results = await Promise.all(
      sources.map((src) =>
        fetch(
          `${GAMMA}/events?limit=${src.limit}&active=true&closed=false&order=${src.order ?? "volume"}&ascending=false${src.slug ? `&tag_slug=${src.slug}` : ""}`,
          { headers: UA, cache: "no-store", signal: AbortSignal.timeout(8000) }
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

        // حجم روی خودِ رویداد است، نه تک‌تک بازارها؛ همان چیزی که در فهرست
        // هم نشان داده می‌شود.
        const vol = Number(ev.volume) || 0;
        if (vol < MIN_VOLUME_USD) continue;

        // بازارِ بسته یا تسویه‌شده اصلا وارد فهرست نمی‌شود.
        if (m?.closed || m?.archived || ev?.closed) continue;

        // سررسیدِ گذشته یا دورتر از افق: اولی مرده است، دومی برای چالش
        // ۳۰ روزه بی‌فایده و برای فهرست فقط اشغال جا.
        const endRaw = String(m.endDate ?? ev.endDate ?? "");
        const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
        if (Number.isFinite(endMs)) {
          const dt = endMs - Date.now();
          if (dt <= 0 || dt > MAX_HORIZON_MS) continue;
        }

        const q = String(m.question ?? "").trim();
        if (!q || seen.has(q)) continue;
        // بازارهای قالبیِ پالی‌مارکت که جای‌نگهدارشان پر نشده.
        //
        // نمونه‌های واقعی که به کاربر رسیده بودند: «آیا ارزش‌گذاری Anthropic
        // تا ۳۱ دسامبر به __ خواهد رسید؟» و «آیا Company A بزرگ‌ترین شرکت
        // جهان می‌شود؟». اینها ایرادِ ترجمه نیستند — خودِ عنوان مبدأ ناقص
        // است و ترجمه فقط وفادارانه ناقص بودنش را منتقل می‌کند. بازاری که
        // پرسشش معلوم نیست، پیش‌بینی‌شدنی هم نیست.
        if (PLACEHOLDER.test(q)) continue;
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
          startDate: String(m.startDate ?? ev.startDate ?? ev.createdAt ?? ""),
          yesPct: Math.round(yes * 1000) / 10,
          volume: Number(ev.volume) || 0,
          category: cat.id,
          categoryLabel: cat.label,
          yesToken,
        });
        perEvent++;
        if (perEvent >= 6) break;
        if (out.length >= 400) break;
      }
      if (out.length >= 400) break;
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
        // امتیاز اعشاری — دلیلش در بلوک اسکیمای db.ts نوشته شده.
        .then(() =>
          pool.query(
            "ALTER TABLE poly_predictions ALTER COLUMN points TYPE NUMERIC(14,4)"
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

  // ⚠️ پیش از هر ترنزاکشن: DDL داخل ترنزاکشنِ قفل‌دار خطرناک است.
  await ensureOutboxTable();

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
          question: string;
        }>(
          `SELECT id, player_id, choice, prob, question FROM poly_predictions
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

          // ⚠️ داخل همان ترنزاکشن: اگر تسویه برگردد، اعلان هم برمی‌گردد.
          // `queueNotify` خودش SAVEPOINT دارد، پس شکستش امتیازِ ثبت‌شده را
          // باطل نمی‌کند.
          const { text, buttons } = tradeSettledMessage({
            marketId: String(market_id),
            question: p.question ?? "",
            side: p.choice === "yes" ? "yes" : "no",
            won,
            points,
            probPct,
          });
          await queueNotify(client, {
            playerId: p.player_id,
            kind: "trade_settled",
            ref: String(p.id),
            text,
            buttons,
          });
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

export type HistoryInterval = "1d" | "1w" | "1m" | "max";
const FIDELITY: Record<HistoryInterval, number> = {
  "1d": 10,
  "1w": 60,
  "1m": 240,
  max: 720,
};

export async function getMarketHistory(
  marketId: string,
  interval: HistoryInterval = "1w"
): Promise<PricePoint[]> {
  const key = `${marketId}:${interval}`;
  const hit = histCache.get(key);
  if (hit && Date.now() - hit.ts < HIST_TTL) return hit.data;

  const markets = await getCuratedMarkets();
  const m = findMarket(markets, marketId);
  if (!m || !m.yesToken) return hit?.data ?? [];

  try {
    const res = await fetch(
      `https://clob.polymarket.com/prices-history?market=${m.yesToken}&interval=${interval}&fidelity=${FIDELITY[interval]}`,
      { headers: UA, cache: "no-store" }
    );
    if (!res.ok) return hit?.data ?? [];
    const j = await res.json();
    const raw = Array.isArray(j?.history) ? j.history : [];
    const data: PricePoint[] = raw
      .map((r: { t?: number; p?: number }) => ({ t: Number(r.t) || 0, p: Number(r.p) || 0 }))
      .filter((r: PricePoint) => r.t > 0);
    if (data.length) histCache.set(key, { data, ts: Date.now() });
    return data.length ? data : (hit?.data ?? []);
  } catch {
    return hit?.data ?? [];
  }
}
