import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ensureIrTables, moveFunds } from "@/lib/iran";
import { createWithdrawal, gatewayReady, USDT_NETWORK } from "@/lib/zovix";
import { notifyPlayer } from "@/lib/telegram";
import {
  MIN_WITHDRAW,
  WITHDRAW_FEE_USDT,
  receivedAfterFee,
} from "@/lib/wallet-rules";
import { withdrawAddressValid } from "@/lib/withdraw-address";

// ═══ برداشت تتر — یک مسیر، دو سطح ════════════════════════════
//
// سایت/مینی‌اپ و ربات هر دو همین را صدا می‌زنند. برداشت تنها عمل
// برگشت‌ناپذیر پلتفرم است؛ دو پیاده‌سازی موازی یعنی روزی یکی از آن‌ها یک
// بررسی کمتر دارد و همان یکی است که سوءاستفاده از آن می‌آید.
//
// احراز هویت و نگهبان تلگرام اینجا نیست: هر سطح هویت را خودش تشخیص
// می‌دهد (کوکی، هدر مینی‌اپ، یا آیدی تلگرام) و این تابع فقط با
// `playerId` کار می‌کند.

export type WithdrawError =
  | "gateway_off"
  | "amount_too_low"
  | "bad_address"
  | "insufficient_funds"
  | "rate_limited"
  | "server_error"
  | string;

export type WithdrawResult =
  | { ok: true; uuid: string; amount: number }
  | { ok: false; error: WithdrawError };

/**
 * سقف برداشت — پنج درخواست در ۱۰ دقیقه.
 *
 * ⚠️ چرا اینجا و نه فقط در middleware: **وبهوک تلگرام عمدا از سقف نرخ معاف
 * است** (۴۲۹ دادن به تلگرام یعنی گم‌شدن پیام کاربرها). پس اگر شمارش فقط در
 * middleware می‌ماند، برداشت از داخل ربات یک راه باز برای دور زدن همان سقف
 * بود. اینجا از روی جدول شمرده می‌شود، پس هر دو سطح را می‌گیرد و با دیپلوی
 * هم صفر نمی‌شود — برخلاف شمارنده‌ی حافظه‌ای.
 */
const MAX_PER_WINDOW = 5;
const WINDOW_MIN = 10;

/**
 * صادرشده چون کرون آشتی هم به همین اسکیما نیاز دارد.
 *
 * ⚠️ پیش از این فقط مسیر «ثبت برداشت» صدایش می‌زد، پس ستون تازه تا اولین
 * برداشتِ بعدی وجود نداشت — و کرونی که همان ستون را می‌نوشت، هر ۱۵ دقیقه
 * می‌ترکید. هر جدولی که دو مسیر لمسش می‌کنند، باید از هر دو مسیر تضمین شود.
 */
export async function ensureWithdrawalsTable(): Promise<void> {
  const pool = await db();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS withdrawals (
       id BIGSERIAL PRIMARY KEY,
       player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
       unique_param TEXT NOT NULL UNIQUE,
       amount NUMERIC(18,6) NOT NULL,
       to_address TEXT NOT NULL,
       network TEXT NOT NULL,
       gateway_uuid TEXT,
       status TEXT NOT NULL DEFAULT 'requested',
       error TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  // شناسه‌ی تراکنش روی زنجیره. تنها مدرکِ قطعیِ «پول رفت» — رشته‌ی وضعیتِ
  // درگاه این را نمی‌گوید (`SUCCESS` را همان لحظه‌ی ثبت می‌دهد).
  await pool.query(
    "ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS txid TEXT"
  );
}

/** اعتبارسنجی بدون هیچ اثر جانبی — برای نشان‌دادن خطا پیش از تأیید نهایی. */
export function checkWithdrawInput(
  amount: number,
  toAddress: string
): WithdrawError | null {
  if (!gatewayReady()) return "gateway_off";
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) return "amount_too_low";
  if (!withdrawAddressValid(toAddress, USDT_NETWORK)) return "bad_address";
  return null;
}

