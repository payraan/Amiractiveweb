import { db } from "@/lib/db";
import { tgCall, markTelegramBlocked, type InlineButton } from "@/lib/telegram";

// ═══ پیام سراسری ═════════════════════════════════════════════
//
// هدف: رساندن یک پیام به ده‌ها هزار کاربر، بدون اینکه سایت و مینی‌اپ حتی
// متوجه شوند.
//
// ── چرا صف و نه یک حلقه ──
// Railway یک پروسه است و تلگرام سقف حدود ۳۰ پیام در ثانیه دارد. ۵۰ هزار
// پیام یعنی دست‌کم نیم‌ساعت ارسال پیوسته. یک حلقه‌ی نیم‌ساعته داخل یک
// درخواست، هم با تایم‌اوت می‌میرد و هم با اولین دیپلوی از وسط قطع می‌شود و
// هیچ‌کس نمی‌داند تا کجا فرستاده شده.
//
// به‌جایش: هدف‌ها یک بار در جدول snapshot می‌شوند و هر «تیک» یک دسته‌ی
// کوچک را می‌فرستد و وضعیت هر نفر را همان‌جا ثبت می‌کند. قطع شدن وسط کار
// یعنی تیک بعدی از همان‌جا ادامه می‌دهد — نه از اول.
//
// ── چرا هیچ‌کس دو بار پیام نمی‌گیرد ──
// کلید اصلی جدول هدف‌ها `(job_id, tg_user_id)` است و هر ردیف پیش از ارسال
// به `sending` و پس از آن به `sent` می‌رود. بدترین حالتِ یک کرشِ دقیقا در
// لحظه‌ی ارسال، یک پیام تکراری برای یک نفر است — نه برای همه.
//
// ── چرا آیدی فایل و نه آدرس عکس ──
// تلگرام عکسی را که به خودش فرستاده شده با `file_id` می‌شناسد و ارسال
// دوباره‌اش هیچ آپلودی ندارد. با آدرس، تلگرام باید فایل را از سرور ما
// بگیرد و در پخش انبوه این یعنی ده‌ها هزار درخواست به سرور خودمان.

/** آیدی‌های تلگرام مجاز به پخش سراسری. */
export function broadcastAdmins(): number[] {
  return (process.env.TG_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function isBroadcastAdmin(tgUserId: number): boolean {
  return broadcastAdmins().includes(tgUserId);
}

let ready: Promise<void> | null = null;

export async function ensureBroadcastTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS broadcast_jobs (
           id          BIGSERIAL PRIMARY KEY,
           text        TEXT NOT NULL DEFAULT '',
           photo_id    TEXT,
           status      TEXT NOT NULL DEFAULT 'draft',
           created_by  BIGINT NOT NULL,
           created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
           started_at  TIMESTAMPTZ,
           finished_at TIMESTAMPTZ
         )`
      );
      // کارت پیشرفتِ ادمین: هر تیک همین پیام را به‌روز می‌کند تا ادمین
      // مجبور نباشد نیم‌ساعت دکمه بزند.
      await pool.query(
        "ALTER TABLE broadcast_jobs ADD COLUMN IF NOT EXISTS chat_id BIGINT"
      );
      await pool.query(
        "ALTER TABLE broadcast_jobs ADD COLUMN IF NOT EXISTS message_id INTEGER"
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS broadcast_targets (
           job_id     BIGINT NOT NULL REFERENCES broadcast_jobs(id) ON DELETE CASCADE,
           tg_user_id BIGINT NOT NULL,
           status     TEXT NOT NULL DEFAULT 'pending',
           error      TEXT,
           claimed_at TIMESTAMPTZ,
           sent_at    TIMESTAMPTZ,
           PRIMARY KEY (job_id, tg_user_id)
         )`
      );
      await pool.query(
        "ALTER TABLE broadcast_targets ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ"
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS broadcast_targets_pending
           ON broadcast_targets (job_id) WHERE status='pending'`
      );
    });
  }
  return ready;
}

export type JobStats = {
  id: number;
  status: string;
  hasPhoto: boolean;
  total: number;
  sent: number;
  /** ربات را بلاک کرده‌اند — پیام به آن‌ها نرسید و هرگز نمی‌رسد. */
  blocked: number;
  /** ناموفق به دلایل دیگر: حساب پاک‌شده، خطای شبکه، سقف تلگرام. */
  failed: number;
  pending: number;
  /** ثانیه‌ی باقی‌مانده بر اساس سرعت واقعی همین پخش. */
  etaSec: number | null;
  chatId: number | null;
  messageId: number | null;
};

export async function jobStats(jobId: number): Promise<JobStats | null> {
  await ensureBroadcastTables();
  const pool = await db();
  const j = await pool.query<{
    status: string;
    photo_id: string | null;
    chat_id: string | null;
    message_id: number | null;
    elapsed: string | null;
  }>(
    `SELECT status, photo_id, chat_id, message_id,
            EXTRACT(EPOCH FROM (now() - started_at))::text AS elapsed
       FROM broadcast_jobs WHERE id=$1`,
    [jobId]
  );
  if (!j.rowCount) return null;
  const c = await pool.query<{
    total: string;
    sent: string;
    blocked: string;
    failed: string;
    pending: string;
  }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status='sent')::text AS sent,
            COUNT(*) FILTER (WHERE status='failed'
                             AND error ILIKE '%bot was blocked by the user%')::text AS blocked,
            COUNT(*) FILTER (WHERE status='failed'
                             AND error NOT ILIKE '%bot was blocked by the user%')::text AS failed,
            COUNT(*) FILTER (WHERE status<>'sent' AND status<>'failed')::text AS pending
       FROM broadcast_targets WHERE job_id=$1`,
    [jobId]
  );
  const r = c.rows[0];
  const total = Number(r.total);
  const pending = Number(r.pending);
  const done = total - pending;
  const elapsed = Number(j.rows[0].elapsed ?? 0);

  // سرعت واقعی همین پخش، نه یک عدد فرضی — تأخیر تلگرام و وقفه‌ها را
  // خودش در خود دارد.
  const etaSec =
    pending > 0 && done > 0 && elapsed > 0
      ? Math.round(pending / (done / elapsed))
      : null;

  return {
    id: jobId,
    status: j.rows[0].status,
    hasPhoto: Boolean(j.rows[0].photo_id),
    total,
    sent: Number(r.sent),
    blocked: Number(r.blocked),
    failed: Number(r.failed),
    pending,
    etaSec,
    chatId: j.rows[0].chat_id === null ? null : Number(j.rows[0].chat_id),
    messageId: j.rows[0].message_id,
  };
}

