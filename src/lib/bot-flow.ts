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

export async function clearFlow(tgUserId: number): Promise<void> {
  await ensureFlowTable();
  const pool = await db();
  await pool.query("DELETE FROM tg_flows WHERE tg_user_id=$1", [tgUserId]);
}
