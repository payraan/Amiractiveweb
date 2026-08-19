import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { sendTelegram, escapeHtml, type InlineButton } from "@/lib/telegram";
import { broadcastAdmins } from "@/lib/broadcast";
import { IR_CATEGORIES } from "@/lib/ir-categories";

// ── یادآوری پیش از بسته‌شدن بازار ────────────────────────────
//
// ── چرا این ماژول وجود دارد ──
// `closes_at` را سازنده در لحظه‌ی ساخت انتخاب می‌کند و بعدش قابل تغییر
// نیست. ولی وقتی درست است که بازار بسته شود، به **نوع** بازار بستگی دارد:
//
//   • نتیجه‌ی یک بازی فوتبال باید پیش از سوت آغاز بسته شود، نه بعدش.
//   • بازاری که نتیجه‌اش از یک روز قبل عملا معلوم می‌شود، باید همان‌جا
//     بسته شود، وگرنه کسی که خبر را زودتر دیده روی نتیجه‌ی معلوم شرط
//     می‌بندد و از استخر بقیه برمی‌دارد.
//
// تا امروز تنها راه، رسیدنِ خودِ `closes_at` بود و گرداننده هیچ هشداری
// نمی‌گرفت. حالا ربات پیش از موعد خبر می‌دهد و بستنِ زودهنگام یک لمس است.
//
// ── چرا دو مرحله ──
// یک یادآوری تنها، اگر در ساعتی برسد که گرداننده پای گوشی نیست، از دست
// می‌رود. ۴۸ ساعت فرصت تصمیم می‌دهد و ۲۴ ساعت آخرین فرصت است.
//
// ⚠️ هیچ‌کدام از این‌ها بازار را **خودکار** نمی‌بندد. بستنِ خودکارِ زودهنگام
// یعنی پول کاربر بر اساس حدسِ ما قفل شود؛ آن تصمیم انسانی است.

/** آستانه‌های یادآوری، از دور به نزدیک. ساعت. */
const STAGES = [48, 24] as const;

/** نزدیک‌ترین آستانه — بعد از این، دیگر یادآوری‌ای نمانده. */
const LAST_STAGE = STAGES[STAGES.length - 1];

/**
 * آیا خبرِ این آستانه (یا آستانه‌ای نزدیک‌تر) قبلا رفته؟
 *
 * ⚠️ **آستانه‌ها نزولی‌اند و این تله‌ی اصلی همین‌جاست.** ستون
 * `close_notice_stage` کوچک‌ترین آستانه‌ای را نگه می‌دارد که خبرش رفته، پس
 * مقدارش ۴۸ ← ۲۴ حرکت می‌کند، یعنی **کاهشی**. مقایسه‌ی ساده‌ی `stored <
 * stage` — که شهودی به نظر می‌رسد — بازاری را که خبر ۴۸ ساعتش رفته برای
 * همیشه کنار می‌گذارد و خبر ۲۴ ساعت هرگز نمی‌رود. این را تست گرفت، نه
 * خواندنِ کد.
 *
 * صفر یعنی هنوز هیچ خبری نرفته.
 */
function alreadyNotified(stored: number, stage: number): boolean {
  return stored !== 0 && stored <= stage;
}

/** شناسه‌ی کال‌بک — کوتاه، چون تلگرام سقف ۶۴ بایت دارد. */
export const IR_CLOSE = {
  lock: (id: number) => `ir:lk:${id}`,
} as const;

