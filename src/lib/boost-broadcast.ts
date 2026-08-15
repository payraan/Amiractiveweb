import { db } from "@/lib/db";
import { marketPoll } from "@/lib/telegram";
import { impliedPct } from "@/lib/iran";
import { createJob, startJob } from "@/lib/broadcast";

// ── پخش سراسری بازار بوست‌شده ────────────────────────────────
//
// چیزی که سازنده با بوست می‌خرد همین است: یک بار، بازارش به همه‌ی
// کاربران می‌رسد.
//
// ⚠️ کارت از همان `marketPoll` ساخته می‌شود که کارت کانال را می‌سازد — نه
// یک قالب دوم. دو قالب برای یک چیز یعنی روزی که درصدها در یکی به‌روز
// می‌شوند و در دیگری نه.
//
// ⚠️ کاور `file_id` تلگرام است، نه آدرس. تلگرام فایل خودش را بدون آپلود
// دوباره می‌فرستد، پس ۵۰ هزار پیام با کاور هیچ باری روی سرور ما نمی‌گذارد.
// با آدرس، تلگرام باید فایل را ۵۰ هزار بار از ما بگیرد.
//
// ── صف ──
// چند بوست هم‌زمان یعنی چند کار `running`. تیک کرون همیشه قدیمی‌ترین را
// برمی‌دارد، پس خودبه‌خود صف FIFO می‌شود و هیچ‌کدام گم نمی‌شود. با ۵۰ هزار
// کاربر هر پخش حدود نیم‌ساعت طول می‌کشد؛ این عدد را بدان چون سقفِ واقعیِ
// تعداد بوست در روز همین است، نه یک قاعده‌ی محصولی.

export type BoostBroadcastResult =
  | { ok: true; jobId: number; targets: number }
  | { ok: false; error: string };

export async function broadcastBoostedMarket(
  marketId: number,
  createdByTgId: number
): Promise<BoostBroadcastResult> {
  const pool = await db();
  const r = await pool.query<{
    id: number;
    question: string;
    category: string;
    status: string;
    yes_total: string;
    no_total: string;
    bettors: number;
    cover_file_id: string | null;
    closes_at: string;
  }>(
    `SELECT id, question, category, status, yes_total, no_total, bettors,
            cover_file_id, closes_at
       FROM ir_markets WHERE id=$1`,
    [marketId]
  );
  if (!r.rowCount) return { ok: false, error: "not_found" };
  const m = r.rows[0];
  if (m.status !== "open") return { ok: false, error: "market_not_open" };

  const yes = Number(m.yes_total);
  const no = Number(m.no_total);

  const { text, buttons } = marketPoll(
    {
      kind: "ir",
      id: m.id,
      question: m.question,
      category: m.category,
      yesPct: impliedPct(yes, no),
      volume: yes + no,
      bettors: m.bettors,
      closesAt: m.closes_at,
    },
    "forward"
  );
  // بدون BOT_USERNAME هیچ لینک عمیقی ساخته نمی‌شود و کارت بی‌دکمه می‌ماند —
  // پیامی که راه ادامه ندارد، از نفرستادنش بدتر است.
  if (!buttons.length) return { ok: false, error: "bot_not_configured" };

  const job = await createJob(
    createdByTgId,
    `⭐ <b>بازار ویژه</b>\n\n${text}`,
    m.cover_file_id,
    buttons
  );
  await startJob(job.id);
  return { ok: true, jobId: job.id, targets: job.total };
}
