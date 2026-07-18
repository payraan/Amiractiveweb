import { db } from "@/lib/db";
import { getMarket } from "@/lib/market";
import { scoreFor, type Asset } from "@/lib/game";

// Settle every round whose settle_at has passed and isn't settled yet.
// Idempotent: only touches rounds with status='open' past settle_at.
export async function settleDueRounds(): Promise<{ settled: number; scored: number }> {
  const pool = await db();

  const due = await pool.query<{
    id: number;
    asset: Asset;
    timeframe: string;
  }>(
    `SELECT id, asset, timeframe
       FROM rounds
      WHERE status = 'open' AND settle_at <= now()
      ORDER BY settle_at ASC
      LIMIT 50`
  );

  let settled = 0;
  let scored = 0;

  // cache live prices per asset for this pass
  const priceCache = new Map<Asset, number | null>();
  const priceOf = async (asset: Asset) => {
    if (!priceCache.has(asset)) {
      const m = await getMarket(asset);
      priceCache.set(asset, m.price);
    }
    return priceCache.get(asset) ?? null;
  };

  for (const round of due.rows) {
    const settlePrice = await priceOf(round.asset);
    if (settlePrice == null || settlePrice <= 0) continue; // can't price → try next pass

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // re-check the round is still open (guard against concurrent settle)
      const lock = await client.query(
        `SELECT id FROM rounds WHERE id=$1 AND status='open' FOR UPDATE`,
        [round.id]
      );
      if (!lock.rowCount) {
        await client.query("ROLLBACK");
        continue;
      }

      // record the settle price + close the round
      await client.query(
        `UPDATE rounds SET settle_price=$1, status='settled' WHERE id=$2`,
        [settlePrice, round.id]
      );

      // score each prediction in this round
      const preds = await client.query<{
        id: number;
        player_id: number;
        guess: string;
      }>(`SELECT id, player_id, guess FROM predictions WHERE round_id=$1`, [round.id]);

      for (const p of preds.rows) {
        const guess = Number(p.guess);
        const errorPct = Math.abs((guess - settlePrice) / settlePrice) * 100;
        const points = scoreFor(errorPct, 1); // multiplier is 1 for all timeframes now

        await client.query(
          `UPDATE predictions SET error_pct=$1, points=$2 WHERE id=$3`,
          [errorPct, points, p.id]
        );
        await client.query(
          `UPDATE players SET total_points = total_points + $1 WHERE id=$2`,
          [points, p.player_id]
        );
        scored++;
      }

      await client.query("COMMIT");
      settled++;
    } catch {
      await client.query("ROLLBACK").catch(() => {});
    } finally {
      client.release();
    }
  }

  return { settled, scored };
}
