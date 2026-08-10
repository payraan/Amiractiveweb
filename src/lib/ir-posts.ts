import { db } from "@/lib/db";
import { ensureIrTables, impliedPct } from "@/lib/iran";
import { editMarketPoll, sendMarketPoll, type PollMode } from "@/lib/telegram";

// کارت‌های منتشرشده‌ی بازار در کانال‌ها.
//
// ربات فقط پیامی را می‌تواند ویرایش کند که خودش فرستاده و chat_id و
// message_id‌اش را دارد. نسخه‌ی فوروارد‌شده پیام مستقلی است با مالک دیگر و
// از دسترس بیرون — به همین دلیل فقط پست‌های مستقیم اینجا ثبت می‌شوند.

export async function recordPost(
  marketId: number,
  chatId: string,
  messageId: number,
  yesPct: number
): Promise<void> {
  await ensureIrTables();
  const pool = await db();
  await pool.query(
    `INSERT INTO ir_market_posts (market_id, chat_id, message_id, last_yes_pct)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (chat_id, message_id) DO NOTHING`,
    [marketId, chatId, messageId, yesPct]
  );
}

/** انتشار یک بازار در کانال و ثبتش برای به‌روزرسانی بعدی. */
export async function postMarket(
  marketId: number,
  chatId: string,
  mode: PollMode
): Promise<{ ok: boolean; error?: string }> {
  await ensureIrTables();
  const pool = await db();
  const r = await pool.query(
    `SELECT id, question, category, status, yes_total, no_total, bettors, closes_at
       FROM ir_markets WHERE id=$1`,
    [marketId]
  );
  if (!r.rowCount) return { ok: false, error: "not_found" };
  const m = r.rows[0];
  if (m.status !== "open") return { ok: false, error: "market_not_open" };

  const yes = Number(m.yes_total);
  const no = Number(m.no_total);
  const yesPct = impliedPct(yes, no);

  const sent = await sendMarketPoll(
    chatId,
    {
      id: m.id,
      question: m.question,
      category: m.category,
      yesPct,
      bettors: m.bettors,
      volume: yes + no,
      closesAt: m.closes_at,
    },
    mode
  );
  if (!sent.ok || !sent.messageId) {
    return { ok: false, error: sent.error ?? "send_failed" };
  }

  // فقط کارت زنده ثبت می‌شود. کارت forward قرار است فوروارد شود و نسخه‌ی
  // فوروارد‌شده قابل ویرایش نیست، پس ثبتش فقط جدول را شلوغ می‌کند.
  if (mode === "live") {
    await recordPost(marketId, chatId, sent.messageId, yesPct);
  }
  return { ok: true };
}

/**
 * به‌روزرسانی همه‌ی کارت‌های زنده‌ای که عددشان عوض شده.
 *
 * فقط وقتی ویرایش می‌شود که درصد واقعا تغییر کرده باشد: تلگرام ویرایش با
 * محتوای یکسان را با خطای «message is not modified» رد می‌کند و سقف نرخ هم
 * دارد، پس فرستادن ویرایشِ بی‌تغییر هم بی‌فایده است هم پرهزینه.
 *
 * بازارهایی که دیگر باز نیستند از جدول پاک می‌شوند — کارتشان همان‌جا می‌ماند
 * ولی دیگر به‌روز نمی‌شود، چون شرط‌پذیر نیست.
 */
export async function refreshMarketPosts(): Promise<{
  checked: number;
  edited: number;
}> {
  await ensureIrTables();
  const pool = await db();

  const { rows } = await pool.query(
    `SELECT p.id, p.chat_id, p.message_id, p.last_yes_pct,
            m.id AS market_id, m.question, m.category, m.status,
            m.yes_total, m.no_total, m.bettors, m.closes_at
       FROM ir_market_posts p
       JOIN ir_markets m ON m.id = p.market_id
      ORDER BY p.id DESC
      LIMIT 200`
  );

  let edited = 0;
  for (const r of rows) {
    if (r.status !== "open") {
      await pool.query("DELETE FROM ir_market_posts WHERE id=$1", [r.id]);
      continue;
    }
    const yes = Number(r.yes_total);
    const no = Number(r.no_total);
    const yesPct = impliedPct(yes, no);
    if (r.last_yes_pct !== null && Number(r.last_yes_pct) === yesPct) continue;

    const res = await editMarketPoll(
      r.chat_id,
      Number(r.message_id),
      {
        id: r.market_id,
        question: r.question,
        category: r.category,
        yesPct,
        bettors: r.bettors,
        volume: yes + no,
        closesAt: r.closes_at,
      },
      "live"
    );
    if (res.ok) {
      await pool.query("UPDATE ir_market_posts SET last_yes_pct=$2 WHERE id=$1", [
        r.id,
        yesPct,
      ]);
      edited++;
    } else if (
      // پیام پاک شده یا ربات از کانال بیرون انداخته شده — ردیف بی‌مصرف است.
      /message to edit not found|chat not found|bot was kicked|not enough rights/i.test(
        res.error ?? ""
      )
    ) {
      await pool.query("DELETE FROM ir_market_posts WHERE id=$1", [r.id]);
    }
  }

  return { checked: rows.length, edited };
}