function categoryLabel(id: string): string {
  return IR_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** تاریخ و ساعت تهران — همان چیزی که گرداننده باید بسنجد. */
function tehran(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const fa = (n: number) => n.toLocaleString("fa-IR");

export type CloseReminderResult = {
  checked: number;
  notified: number;
  errors: number;
};

/**
 * بازارهای بازی که به مهلتشان نزدیک شده‌اند را پیدا می‌کند و به ادمین‌ها
 * خبر می‌دهد. روی همان کرون تسویه سوار است.
 *
 * ⚠️ **ادعای مرحله اتمیک است.** مرحله با همان `UPDATE … RETURNING` گرفته
 * می‌شود که خبر را مجاز می‌کند، پس دو تیک هم‌زمان (یا کرون و زنجیره‌ی پخش
 * با هم) دو بار خبر نمی‌دهند. الگویش همان `claimConfirmedFlow` است.
 *
 * ⚠️ **بالاترین مرحله‌ی سررسیده انتخاب می‌شود، نه مرحله‌ی بعدی.** بازاری که
 * با مهلت ۱۲ ساعته تأیید شود هرگز به آستانه‌ی ۴۸ نمی‌رسد؛ اگر مرحله‌به‌مرحله
 * جلو می‌رفتیم، اول یک خبر بی‌معنیِ «۴۸ ساعت مانده» می‌رفت و خبر واقعیِ ۲۴
 * ساعت یک تیک بعد. حالا مستقیم همان ۲۴ ثبت و ارسال می‌شود.
 */
export async function remindClosingMarkets(): Promise<CloseReminderResult> {
  const out: CloseReminderResult = { checked: 0, notified: 0, errors: 0 };

  const admins = broadcastAdmins();
  if (!admins.length) return out;

  const pool = await db();

  // بزرگ‌ترین آستانه فیلتر اولیه است؛ تصمیم واقعی داخل ادعای اتمیک گرفته
  // می‌شود. اندیس `ir_markets_closing` دقیقا برای همین کوئری است.
  const due = await pool.query<{
    id: number;
    question: string;
    category: string;
    source_note: string;
    closes_at: string;
    yes_total: string;
    no_total: string;
    bettors: number;
    close_notice_stage: number;
    hours_left: string;
  }>(
    `SELECT id, question, category, source_note, closes_at,
            yes_total, no_total, bettors, close_notice_stage,
            (EXTRACT(EPOCH FROM (closes_at - now())) / 3600)::text AS hours_left
       FROM ir_markets
      WHERE status='open'
        AND closes_at > now()
        AND closes_at <= now() + ($1 || ' hours')::interval
        AND close_notice_stage <> $2
      ORDER BY closes_at ASC
      LIMIT 20`,
    [String(STAGES[0]), LAST_STAGE]
  );

  out.checked = due.rowCount ?? 0;

  for (const m of due.rows) {
    const hoursLeft = Number(m.hours_left);

    // کوچک‌ترین آستانه‌ای که سررسیده — یعنی نزدیک‌ترین حقیقت به «چقدر
    // مانده»، نه دورترینش.
    const stage = STAGES.filter((s) => hoursLeft <= s).sort((a, b) => a - b)[0];
    if (!stage) continue;
    if (alreadyNotified(m.close_notice_stage, stage)) continue;

    // ⚠️ ادعا **پیش از** ارسال. اگر برعکس بود، شکستِ ارسال به یک ادمین
    // یعنی همان خبر در تیک بعدی دوباره برای همه می‌رفت.
    const claim = await pool.query(
      `UPDATE ir_markets SET close_notice_stage=$2
        WHERE id=$1 AND status='open'
          AND (close_notice_stage = 0 OR close_notice_stage > $2)
        RETURNING id`,
      [m.id, stage]
    );
    if (!claim.rowCount) continue;

    const pool_ = Number(m.yes_total) + Number(m.no_total);
    const urgent = stage === LAST_STAGE;

    const text =
      `${urgent ? "🔴" : "🟡"} <b>${fa(stage)} ساعت تا بسته‌شدن بازار</b>\n\n` +
      `<b>${escapeHtml(m.question)}</b>\n\n` +
      `📁 دسته: ${escapeHtml(categoryLabel(m.category))}\n` +
      `⏰ بسته می‌شود: ${escapeHtml(tehran(m.closes_at))}\n` +
      `👥 شرکت‌کننده: ${fa(m.bettors)} نفر · 💎 استخر: ${pool_.toFixed(2)} تتر\n\n` +
      `📌 <b>منبع تسویه</b>\n${escapeHtml(m.source_note)}\n\n` +
      // ⚠️ این متن مهم‌ترین بخش پیام است. «بسته‌شدن» یعنی ورودی بسته
      // می‌شود، نه اینکه نتیجه معلوم شود — و برای بازار ورزشی این دو
      // اصلا یکی نیستند.
      `<i>یادآوری: بسته‌شدن یعنی از آن لحظه دیگر کسی پیش‌بینی ثبت نمی‌کند. ` +
      `اگر نتیجه ممکن است پیش از این تاریخ معلوم شود — مثلا بازار ورزشی که ` +
      `مسابقه‌اش زودتر شروع می‌شود — همین حالا ببندش.</i>`;

    const buttons: InlineButton[][] = [
      [
        {
          text: "🔒 همین حالا ببند",
          callback_data: IR_CLOSE.lock(m.id),
          style: "danger",
        },
      ],
    ];

    let sent = false;
    for (const admin of admins) {
      // هر ادمین جدا؛ شکست یکی نباید بقیه را متوقف کند.
      try {
        if (await sendTelegram(admin, text, buttons)) sent = true;
      } catch {
        /* اعلان از دست رفت — بازار همچنان در پنل ادمین هست */
      }
    }

    if (sent) out.notified++;
    else out.errors++;

    log.info("ir.closing_soon", {
      marketId: m.id,
      stage,
      hoursLeft: Math.round(hoursLeft),
      bettors: m.bettors,
      pool: pool_,
      delivered: sent,
    });
  }

  return out;
}
