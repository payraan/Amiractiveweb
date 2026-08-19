import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { tgCall, markTelegramBlocked, type InlineButton } from "@/lib/telegram";

// ── صف اعلان شخصی ───────────────────────────────────────────
//
// ── چرا صف و نه ارسال مستقیم در لحظه‌ی تسویه ──
// تسویه داخل یک ترنزاکشن با قفل ردیف بازار و همه‌ی برنده‌هاست. یک تماس
// تلگرام وسط آن یعنی قفل‌ها تا پاسخ شبکه باز نگه داشته می‌شوند — و اگر
// تلگرام کند باشد یا تایم‌اوت بدهد، کل تسویه معطل یا برگشت می‌خورد. یعنی
// **پول کاربر گروگان یک اعلان** می‌شد.
//
// پس: تسویه فقط یک ردیف در همین جدول می‌نویسد (ارزان، داخل همان ترنزاکشن،
// پس اگر تسویه برگردد اعلان هم برمی‌گردد) و ارسال جدا انجام می‌شود.
//
// ── چرا هیچ‌کس دو بار پیام نمی‌گیرد ──
// کلید یکتای `(player_id, kind, ref)`. تسویه‌ی دوباره‌ی همان بازار — که
// خودش idempotent است — ردیف تکراری نمی‌سازد.
//
// ── چرا متن از پیش رندر می‌شود ──
// ردیف باید **حقیقتِ همان لحظه** را نگه دارد. اگر متن هنگام ارسال ساخته
// می‌شد، بازاری که بعدا اصلاح شود پیامی می‌فرستاد که با چیزی که واقعا
// پرداخت شده نمی‌خواند.

export type NotifyKind = "ir_settled" | "trade_settled" | "pulse_settled";

let ready: Promise<void> | null = null;

