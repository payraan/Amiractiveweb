import { db } from "@/lib/db";
import { getMarket, type Asset } from "@/lib/market";

// Deadline is 21:00 Tehran = 17:30 UTC (Iran is UTC+3:30, no DST since 2022).
const CLOSE_UTC_H = 17;
const CLOSE_UTC_M = 30;

export type Round = {
  id: number;
  asset: Asset;
  round_date: string;
  close_at: string;
  settle_at: string;
  settle_price: number | null;
  status: string;
};

// The "game day" rolls over at the 17:30 UTC deadline. Before the deadline,
// today's round is open; after it, we belong to tomorrow's round.
function currentRoundDate(now = new Date()): string {
  const d = new Date(now);
  const past =
    d.getUTCHours() > CLOSE_UTC_H ||
    (d.getUTCHours() === CLOSE_UTC_H && d.getUTCMinutes() >= CLOSE_UTC_M);
  if (past) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function deadlinesFor(roundDate: string) {
  const close = new Date(`${roundDate}T00:00:00.000Z`);
  close.setUTCHours(CLOSE_UTC_H, CLOSE_UTC_M, 0, 0);
  const settle = new Date(close);
  settle.setUTCDate(settle.getUTCDate() + 1); // settle one day after close
  return { close_at: close.toISOString(), settle_at: settle.toISOString() };
}

/** Returns the open round for an asset, creating it if needed. */
export async function getOrCreateRound(asset: Asset): Promise<Round> {
  const pool = await db();
  const round_date = currentRoundDate();
  const { close_at, settle_at } = deadlinesFor(round_date);

  await pool.query(
    `INSERT INTO rounds (asset, round_date, close_at, settle_at, status)
     VALUES ($1, $2, $3, $4, 'open')
     ON CONFLICT (asset, round_date) DO NOTHING`,
    [asset, round_date, close_at, settle_at]
  );

  const { rows } = await pool.query<Round>(
    `SELECT id, asset, round_date, close_at, settle_at, settle_price, status
       FROM rounds WHERE asset = $1 AND round_date = $2`,
    [asset, round_date]
  );
  return rows[0];
}

/** True if the round's close time has passed. */
export function isClosed(round: Round, now = new Date()): boolean {
  return now.getTime() >= new Date(round.close_at).getTime();
}

/** Snapshot of the current market price, for reference display. */
export async function currentPrice(asset: Asset): Promise<number | null> {
  const m = await getMarket(asset);
  return m.price;
}
