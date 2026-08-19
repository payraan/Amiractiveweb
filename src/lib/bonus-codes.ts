import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { ensureIrTables, moveFunds } from "@/lib/iran";

// ── کد بونوس کمپین ──────────────────────────────────────────
//
// مالک برای کمپین و تبلیغات کد می‌سازد و کاربر آن را در سایت، مینی‌اپ یا
// ربات وارد می‌کند. دو نوع جایزه:
//
//   • `moon` → MOON، همان ارزی که پیش‌بینی و چالش با آن خرج می‌شود.
//   • `usdt` → تتر **دمو**. عمدا دمو و نه واقعی: پول واقعی فقط از درگاه
//     می‌آید و ساختنش از هوا یعنی بدهیِ بی‌پشتوانه در کیف پول‌ها. با دمو،
//     کاربر می‌تواند در بازار ایران شرط ببندد ولی خودِ هدیه هرگز برداشت
//     نمی‌شود — فقط سودش. همان قاعده‌ی مصوب پول دمو.
//
// ── سه محافظ ──
//   ۱. هر حساب فقط یک بار از هر کد — با کلید اصلیِ `(code, player_id)`،
//      نه با یک `SELECT` جدا که پنجره‌ی مسابقه باز بگذارد.
//   ۲. سقف تعداد استفاده — با `UPDATE … WHERE used < max` اتمیک ادعا
//      می‌شود، پس دو نفر هم‌زمان نمی‌توانند آخرین سهمیه را با هم بردارند.
//   ۳. تاریخ انقضا.
//
// ⚠️ کد بونوس MOON از هیچ ساخته می‌شود — مثل پورسانت رفرال. یعنی مستقیم
// به ورودی چالش پراپ راه دارد که جایزه‌اش پول واقعی است. سقف و انقضا
// اختیاری نیستند؛ کدِ بی‌سقفِ بی‌انقضا یک شیر باز است.

export type BonusKind = "moon" | "usdt";

/** حداکثر طول کد — بلندتر از این را کاربر تایپ نمی‌کند. */
const MAX_CODE_LEN = 24;

let ready: Promise<void> | null = null;

export async function ensureBonusTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS bonus_codes (
           code        TEXT PRIMARY KEY,
           kind        TEXT NOT NULL,
           amount      NUMERIC(18,6) NOT NULL,
           max_uses    INTEGER NOT NULL,
           used        INTEGER NOT NULL DEFAULT 0,
           expires_at  TIMESTAMPTZ,
           note        TEXT,
           created_by  BIGINT,
           created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS bonus_redemptions (
           code       TEXT NOT NULL REFERENCES bonus_codes(code) ON DELETE CASCADE,
           player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           amount     NUMERIC(18,6) NOT NULL,
           kind       TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           PRIMARY KEY (code, player_id)
         )`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bonus_redemptions_player
           ON bonus_redemptions (player_id, created_at DESC)`
      );
    });
  }
  return ready;
}

/**
 * نرمال‌سازی کد: بزرگ، بدون فاصله.
 *
 * کاربر «narmoon 50» یا «Narmoon50» تایپ می‌کند و هر دو باید به همان کد
 * برسند — ردکردنشان فقط اصطکاک است، نه امنیت.
 */
export function normalizeCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s‌-]+/g, "")
    .slice(0, MAX_CODE_LEN);
}

export type CreateResult =
  | { ok: true; code: string }
  | { ok: false; error: "bad_code" | "bad_amount" | "bad_uses" | "exists" };

export async function createBonusCode(opts: {
  code: string;
  kind: BonusKind;
  amount: number;
  maxUses: number;
  expiresInDays?: number | null;
  note?: string | null;
  createdBy?: number | null;
}): Promise<CreateResult> {
  await ensureBonusTables();

  const code = normalizeCode(opts.code);
  if (!/^[A-Z0-9]{3,24}$/.test(code)) return { ok: false, error: "bad_code" };

  const amount =
    opts.kind === "moon"
      ? Math.trunc(Number(opts.amount))
      : Math.round(Number(opts.amount) * 1e6) / 1e6;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "bad_amount" };

  const maxUses = Math.trunc(Number(opts.maxUses));
  if (!Number.isInteger(maxUses) || maxUses <= 0) return { ok: false, error: "bad_uses" };

  const days = Number(opts.expiresInDays);
  const expires =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 86400_000).toISOString()
      : null;

  const pool = await db();
  const r = await pool.query(
    `INSERT INTO bonus_codes (code, kind, amount, max_uses, expires_at, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (code) DO NOTHING
     RETURNING code`,
    [code, opts.kind, amount, maxUses, expires, opts.note ?? null, opts.createdBy ?? null]
  );
  if (!r.rowCount) return { ok: false, error: "exists" };

  log.warn("bonus_code.created", {
    code,
    kind: opts.kind,
    amount,
    maxUses,
    expires,
  });
  return { ok: true, code };
}

