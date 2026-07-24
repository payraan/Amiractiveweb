import { db } from "@/lib/db";
import { getMarket } from "@/lib/market";
import {
  nextClose,
  settleFor,
  tf,
  isAssetOpen,
  volScaleFor,
  type Asset,
  type TimeframeId,
} from "@/lib/game";

let volColumnReady: Promise<void> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureVolColumn(pool: any): Promise<void> {
  if (!volColumnReady) {
    volColumnReady = pool
      .query("ALTER TABLE rounds ADD COLUMN IF NOT EXISTS vol_scale NUMERIC")
      .then(() => undefined)
      .catch(() => undefined);
  }
  return volColumnReady as Promise<void>;
}

export type Round = {
  id: number;
  asset: Asset;
  timeframe: TimeframeId;
  round_date: string;
  close_at: string;
  settle_at: string;
  settle_price: number | null;
  status: string;
  vol_scale: string | number | null;
};

/** Get (or create) the currently-open round for an (asset, timeframe). */
export async function getOrCreateRound(
  asset: Asset,
  timeframeId: TimeframeId
): Promise<Round | null> {
  const t = tf(timeframeId);
  if (!t) return null;
  if (!isAssetOpen(asset)) return null; // gold weekend → no round

  const close = nextClose(t.hours);
  const settle = settleFor(close, t.hours);
  const round_date = close.toISOString().slice(0, 10);

  const pool = await db();
  await ensureVolColumn(pool);

  // ضریب نوسان در لحظه‌ی ساخت راند قفل می‌شود و تا تسویه عوض نمی‌شود.
  const m = await getMarket(asset);
  const volScale = volScaleFor(m.dailyVolPct);

  await pool.query(
    `INSERT INTO rounds (asset, timeframe, round_date, close_at, settle_at, status, vol_scale)
     VALUES ($1, $2, $3, $4, $5, 'open', $6)
     ON CONFLICT (asset, timeframe, close_at) DO NOTHING`,
    [
      asset,
      timeframeId,
      round_date,
      close.toISOString(),
      settle.toISOString(),
      volScale,
    ]
  );

  const { rows } = await pool.query<Round>(
    `SELECT id, asset, timeframe, round_date, close_at, settle_at, settle_price, status, vol_scale
       FROM rounds WHERE asset=$1 AND timeframe=$2 AND close_at=$3`,
    [asset, timeframeId, close.toISOString()]
  );
  return rows[0] ?? null;
}

export function isClosed(round: Round, now = new Date()): boolean {
  return now.getTime() >= new Date(round.close_at).getTime();
}

export async function currentPrice(asset: Asset): Promise<number | null> {
  const m = await getMarket(asset);
  return m.price;
}