/** کارت پیشرفت را به کار می‌چسباند تا تیک‌ها بتوانند به‌روزش کنند. */
export async function attachCard(
  jobId: number,
  chatId: number,
  messageId: number
): Promise<void> {
  await ensureBroadcastTables();
  const pool = await db();
  await pool.query(
    "UPDATE broadcast_jobs SET chat_id=$2, message_id=$3 WHERE id=$1",
    [jobId, chatId, messageId]
  );
}

/**
 * ساخت پیش‌نویس و snapshot گرفتن از مخاطبان.
 *
 * فهرست همین‌جا ثابت می‌شود: کسی که وسط پخش ثبت‌نام کند این پیام را
 * نمی‌گیرد، و کسی که وسط پخش حسابش را ببندد از فهرست بیرون نمی‌افتد. بدون
 * snapshot، «تا کجا فرستادیم» معنای ثابتی ندارد.
 *
 * کاربران بلاک‌کرده عمدا داخل فهرست می‌مانند: تلاش برای ارسال، ارزان‌ترین
 * راه فهمیدن این است که کسی دوباره آنبلاک کرده یا نه.
 */
export async function createJob(
  createdBy: number,
  text: string,
  photoId: string | null
): Promise<JobStats> {
  await ensureBroadcastTables();
  const pool = await db();
  const j = await pool.query<{ id: string }>(
    `INSERT INTO broadcast_jobs (text, photo_id, status, created_by)
     VALUES ($1,$2,'draft',$3) RETURNING id`,
    [text, photoId, createdBy]
  );
  const jobId = Number(j.rows[0].id);
  await pool.query(
    `INSERT INTO broadcast_targets (job_id, tg_user_id)
     SELECT $1, tg_user_id FROM players
      WHERE tg_user_id IS NOT NULL
     ON CONFLICT DO NOTHING`,
    [jobId]
  );
  return (await jobStats(jobId))!;
}

export async function startJob(jobId: number): Promise<void> {
  await ensureBroadcastTables();
  const pool = await db();
  await pool.query(
    "UPDATE broadcast_jobs SET status='running', started_at=now() WHERE id=$1 AND status='draft'",
    [jobId]
  );
}

export async function cancelJob(jobId: number): Promise<void> {
  await ensureBroadcastTables();
  const pool = await db();
  await pool.query(
    "UPDATE broadcast_jobs SET status='cancelled', finished_at=now() WHERE id=$1 AND status IN ('draft','running')",
    [jobId]
  );
}

