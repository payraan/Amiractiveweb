// کمبو — چند انتخاب در یک تیکت. برد فقط با درست‌بودن همه‌ی انتخاب‌ها.
// امتیازدهی صفر-انتظار: P = ضرب احتمال گزینه‌های انتخابی؛
// برد = ۱۰۰×n×(۱−P) ، باخت = −۱۰۰×n×P

import { db } from "@/lib/db";

export const COMBO_FREE_PER_DAY = 1;
export const COMBO_COST = 2; // MOON برای کمبوهای مازاد
export const COMBO_MIN_LEGS = 2;
export const COMBO_MAX_LEGS = 5;

// ── اهرم ────────────────────────────────────────────────────────
//
// اهرم هر دو سوی تیکت را به یک نسبت بزرگ می‌کند، پس امتیازدهی
// همچنان صفر-انتظار می‌ماند: با اهرم L، برد L برابر و باخت هم L برابر
// می‌شود. یعنی اهرم «مزیت» نمی‌خرد، فقط نوسان می‌خرد — و چون MOON
// هزینه دارد، خریدنش از نظر MOON منفی است. این عمدی است.
//
// به همین دلیل اهرم فقط در کمبو وجود دارد: کمبو از ارزیابی چلنج پراپ
// مستثناست و لیدربورد جدا دارد، پس عدالت مسیر پراپ و رتبه‌بندی اصلی
// دست‌نخورده می‌ماند.
export type LeverageTier = { x: number; cost: number; label: string };

export const LEVERAGE_TIERS: LeverageTier[] = [
  { x: 1, cost: 0, label: "بدون اهرم" },
  { x: 2, cost: 4, label: "۲ برابر" },
  { x: 3, cost: 9, label: "۳ برابر" },
  { x: 5, cost: 20, label: "۵ برابر" },
];

/** اهرم معتبر یا ۱. هزینه‌ی همان پله را هم برمی‌گرداند. */
export function leverageFor(x: unknown): LeverageTier {
  const n = Number(x);
  return LEVERAGE_TIERS.find((t) => t.x === n) ?? LEVERAGE_TIERS[0];
}

const UA = { "User-Agent": "Mozilla/5.0" };
const GAMMA = "https://gamma-api.polymarket.com";

// بدون گرد کردن — همان دلیل poly-scoring.ts، ولی اینجا سوگیری در اهرم هم ضرب
// می‌شد، پس تا ۰.۵×اهرم امتیاز مجانی می‌داد.
export function comboWin(n: number, prob: number, lev = 1): number {
  return 100 * n * (1 - prob) * lev;
}
export function comboLose(n: number, prob: number, lev = 1): number {
  return -100 * n * prob * lev;
}

// ── tables ─────────────────────────────────────────────────────
let ready: Promise<void> | null = null;
export async function ensureComboTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS combo_tickets (
           id SERIAL PRIMARY KEY,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           prob NUMERIC NOT NULL,
           legs_count INTEGER NOT NULL,
           charged INTEGER NOT NULL DEFAULT 0,
           points INTEGER,
           status TEXT NOT NULL DEFAULT 'open',
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           settled_at TIMESTAMPTZ
         )`
      );
      await pool.query(
        "ALTER TABLE combo_tickets ADD COLUMN IF NOT EXISTS leverage INTEGER NOT NULL DEFAULT 1"
      );
      // امتیاز اعشاری — دلیلش در بلوک اسکیمای db.ts نوشته شده.
      await pool.query(
        "ALTER TABLE combo_tickets ALTER COLUMN points TYPE NUMERIC(14,4)"
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS combo_legs (
           id SERIAL PRIMARY KEY,
           ticket_id INTEGER NOT NULL REFERENCES combo_tickets(id) ON DELETE CASCADE,
           market_id TEXT NOT NULL,
           question TEXT NOT NULL,
           choice TEXT NOT NULL,
           prob NUMERIC NOT NULL,
           result TEXT
         )`
      );
    });
  }
  return ready;
}

// ── settlement ─────────────────────────────────────────────────
export async function settleCombosDue(): Promise<{ settled: number }> {
  await ensureComboTables();
  const pool = await db();

  // ۱) نتیجه‌ی پاهای باز را از بازارهای بسته‌شده بگیر
  const due = await pool.query<{ market_id: string }>(
    `SELECT DISTINCT l.market_id
       FROM combo_legs l
       JOIN combo_tickets t ON t.id = l.ticket_id
      WHERE t.status = 'open' AND l.result IS NULL
      LIMIT 15`
  );

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
      if (prices[0] > 0.05 && prices[0] < 0.95) continue;
      const winner = prices[0] >= 0.95 ? "yes" : "no";

      await pool.query(
        `UPDATE combo_legs
            SET result = CASE WHEN choice = $2 THEN 'won' ELSE 'lost' END
          WHERE market_id = $1 AND result IS NULL`,
        [market_id, winner]
      );
    } catch {
      continue;
    }
  }

  // ۲) تیکت‌هایی که تکلیفشان روشن شده را تسویه کن
  const tickets = await pool.query<{
    id: number;
    player_id: number;
    prob: string;
    leverage: number;
    legs_count: number;
    any_lost: boolean;
    all_won: boolean;
  }>(
    `SELECT t.id, t.player_id, t.prob, t.legs_count, t.leverage,
            bool_or(l.result = 'lost') AS any_lost,
            bool_and(l.result = 'won') AS all_won
       FROM combo_tickets t
       JOIN combo_legs l ON l.ticket_id = t.id
      WHERE t.status = 'open'
      GROUP BY t.id
      LIMIT 50`
  );

  let settled = 0;
  for (const t of tickets.rows) {
    if (!t.any_lost && !t.all_won) continue; // هنوز پای باز دارد
    const prob = Number(t.prob);
    const lev = Number(t.leverage) || 1;
    const points = t.any_lost
      ? comboLose(t.legs_count, prob, lev)
      : comboWin(t.legs_count, prob, lev);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lock = await client.query(
        `SELECT id FROM combo_tickets WHERE id=$1 AND status='open' FOR UPDATE`,
        [t.id]
      );
      if (!lock.rowCount) {
        await client.query("ROLLBACK");
        continue;
      }
      await client.query(
        `UPDATE combo_tickets
            SET points=$1, status='settled', settled_at=now()
          WHERE id=$2`,
        [points, t.id]
      );
      await client.query(
        `UPDATE players SET total_points = total_points + $1 WHERE id=$2`,
        [points, t.player_id]
      );
      await client.query("COMMIT");
      settled++;
    } catch {
      await client.query("ROLLBACK").catch(() => {});
    } finally {
      client.release();
    }
  }

  return { settled };
}
