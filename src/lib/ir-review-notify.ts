import { db } from "@/lib/db";
import { sendTelegram, escapeHtml, type InlineButton } from "@/lib/telegram";
import { broadcastAdmins } from "@/lib/broadcast";
import { IR_CATEGORIES } from "@/lib/ir-categories";

// ── اعلان بازار تازه به ادمین ────────────────────────────────
//
// چرا لازم است: بازارِ پیشنهادی تا تأیید انسانی منتشر نمی‌شود، و تنها راه
// دیدنش باز کردن پنل ادمین بود. یعنی اگر گرداننده پای سیستم نباشد، بازارِ
// کاربر ساعت‌ها — یا تا فردا — روی زمین می‌ماند. برای کاربری که تازه پول
// داده تا بازار بسازد، این بدترین اولین تجربه است.
//
// حالا ربات همان لحظه خبر می‌دهد و تأیید/رد با یک لمس از داخل چت انجام
// می‌شود.

/** شناسه‌ی کال‌بک — کوتاه، چون تلگرام سقف ۶۴ بایت دارد. */
export const IR_REVIEW = {
  approve: (id: number) => `ir:ok:${id}`,
  reject: (id: number) => `ir:no:${id}`,
} as const;

function categoryLabel(id: string): string {
  return IR_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** تاریخ و ساعت تهران — همان چیزی که ادمین باید بسنجد. */
function tehran(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * خبر دادن بازار تازه به همه‌ی ادمین‌ها.
 *
 * ⚠️ خطایش بلعیده می‌شود و به فراخوان برنمی‌گردد: نرسیدن اعلان نباید
 * ساختِ بازارِ کاربر را — که پول هم داده — خراب کند.
 */
export async function notifyAdminsNewMarket(marketId: number): Promise<void> {
  const admins = broadcastAdmins();
  if (!admins.length) return;

  const pool = await db();
  const r = await pool.query<{
    question: string;
    category: string;
    source_note: string;
    closes_at: string;
    fee_usdt: string;
    creator: string | null;
    handle: string | null;
  }>(
    `SELECT m.question, m.category, m.source_note, m.closes_at, m.fee_usdt,
            p.display_name AS creator, p.tg_handle AS handle
       FROM ir_markets m
       LEFT JOIN players p ON p.id = m.creator_id
      WHERE m.id=$1 AND m.status='pending'`,
    [marketId]
  );
  if (!r.rowCount) return;
  const m = r.rows[0];

  const text =
    `🆕 <b>بازار تازه در انتظار تأیید</b>\n\n` +
    `<b>${escapeHtml(m.question)}</b>\n\n` +
    `📁 دسته: ${escapeHtml(categoryLabel(m.category))}\n` +
    `⏰ بسته‌شدن: ${escapeHtml(tehran(m.closes_at))}\n` +
    `💰 کارمزد پرداختی: ${Number(m.fee_usdt)} تتر\n` +
    `👤 سازنده: ${escapeHtml(m.creator ?? "—")}` +
    (m.handle ? ` (@${escapeHtml(m.handle)})` : "") +
    `\n\n` +
    `📌 <b>منبع تسویه</b>\n${escapeHtml(m.source_note)}\n\n` +
    `<i>پیش از تأیید بسنج: سؤال دوحالته و بی‌ابهام است؟ منبع عمومی و ` +
    `قابل بررسی است؟ تاریخ مشخص است؟</i>`;

  const buttons: InlineButton[][] = [
    [
      { text: "✅ تأیید و انتشار", callback_data: IR_REVIEW.approve(marketId), style: "success" },
      { text: "❌ رد", callback_data: IR_REVIEW.reject(marketId), style: "danger" },
    ],
  ];

  for (const admin of admins) {
    // هر ادمین جدا؛ شکست یکی نباید بقیه را متوقف کند.
    try {
      await sendTelegram(admin, text, buttons);
    } catch {
      /* اعلان از دست رفت — بازار همچنان در پنل ادمین هست */
    }
  }
}