export type RedeemResult =
  | { ok: true; kind: BonusKind; amount: number; credits?: number }
  | {
      ok: false;
      error:
        | "bad_code"
        | "not_found"
        | "expired"
        | "exhausted"
        | "already_used"
        | "server_error";
    };

/**
 * مصرف یک کد.
 *
 * ⚠️ ترتیب عمدی است و مسابقه‌پذیر نیست:
 *   ۱. اول **ثبت مصرف** با کلید اصلی `(code, player_id)`. اگر همین کاربر
 *      قبلا گرفته باشد، همین‌جا شکست می‌خورد — بدون هیچ `SELECT` جدایی که
 *      بین بررسی و درج پنجره باز بگذارد.
 *   ۲. بعد **ادعای سهمیه** با `UPDATE … WHERE used < max_uses`. دو نفر
 *      هم‌زمان نمی‌توانند آخرین سهمیه را با هم بردارند.
 *   ۳. تازه بعد از هر دو، پول جابه‌جا می‌شود.
 * هر سه داخل یک ترنزاکشن‌اند، پس شکستِ هر کدام همه را برمی‌گرداند.
 */
export async function redeemBonusCode(
  playerId: number,
  raw: string
): Promise<RedeemResult> {
  await ensureBonusTables();
  await ensureIrTables();

  const code = normalizeCode(raw);
  if (!/^[A-Z0-9]{3,24}$/.test(code)) return { ok: false, error: "bad_code" };

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const c = await client.query<{
      kind: BonusKind;
      amount: string;
      expired: boolean;
    }>(
      `SELECT kind, amount, (expires_at IS NOT NULL AND expires_at < now()) AS expired
         FROM bonus_codes WHERE code=$1 FOR UPDATE`,
      [code]
    );
    if (!c.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }
    if (c.rows[0].expired) {
      await client.query("ROLLBACK");
      return { ok: false, error: "expired" };
    }

    const kind = c.rows[0].kind;
    const amount = Number(c.rows[0].amount);

    // ۱. یک بار برای هر حساب — کلید اصلی این را تضمین می‌کند.
    const mine = await client.query(
      `INSERT INTO bonus_redemptions (code, player_id, amount, kind)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code, player_id) DO NOTHING
       RETURNING code`,
      [code, playerId, amount, kind]
    );
    if (!mine.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "already_used" };
    }

    // ۲. ادعای سهمیه‌ی کل.
    const claim = await client.query(
      "UPDATE bonus_codes SET used = used + 1 WHERE code=$1 AND used < max_uses RETURNING used",
      [code]
    );
    if (!claim.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "exhausted" };
    }

    // ۳. پول.
    let credits: number | undefined;
    if (kind === "moon") {
      const u = await client.query<{ credits: number }>(
        "UPDATE players SET credits = credits + $2 WHERE id=$1 RETURNING credits",
        [playerId, Math.trunc(amount)]
      );
      credits = u.rows[0]?.credits;
    } else {
      // ⚠️ ردیف باید پیش از `moveFunds` قفل شده باشد — قرارداد آن تابع.
      await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [playerId]);
      // کل مبلغ دمو است: هدیه هرگز قابل برداشت نیست، فقط سودش.
      await moveFunds(client, playerId, amount, "bonus_code", code, {
        creditDemo: amount,
      });
    }

    await client.query("COMMIT");
    log.warn("bonus_code.redeemed", { playerId, code, kind, amount });
    return { ok: true, kind, amount, credits };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log.error("bonus_code.redeem_failed", {
      playerId,
      code,
      err: err instanceof Error ? err.message : "error",
    });
    return { ok: false, error: "server_error" };
  } finally {
    client.release();
  }
}

export type CodeRow = {
  code: string;
  kind: BonusKind;
  amount: number;
  maxUses: number;
  used: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
};

/** فهرست کدها — برای پنل ادمین و ربات. */
export async function listBonusCodes(limit = 50): Promise<CodeRow[]> {
  await ensureBonusTables();
  const pool = await db();
  const r = await pool.query(
    `SELECT code, kind, amount::float AS amount, max_uses, used,
            expires_at, note, created_at
       FROM bonus_codes ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return r.rows.map((x) => ({
    code: x.code,
    kind: x.kind,
    amount: x.amount,
    maxUses: x.max_uses,
    used: x.used,
    expiresAt: x.expires_at,
    note: x.note,
    createdAt: x.created_at,
  }));
}