export async function requestWithdrawal(
  playerId: number,
  rawAmount: number,
  rawAddress: string
): Promise<WithdrawResult> {
  const amount = Number(rawAmount);
  const toAddress = String(rawAddress ?? "").trim();

  const bad = checkWithdrawInput(amount, toAddress);
  if (bad) return { ok: false, error: bad };

  await ensureIrTables();
  await ensureWithdrawalsTable();
  const pool = await db();

  const recent = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM withdrawals
      WHERE player_id=$1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [playerId, String(WINDOW_MIN)]
  );
  if (Number(recent.rows[0]?.n ?? 0) >= MAX_PER_WINDOW) {
    return { ok: false, error: "rate_limited" };
  }

  const uniqueParam = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // پول *پیش از* تماس با درگاه کسر می‌شود تا کاربر نتواند با درخواست
    // همزمان بیشتر از موجودی‌اش برداشت کند.
    //
    // ⚠️ **فقط `usdt_balance` سنجیده می‌شود، نه مجموع با دمو.** اینجا تنها
    // جایی است که ممنوعیتِ برداشتِ پول دمو اجرا می‌شود: بونوس می‌تواند شرط
    // ببندد، ولی خودش هرگز از سیستم بیرون نمی‌رود. سودی که از آن به دست
    // آمده در لحظه‌ی تسویه واقعی شده و همین‌جا قابل برداشت است.
    const pl = await client.query(
      "SELECT usdt_balance FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount || Number(pl.rows[0].usdt_balance) < amount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "insufficient_funds" };
    }

    await moveFunds(client, playerId, -amount, "withdraw_hold", uniqueParam, {
      realOnly: true,
    });
    await client.query(
      `INSERT INTO withdrawals (player_id, unique_param, amount, to_address, network)
       VALUES ($1,$2,$3,$4,$5)`,
      [playerId, uniqueParam, amount, toAddress, USDT_NETWORK]
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    return { ok: false, error: "server_error" };
  }
  client.release();

  // تماس با درگاه *بیرون* از ترنزاکشن، تا قفل دیتابیس منتظر شبکه نماند.
  //
  // ⚠️ مبلغی که به درگاه می‌دهیم **منهای کارمزد** است. درگاه کارمزد را
  // جدا و علاوه بر این عدد از استخر پروژه برمی‌دارد، پس اگر کل مبلغ را
  // می‌فرستادیم، استخر به اندازه‌ی مبلغ + کارمزد سبک می‌شد در حالی که از
  // کاربر فقط مبلغ کم شده بود — یعنی هر برداشت ۳ تتر از پول کاربران دیگر
  // آب می‌کرد. حالا استخر دقیقا به اندازه‌ی همان چیزی سبک می‌شود که از
  // حساب کاربر کم شده.
  const r = await createWithdrawal({
    amount: receivedAfterFee(amount).toFixed(6),
    toAddress,
    uniqueParam,
  });

  if (!r.ok) {
    // درگاه نپذیرفت — پول را برمی‌گردانیم.
    const c2 = await pool.connect();
    try {
      await c2.query("BEGIN");
      await c2.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [playerId]);
      await moveFunds(c2, playerId, amount, "withdraw_refund", uniqueParam);
      await c2.query(
        "UPDATE withdrawals SET status='failed', error=$2 WHERE unique_param=$1",
        [uniqueParam, r.error]
      );
      await c2.query("COMMIT");
    } catch {
      await c2.query("ROLLBACK").catch(() => {});
    } finally {
      c2.release();
    }
    return { ok: false, error: r.error };
  }

  await pool.query(
    "UPDATE withdrawals SET status='submitted', gateway_uuid=$2 WHERE unique_param=$1",
    [uniqueParam, r.data.uuid]
  );

  // اعلان تلگرام — تنها لایه‌ی هشدار روی برداشت.
  //
  // برداشت تنها عملی است که پول را از پلتفرم بیرون می‌برد و برگشت‌ناپذیر
  // است، و هیچ تأیید دومی ندارد. این پیام جلوی سوءاستفاده را نمی‌گیرد، ولی
  // به صاحب حساب فرصت می‌دهد بلافاصله بفهمد و خبر بدهد. خطایش عمدا بلعیده
  // می‌شود: نرسیدن پیام نباید برداشتی را که در درگاه ثبت شده خراب کند.
  notifyPlayer(
    playerId,
    `🔔 درخواست برداشت <b>${amount}</b> تتر از حساب نارمون ثبت شد.\n\n` +
      `کارمزد شبکه: <b>${WITHDRAW_FEE_USDT}</b> تتر · ` +
      `دریافتی شما: <b>${receivedAfterFee(amount)}</b> تتر\n` +
      `مقصد: <code>${toAddress.slice(0, 6)}…${toAddress.slice(-6)}</code>\n\n` +
      `اگر این درخواست کار شما نبوده، همین حالا به پشتیبانی خبر بدهید.`
  ).catch(() => {});

  return { ok: true, uuid: r.data.uuid, amount };
}
