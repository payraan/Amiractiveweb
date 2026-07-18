import { db } from "@/lib/db";
import { getMarket } from "@/lib/market";
import {
  nextClose,
  settleFor,
  tf,
  isAssetOpen,
  type Asset,
  type TimeframeId,
} from "@/lib/game";

export type Round = {
  id: number;
  asset: Asset;
  timeframe: TimeframeId;
  round_date: string;
  close_at: string;
  settle_at: string;
  settle_price: number | null;
  status: string;
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
  await pool.query(
    `INSERT INTO rounds (asset, timeframe, round_date, close_at, settle_at, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     ON CONFLICT (asset, timeframe, close_at) DO NOTHING`,
    [asset, timeframeId, round_date, close.toISOString(), settle.toISOString()]
  );

  const { rows } = await pool.query<Round>(
    `SELECT id, asset, timeframe, round_date, close_at, settle_at, settle_price, status
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
