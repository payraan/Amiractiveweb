import { db } from "@/lib/db";

// ═══ حافظه‌ی گفت‌وگوی ربات ═══════════════════════════════════
//
// ربات تا امروز بی‌حافظه بود: هر پیام مستقل بود و هر چیزی که چند مرحله
// می‌خواست ناممکن. برداشت تتر سه مرحله دارد (مبلغ، آدرس، تأیید) و بین
// مرحله‌ها باید بداند کجاست.
//
// چرا در دیتابیس و نه در حافظه‌ی پروسه: Railway با هر دیپلوی ری‌استارت
// می‌شود. حافظه‌ی پروسه یعنی کاربری که وسط برداشت است، بی‌هیچ توضیحی
// همه‌چیز را از دست می‌دهد و باید از اول شروع کند.
//
// ⚠️ عمر کوتاه عمدی است. یک گفت‌وگوی برداشتِ نیمه‌کاره که ساعت‌ها باز
// بماند، یعنی اگر کسی بعدا به تلگرام آن شخص دسترسی پیدا کند، یک مرحله از
// سه مرحله را از قبل رد شده تحویل می‌گیرد.
export const FLOW_TTL_MIN = 15;

export type FlowStep = "amount" | "address" | "confirm";

export type Flow = {
  step: FlowStep;
  amount: number | null;
  address: string | null;
  /** کارتی که باید ویرایش شود، تا گفت‌وگو یک کارت بماند نه ده پیام. */
  messageId: number | null;
};

let ready: Promise<void> | null = null;

export async function ensureFlowTable(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS tg_flows (
           tg_user_id BIGINT PRIMARY KEY,
           flow       TEXT NOT NULL,
           step       TEXT NOT NULL,
           amount     NUMERIC(18,6),
           address    TEXT,
           message_id INTEGER,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
    });
  }
  return ready;
}

/** گفت‌وگوی فعال، یا `null` اگر نباشد یا منقضی شده باشد. */
export async function getFlow(tgUserId: number): Promise<Flow | null> {
  await ensureFlowTable();
  const pool = await db();
  const r = await pool.query<{
    step: FlowStep;
    amount: string | null;
    address: string | null;
    message_id: number | null;
  }>(
    `SELECT step, amount, address, message_id FROM tg_flows
      WHERE tg_user_id=$1 AND flow='withdraw'
        AND updated_at > now() - ($2 || ' minutes')::interval`,
    [tgUserId, String(FLOW_TTL_MIN)]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    step: row.step,
    amount: row.amount === null ? null : Number(row.amount),
    address: row.address,
    messageId: row.message_id,
  };
}

export async function setFlow(
  tgUserId: number,
  f: Partial<Flow> & { step: FlowStep }
): Promise<void> {
  await ensureFlowTable();
  const pool = await db();
  await pool.query(
    `INSERT INTO tg_flows (tg_user_id, flow, step, amount, address, message_id, updated_at)
     VALUES ($1,'withdraw',$2,$3,$4,$5, now())
     ON CONFLICT (tg_user_id) DO UPDATE
        SET flow='withdraw', step=$2, amount=$3, address=$4,
            message_id=COALESCE($5, tg_flows.message_id), updated_at=now()`,
    [tgUserId, f.step, f.amount ?? null, f.address ?? null, f.messageId ?? null]
  );
}

/**
 * برداشتنِ گفت‌وگوی آماده‌ی تأیید — یک‌بار و فقط یک‌بار.
 *
 * ⚠️ **حذف و خواندن در همان دستور انجام می‌شود.** الگوی «بخوان، بررسی کن،
 * پاک کن، بعد برداشت بزن» اتمیک نیست: دو لمس پشت‌سرهم روی «تأیید و ارسال»
 * (یا دو `callback_query` که تلگرام تقریبا هم‌زمان می‌فرستد) هر دو ردیف را
 * در وضعیت `confirm` می‌بینند، هر دو از بررسی رد می‌شوند، و هر دو برداشت
 * می‌سازند. با موجودی کافی، پول **دو بار** از حساب بیرون می‌رود.
 *
 * `DELETE … RETURNING` این را می‌بندد: فقط یکی از دو درخواست سطری می‌گیرد و
 * دومی `null`. همان الگویی که `refundWithdrawal` در مسیر پول دارد.
 *
 * شرط‌های `amount`/`address` هم داخل خودِ دستور آمده‌اند، نه در JS بعدش —
 * وگرنه بازهم یک پنجره بین بررسی و حذف باز می‌ماند.
 */
export async function claimConfirmedFlow(
  tgUserId: number
): Promise<{ amount: number; address: string; messageId: number | null } | null> {
  await ensureFlowTable();
  const pool = await db();
  const r = await pool.query<{
    amount: string;
    address: string;
    message_id: number | null;
  }>(
    `DELETE FROM tg_flows
      WHERE tg_user_id=$1 AND flow='withdraw' AND step='confirm'
        AND amount IS NOT NULL AND address IS NOT NULL
        AND updated_at > now() - ($2 || ' minutes')::interval
      RETURNING amount, address, message_id`,
    [tgUserId, String(FLOW_TTL_MIN)]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    amount: Number(row.amount),
    address: row.address,
    messageId: row.message_id,
  };
}

export async function clearFlow(tgUserId: number): Promise<void> {
  await ensureFlowTable();
  const pool = await db();
  await pool.query("DELETE FROM tg_flows WHERE tg_user_id=$1", [tgUserId]);
}

// ── گفت‌وگوی کاور بازار ───────────────────────────────────────
//
// روی همان جدول می‌نشیند با `flow='cover'`، و شناسه‌ی بازار در همان ستون
// `amount` نگه داشته می‌شود. جدول کلید اصلی‌اش `tg_user_id` است، پس کاربر
// هم‌زمان نمی‌تواند وسط برداشت و وسط کاور باشد — که همان چیزی است که
// می‌خواهیم: عکسی که در جریان برداشت فرستاده می‌شود نباید کاور شود.
//
// ⚠️ توابع برداشت عمدا `flow='withdraw'` را در شرط دارند، پس این دو هرگز
// داده‌ی هم را نمی‌بینند.

/** آغاز انتظار برای عکس کاور یک بازار. */
export async function setCoverFlow(
  tgUserId: number,
  marketId: number
): Promise<void> {
  await ensureFlowTable();
  const pool = await db();
  await pool.query(
    `INSERT INTO tg_flows (tg_user_id, flow, step, amount, address, message_id, updated_at)
     VALUES ($1,'cover','photo',$2,NULL,NULL, now())
     ON CONFLICT (tg_user_id) DO UPDATE
        SET flow='cover', step='photo', amount=$2, address=NULL,
            message_id=NULL, updated_at=now()`,
    [tgUserId, marketId]
  );
}

/**
 * برداشتنِ بازارِ منتظر کاور — یک‌بار و فقط یک‌بار.
 *
 * همان الگوی `claimConfirmedFlow`: حذف و خواندن در یک دستور، تا دو عکسِ
 * پشت‌سرهم دو بار روی یک بازار ننشینند.
 */
export async function claimCoverFlow(tgUserId: number): Promise<number | null> {
  await ensureFlowTable();
  const pool = await db();
  const r = await pool.query<{ amount: string }>(
    `DELETE FROM tg_flows
      WHERE tg_user_id=$1 AND flow='cover' AND step='photo'
        AND amount IS NOT NULL
        AND updated_at > now() - ($2 || ' minutes')::interval
      RETURNING amount`,
    [tgUserId, String(FLOW_TTL_MIN)]
  );
  return r.rows[0] ? Number(r.rows[0].amount) : null;
}