export async function ensureOutboxTable(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS tg_outbox (
           id         BIGSERIAL PRIMARY KEY,
           player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           kind       TEXT NOT NULL,
           ref        TEXT NOT NULL,
           text       TEXT NOT NULL,
           buttons    JSONB,
           status     TEXT NOT NULL DEFAULT 'pending',
           error      TEXT,
           claimed_at TIMESTAMPTZ,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           sent_at    TIMESTAMPTZ
         )`
      );
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS tg_outbox_once
           ON tg_outbox (player_id, kind, ref)`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS tg_outbox_pending
           ON tg_outbox (id) WHERE status='pending'`
      );
    });
  }
  return ready;
}

/**
 * گذاشتن یک اعلان در صف.
 *
 * ⚠️ **حتما داخل همان ترنزاکشنی صدا زده شود که نتیجه را ثبت می‌کند.**
 * بیرونش یعنی ممکن است تسویه برگردد ولی اعلان بماند — و کاربر پیام
 * «بردی» بگیرد برای چیزی که اتفاق نیفتاده.
 *
 * ⚠️ **و حتما داخل SAVEPOINT.** این را تست گرفت، نه خواندن کد: بار اول
 * جدول هنوز ساخته نشده بود، درج شکست خورد، و **کل تسویه مرد** — چون
 * Postgres پس از هر خطا تمام ترنزاکشن را باطل می‌کند و
 * «commands ignored until end of transaction block» می‌دهد. یک
 * `try/catch` در جاوااسکریپت اینجا هیچ کاری نمی‌کند: خطا گرفته می‌شود ولی
 * ترنزاکشن از قبل مسموم شده است.
 *
 * با SAVEPOINT، شکستِ درج فقط تا همان نقطه برمی‌گردد و پرداخت — که
 * برگشت‌ناپذیر و مهم‌تر است — سالم ادامه می‌دهد. اعلان از دست می‌رود؛ پول
 * نه.
 *
 * ⚠️ ردیفِ بازیکنِ بدون تلگرام هم ساخته می‌شود و همان‌جا `skipped` می‌شود.
 * فیلترکردنش اینجا یعنی یک `SELECT` اضافه داخل ترنزاکشن قفل‌دار.
 */
export async function queueNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  n: {
    playerId: number;
    kind: NotifyKind;
    ref: string;
    text: string;
    buttons?: InlineButton[][];
  }
): Promise<void> {
  await client.query("SAVEPOINT nq");
  try {
    await client.query(
      `INSERT INTO tg_outbox (player_id, kind, ref, text, buttons)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (player_id, kind, ref) DO NOTHING`,
      [
        n.playerId,
        n.kind,
        n.ref,
        n.text,
        n.buttons?.length ? JSON.stringify(n.buttons) : null,
      ]
    );
    await client.query("RELEASE SAVEPOINT nq");
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT nq");
    log.error("outbox.queue_failed", {
      playerId: n.playerId,
      kind: n.kind,
      err: err instanceof Error ? err.message : "error",
    });
  }
}

/** چند پیام در هر دسته‌ی موازی — همان عدد پخش سراسری. */
const BATCH = 20;
/** سقف پیام در ثانیه. عمدا زیر سقف ~۳۰ تلگرام. */
const MAX_PER_SEC = 25;
/** پس از این مدت، ردیفِ «در حال ارسال»ِ رهاشده دوباره برداشته می‌شود. */
const STALE_CLAIM_MIN = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type OutboxTick = {
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  throttled: boolean;
};

/**
 * ارسال یک دسته از صف.
 *
 * ساختارش عمدا همان `runBroadcastTick` است — ادعای اتمیک، ارسال موازی،
 * و پیس‌کردن — چون هر دو با همان سقف تلگرام روبه‌رو هستند و دو الگوی
 * متفاوت یعنی روزی یکی‌شان سقف را رد می‌کند.
 */
export async function runOutboxTick(budgetMs = 20_000): Promise<OutboxTick> {
  await ensureOutboxTable();
  const pool = await db();

  const out: OutboxTick = {
    sent: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    throttled: false,
  };
  const deadline = Date.now() + budgetMs;

  while (Date.now() < deadline) {
    const claim = await pool.query<{
      id: string;
      text: string;
      buttons: InlineButton[][] | null;
      tg_user_id: string | null;
    }>(
      `UPDATE tg_outbox o
          SET status='sending', claimed_at=now()
        FROM players p
       WHERE p.id = o.player_id
         AND o.id IN (
           SELECT id FROM tg_outbox
            WHERE status='pending'
               OR (status='sending'
                   AND claimed_at < now() - ($1 || ' minutes')::interval)
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            LIMIT $2)
       RETURNING o.id, o.text, o.buttons, p.tg_user_id`,
      [String(STALE_CLAIM_MIN), BATCH]
    );
    if (!claim.rowCount) break;

    const batchStart = Date.now();

    const results = await Promise.all(
      claim.rows.map(async (row) => {
        // حساب بدون تلگرام هرگز پیامی نمی‌گیرد؛ ردیف بسته می‌شود تا برای
        // همیشه در صف نماند.
        if (!row.tg_user_id) return { id: row.id, state: "skipped" as const };
        const r = await tgCall("sendMessage", {
          chat_id: Number(row.tg_user_id),
          text: row.text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          ...(row.buttons?.length
            ? { reply_markup: { inline_keyboard: row.buttons } }
            : {}),
        });
        return r.ok
          ? { id: row.id, state: "sent" as const }
          : {
              id: row.id,
              state: "failed" as const,
              error: r.error,
              chatId: Number(row.tg_user_id),
            };
      })
    );

    for (const r of results) {
      if (r.state === "sent") {
        out.sent++;
        await pool.query(
          "UPDATE tg_outbox SET status='sent', sent_at=now() WHERE id=$1",
          [r.id]
        );
      } else if (r.state === "skipped") {
        out.skipped++;
        await pool.query(
          "UPDATE tg_outbox SET status='skipped', error='no_telegram' WHERE id=$1",
          [r.id]
        );
      } else {
        out.failed++;
        await pool.query(
          "UPDATE tg_outbox SET status='failed', error=$2 WHERE id=$1",
          [r.id, r.error.slice(0, 300)]
        );
        // همان آشکارساز ارزانِ بلاک که پخش سراسری دارد.
        if (/bot was blocked by the user/i.test(r.error)) {
          await markTelegramBlocked(r.chatId).catch(() => {});
        }
        if (/too many requests/i.test(r.error)) {
          out.throttled = true;
          log.warn("outbox.throttled", { sent: out.sent, failed: out.failed });
        }
      }
    }

    if (out.throttled) break;

    // پیس‌کردن — دقیقا همان قاعده‌ی پخش سراسری.
    const minMs = (claim.rowCount / MAX_PER_SEC) * 1000;
    const spent = Date.now() - batchStart;
    if (spent < minMs) await sleep(minMs - spent);
  }

  const left = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM tg_outbox WHERE status='pending'"
  );
  out.remaining = Number(left.rows[0]?.n ?? 0);

  if (out.sent || out.failed || out.skipped) {
    log.info("outbox.tick", { ...out });
  }
  return out;
}

/**
 * زنجیره‌ی ارسال صف را بدون انتظار راه می‌اندازد.
 *
 * همان دلیلِ `kickBroadcastChain`: تیک کرون هر ۱۵ دقیقه است و اعلان نتیجه
 * باید نزدیکِ لحظه‌ی تسویه برسد، نه ربع ساعت بعد.
 */
export function kickOutboxChain(): boolean {
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SETTLE_KEY;
  if (!base || !key) return false;
  fetch(`${base}/api/bot/outbox`, {
    method: "POST",
    headers: { "x-settle-key": key },
    cache: "no-store",
  }).catch((err) => {
    log.warn("outbox.chain_kick_failed", {
      err: err instanceof Error ? err.message : "error",
    });
  });
  return true;
}