/** آخرین کار در حال اجرا — تیک کرون از همین می‌آید. */
export async function runningJob(): Promise<number | null> {
  await ensureBroadcastTables();
  const pool = await db();
  const r = await pool.query<{ id: string }>(
    "SELECT id FROM broadcast_jobs WHERE status='running' ORDER BY id LIMIT 1"
  );
  return r.rowCount ? Number(r.rows[0].id) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** فاصله‌ی بین پیام‌ها. سقف تلگرام حدود ۳۰ در ثانیه است؛ زیرش می‌مانیم. */
const GAP_MS = 45;

/**
 * پس از این مدت، یک ردیفِ «در حال ارسال» رهاشده حساب می‌شود.
 *
 * سخاوتمندانه گرفته شده تا ردیفی که واقعا در حال ارسال است دوباره برداشته
 * نشود؛ بدترین پیامدِ کوتاه‌بودنش، پیام تکراری برای یک نفر است.
 */
const STALE_CLAIM_MIN = 5;

export type TickResult = {
  jobId: number | null;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
  throttled: boolean;
};

/**
 * یک دسته را می‌فرستد و برمی‌گردد.
 *
 * `budgetMs` سقف زمان این تیک است تا درخواست کوتاه بماند. کار ناتمام
 * می‌ماند و تیک بعدی ادامه می‌دهد.
 */
export async function runBroadcastTick(budgetMs = 45_000): Promise<TickResult> {
  const jobId = await runningJob();
  if (!jobId) {
    return { jobId: null, sent: 0, failed: 0, remaining: 0, done: true, throttled: false };
  }

  await ensureBroadcastTables();
  const pool = await db();
  const job = await pool.query<{ text: string; photo_id: string | null }>(
    "SELECT text, photo_id FROM broadcast_jobs WHERE id=$1",
    [jobId]
  );
  if (!job.rowCount) {
    return { jobId, sent: 0, failed: 0, remaining: 0, done: true, throttled: false };
  }
  const { text, photo_id: photoId } = job.rows[0];

  const deadline = Date.now() + budgetMs;
  let sent = 0;
  let failed = 0;
  let throttled = false;

  while (Date.now() < deadline) {
    // یک نفر را «در حال ارسال» علامت می‌زنیم و همان لحظه برمی‌داریم، تا دو
    // تیک همزمان یک نفر را دو بار نگیرند.
    //
    // ⚠️ ردیف‌های `sending` کهنه هم برداشته می‌شوند. اگر پروسه دقیقا وسط
    // یک ارسال ری‌استارت شود (هر دیپلوی می‌تواند)، آن ردیف در `sending`
    // می‌ماند؛ بدون این شرط برای همیشه گیر می‌کرد، کار هرگز تمام نمی‌شد و
    // آن کاربر هیچ‌وقت پیام نمی‌گرفت.
    const claim = await pool.query<{ tg_user_id: string }>(
      `UPDATE broadcast_targets SET status='sending', claimed_at=now()
        WHERE (job_id, tg_user_id) IN (
          SELECT job_id, tg_user_id FROM broadcast_targets
           WHERE job_id=$1
             AND (status='pending'
                  OR (status='sending'
                      AND claimed_at < now() - ($2 || ' minutes')::interval))
           ORDER BY tg_user_id
           FOR UPDATE SKIP LOCKED
           LIMIT 1)
        RETURNING tg_user_id`,
      [jobId, String(STALE_CLAIM_MIN)]
    );
    if (!claim.rowCount) break;

    const chatId = Number(claim.rows[0].tg_user_id);
    const r = photoId
      ? await tgCall("sendPhoto", {
          chat_id: chatId,
          photo: photoId,
          caption: text,
          parse_mode: "HTML",
        })
      : await tgCall("sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });

    if (r.ok) {
      sent++;
      await pool.query(
        "UPDATE broadcast_targets SET status='sent', sent_at=now() WHERE job_id=$1 AND tg_user_id=$2",
        [jobId, chatId]
      );
    } else {
      failed++;
      await pool.query(
        "UPDATE broadcast_targets SET status='failed', error=$3 WHERE job_id=$1 AND tg_user_id=$2",
        [jobId, chatId, r.error.slice(0, 300)]
      );
      // پخش، ارزان‌ترین آشکارساز بلاک‌شدن است: این پیام‌ها به‌هرحال
      // فرستاده می‌شوند، پس علامت‌زدن اینجا هیچ تماس اضافه‌ای ندارد.
      if (/bot was blocked by the user/i.test(r.error)) {
        await markTelegramBlocked(chatId).catch(() => {});
      }
      // ۴۲۹ یعنی تندتر از سقف رفته‌ایم. تیک را همین‌جا تمام می‌کنیم تا
      // تیک بعدی با فاصله شروع کند.
      if (/too many requests/i.test(r.error)) {
        throttled = true;
        break;
      }
    }

    await sleep(GAP_MS);
  }

  const mid = await jobStats(jobId);
  const remaining = mid?.pending ?? 0;
  if (remaining === 0) {
    await pool.query(
      "UPDATE broadcast_jobs SET status='done', finished_at=now() WHERE id=$1 AND status='running'",
      [jobId]
    );
  }

  // کارت ادمین را تازه می‌کنیم. پخش نیم‌ساعته‌ای که فقط با فشردن دکمه خبر
  // بدهد، عملا خبری نمی‌دهد. خطایش بلعیده می‌شود: ناتوانی در ویرایش یک
  // پیام نباید پخش را متوقف کند.
  const s = await jobStats(jobId);
  if (s?.chatId && s.messageId && (sent > 0 || failed > 0 || remaining === 0)) {
    await tgCall("editMessageText", {
      chat_id: s.chatId,
      message_id: s.messageId,
      text: progressText(s),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: jobKeyboard(s) },
    }).catch(() => {});
  }

  return { jobId, sent, failed, remaining, done: remaining === 0, throttled };
}

const fa = (n: number) => n.toLocaleString("fa-IR");

/** «۴ دقیقه» / «۱ ساعت و ۱۲ دقیقه» */
function duration(sec: number): string {
  if (sec < 60) return `کمتر از یک دقیقه`;
  const m = Math.round(sec / 60);
  if (m < 60) return `حدود ${fa(m)} دقیقه`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `حدود ${fa(h)} ساعت و ${fa(rest)} دقیقه` : `حدود ${fa(h)} ساعت`;
}

/** نوار پیشرفت متنی — چون تلگرام نمودار ندارد. */
function bar(pct: number): string {
  const filled = Math.round((pct / 100) * 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

/** خلاصه‌ی وضعیت برای کارت ادمین. */
export function progressText(s: JobStats): string {
  const done = s.sent + s.blocked + s.failed;
  const pct = s.total ? Math.round((done / s.total) * 100) : 0;
  const label: Record<string, string> = {
    draft: "پیش‌نویس — هنوز ارسال نشده",
    running: "⏳ در حال ارسال",
    done: "✅ تمام شد",
    cancelled: "⏹ متوقف شد",
  };

  let out =
    `📣 <b>پخش سراسری #${s.id}</b>\n` +
    `${label[s.status] ?? s.status}\n\n` +
    `👥 مخاطب: <b>${fa(s.total)}</b> نفر\n`;

  if (s.status !== "draft") {
    out +=
      `\n<code>${bar(pct)}</code>  <b>${fa(pct)}٪</b>\n\n` +
      `✅ دریافت کردند: <b>${fa(s.sent)}</b>\n` +
      `🚫 ربات را بلاک کرده‌اند: <b>${fa(s.blocked)}</b>\n` +
      (s.failed > 0 ? `⚠️ ناموفق (سایر): <b>${fa(s.failed)}</b>\n` : "") +
      `⏳ باقی‌مانده: <b>${fa(s.pending)}</b>\n`;

    if (s.status === "running" && s.etaSec !== null) {
      out += `\n⏱ زمان تخمینی تا پایان: <b>${duration(s.etaSec)}</b>`;
    }
    if (s.status === "done" && s.blocked > 0) {
      out +=
        `\n<i>کسانی که ربات را بلاک کرده‌اند پیام را دریافت نکردند و ` +
        `تا آنبلاک نکنند هیچ پیامی نمی‌گیرند.</i>`;
    }
  } else {
    out += `\nپیش از ارسال، پیام بالا را یک بار دیگر بخوانید. پخش برگشت‌ناپذیر است.`;
  }

  return out;
}

export function jobKeyboard(s: JobStats): InlineButton[][] {
  if (s.status === "draft") {
    return [
      [{ text: "🚀 شروع ارسال", callback_data: `b:go:${s.id}` }],
      [{ text: "✖️ لغو", callback_data: `b:no:${s.id}` }],
    ];
  }
  if (s.status === "running") {
    return [
      [{ text: "🔄 به‌روزرسانی وضعیت", callback_data: `b:st:${s.id}` }],
      [{ text: "⏹ توقف", callback_data: `b:no:${s.id}` }],
    ];
  }
  return [[{ text: "🔄 به‌روزرسانی وضعیت", callback_data: `b:st:${s.id}` }]];
}
