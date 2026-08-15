import { db } from "@/lib/db";
import { ensureIrTables, moveFunds, recordRevenue } from "@/lib/iran";

// ── بازبینی بازار: تأیید و رد ────────────────────────────────
//
// چرا اینجا و نه در روت ادمین: همین دو کار حالا از **دو جا** انجام
// می‌شوند — پنل ادمین و دکمه‌های ربات. رد کردن، پول برمی‌گرداند؛ دو
// پیاده‌سازی موازی روی مسیر پول یعنی روزی یکی از آن‌ها یک بررسی کمتر
// دارد، و همان یکی است که سوءاستفاده از آن می‌آید.

export type ModerationResult =
  | { ok: true }
  | { ok: false; error: "not_pending" | "server_error" };

/** تأیید و انتشار یک بازار در انتظار. */
export async function approveMarket(id: number): Promise<ModerationResult> {
  await ensureIrTables();
  const pool = await db();
  // شرط `status='pending'` داخل خودِ UPDATE است، نه یک چک جدا: دو لمس
  // هم‌زمان ادمین (یا ادمین و ربات با هم) فقط یکی‌شان سطر می‌گیرد.
  const r = await pool.query(
    "UPDATE ir_markets SET status='open' WHERE id=$1 AND status='pending' RETURNING id",
    [id]
  );
  return r.rowCount ? { ok: true } : { ok: false, error: "not_pending" };
}

/**
 * رد کردن پیشنهاد — کارمزد ساخت کامل به سازنده برمی‌گردد.
 *
 * ⚠️ سهم دمو از **دفترکل** خوانده می‌شود، نه حدس: پول باید دقیقا به همان
 * جیبی برگردد که از آن رفت، وگرنه یک برگشتِ ساده، پول دمو را بی‌سروصدا به
 * پول واقعیِ قابل‌برداشت تبدیل می‌کند.
 */
export async function rejectMarket(
  id: number,
  reason: string
): Promise<ModerationResult> {
  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query<{
      creator_id: number | null;
      fee_usdt: string;
    }>(
      `UPDATE ir_markets SET status='void', void_reason=$2
        WHERE id=$1 AND status='pending'
        RETURNING creator_id, fee_usdt`,
      [id, reason]
    );
    const row = upd.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_pending" };
    }

    if (row.creator_id && Number(row.fee_usdt) > 0) {
      await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
        row.creator_id,
      ]);
      const orig = await client.query<{ demo: string }>(
        `SELECT COALESCE(-SUM(demo), 0) AS demo FROM wallet_ledger
          WHERE player_id=$1 AND kind='ir_propose_fee' AND ref=$2`,
        [row.creator_id, `m${id}`]
      );
      const feeDemo = Math.min(
        Number(orig.rows[0]?.demo ?? 0),
        Number(row.fee_usdt)
      );
      await moveFunds(
        client,
        row.creator_id,
        Number(row.fee_usdt),
        "ir_propose_refund",
        `m${id}`,
        { creditDemo: feeDemo }
      );
      // برگشت، درآمد قبلی را خنثی می‌کند → سطر منفی
      await recordRevenue(client, "ir_propose_refund", -Number(row.fee_usdt), {
        marketId: id,
        playerId: row.creator_id,
        note: "بازار رد شد",
        demoAmount: feeDemo,
      });
    }

    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: "server_error" };
  } finally {
    client.release();
  }
}
