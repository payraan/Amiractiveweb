// اتصال حساب سایت به تلگرام — پل ورود کاربر به کانال پیام‌رسانی مستقیم.
// وقتی آیدی عددی کاربر ذخیره شد، خود سایت می‌تواند بدون واسطه به او پیام بدهد.

import { randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export const GROUP_BONUS_CREDITS = 20; // هدیه‌ی عضویت در گروه
export const LINK_CODE_TTL_MIN = 15;

// ── ربات پلتفرم ──────────────────────────────────────────────
//
// این متغیرها فقط و فقط مال ربات نارمون‌اند. نام‌های قدیمی BOT_TOKEN /
// BOT_USERNAME / BOT_API_KEY عمدا کنار گذاشته شدند چون به ربات پشتیبانِ
// جداگانه اشاره می‌کردند و قاطی‌شدنشان یعنی پیام پلتفرم از دهان ربات دیگری
// بیرون بیاید.
//
// هیچ مقدار پیش‌فرضی اینجا نمی‌گذاریم. قبلا `|| "Amiractivesupportbot"`
// نوشته شده بود و این یعنی اگر متغیر ست نمی‌شد، لینک اتصالِ کاربر بی‌سروصدا
// به ربات اشتباه می‌رفت و هیچ خطایی هم دیده نمی‌شد. مثل SESSION_SECRET،
// اینجا هم fail-closed است: بدون تنظیمات، قابلیت خاموش می‌ماند و صریح
// می‌گوید چرا.
const BOT_TOKEN = process.env.TG_BOT_TOKEN ?? "";
export const BOT_USERNAME = process.env.TG_BOT_USERNAME ?? "";

const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET ?? "";
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

/** آیا ربات پلتفرم پیکربندی شده؟ بدون این، مسیرهای تلگرام باید ۵۰۳ بدهند. */
export function botReady(): boolean {
  return Boolean(BOT_TOKEN && BOT_USERNAME);
}

/**
 * تأیید اینکه درخواست وبهوک واقعا از تلگرام آمده.
 *
 * تلگرام همان رشته‌ای را که موقع setWebhook دادیم در هدر
 * X-Telegram-Bot-Api-Secret-Token برمی‌گرداند. آدرس وبهوک عمومی است، پس
 * بدون این چک هرکسی می‌توانست آپدیت جعلی بفرستد و به نام هر آیدی تلگرامی
 * حساب وصل کند.
 *
 * fail-closed: اگر رمز ست نشده باشد، هیچ درخواستی پذیرفته نمی‌شود.
 */
export function webhookSecretValid(provided: string | null): boolean {
  if (!WEBHOOK_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** آدرس وبهوکی که به تلگرام اعلام می‌کنیم. */
export function webhookUrl(): string {
  return SITE_URL ? `${SITE_URL}/api/tg/webhook` : "";
}

type TgResult<T> = { ok: true; result: T } | { ok: false; error: string };

/** تماس عمومی با Bot API. توکن هرگز از سرور بیرون نمی‌رود. */
export async function tgCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<TgResult<T>> {
  if (!BOT_TOKEN) return { ok: false, error: "bot_not_configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const j = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!j.ok) return { ok: false, error: j.description ?? `http_${res.status}` };
    return { ok: true, result: j.result as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

/** ثبت وبهوک نزد تلگرام — یک‌بار پس از هر تغییر دامنه یا رمز. */
export async function registerWebhook() {
  const url = webhookUrl();
  if (!url) return { ok: false as const, error: "site_url_missing" };
  if (!WEBHOOK_SECRET) return { ok: false as const, error: "webhook_secret_missing" };
  return tgCall("setWebhook", {
    url,
    secret_token: WEBHOOK_SECRET,
    // فقط همان چیزی که واقعا پردازش می‌کنیم. کم‌کردن دامنه یعنی ترافیک و
    // سطح حمله‌ی کمتر.
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

let ready: Promise<void> | null = null;
export async function ensureTelegramTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS tg_user_id BIGINT");
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS tg_linked_at TIMESTAMPTZ");
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS group_bonus_at TIMESTAMPTZ");
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS players_tg_user_id_key
           ON players (tg_user_id) WHERE tg_user_id IS NOT NULL`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS tg_link_codes (
           code TEXT PRIMARY KEY,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           used_at TIMESTAMPTZ
         )`
      );
    });
  }
  return ready;
}

/**
 * کد یک‌بارمصرف برای اتصال می‌سازد و لینک عمیق ربات را برمی‌گرداند.
 *
 * اگر ربات پیکربندی نشده باشد throw می‌کند — ساختن لینکی که به هیچ ربات
 * معتبری نمی‌رسد بدتر از خطا دادن است: کاربر روی دکمه می‌زند، چیزی باز
 * می‌شود، و فکر می‌کند وصل شده.
 */
export async function createLinkCode(
  playerId: number
): Promise<{ code: string; deepLink: string }> {
  if (!botReady()) throw new Error("bot_not_configured");
  await ensureTelegramTables();
  const pool = await db();
  const code = randomBytes(9).toString("base64url");
  await pool.query("DELETE FROM tg_link_codes WHERE player_id=$1 AND used_at IS NULL", [
    playerId,
  ]);
  await pool.query("INSERT INTO tg_link_codes (code, player_id) VALUES ($1, $2)", [
    code,
    playerId,
  ]);
  return {
    code,
    deepLink: `https://t.me/${BOT_USERNAME}?start=link_${code}`,
  };
}

export type LinkResult =
  | { ok: true; playerId: number; displayName: string }
  | { ok: false; error: "bad_code" | "expired" | "already_used" | "tg_taken" };

/**
 * وبهوک پس از دریافت `/start link_<code>` این را صدا می‌زند تا اتصال نهایی شود.
 *
 * `handle` یوزرنیم فعلی تلگرام است و در `tg_handle` می‌نشیند — نه در
 * `tg_username`. کلید هویت `tg_user_id` است؛ هندل فقط برچسبی است که هر بار
 * تازه می‌شود، چون کاربر می‌تواند عوضش کند و ممکن است اصلا نداشته باشد.
 */
export async function consumeLinkCode(
  code: string,
  tgUserId: number,
  handle?: string | null
): Promise<LinkResult> {
  await ensureTelegramTables();
  const pool = await db();

  const row = await pool.query<{
    player_id: number;
    created_at: string;
    used_at: string | null;
  }>("SELECT player_id, created_at, used_at FROM tg_link_codes WHERE code=$1", [code]);

  if (!row.rowCount) return { ok: false, error: "bad_code" };
  if (row.rows[0].used_at) return { ok: false, error: "already_used" };

  const ageMin = (Date.now() - new Date(row.rows[0].created_at).getTime()) / 60000;
  if (ageMin > LINK_CODE_TTL_MIN) return { ok: false, error: "expired" };

  const playerId = row.rows[0].player_id;

  const taken = await pool.query(
    "SELECT id FROM players WHERE tg_user_id=$1 AND id <> $2",
    [tgUserId, playerId]
  );
  if (taken.rowCount) return { ok: false, error: "tg_taken" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query<{ display_name: string }>(
      `UPDATE players SET tg_user_id=$1, tg_linked_at=now(), tg_handle=$3
        WHERE id=$2 RETURNING display_name`,
      [tgUserId, playerId, handle ? handle.replace(/^@+/, "") : null]
    );
    await client.query("UPDATE tg_link_codes SET used_at=now() WHERE code=$1", [code]);
    await client.query("COMMIT");
    return {
      ok: true,
      playerId,
      displayName: upd.rows[0]?.display_name ?? "",
    };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: "bad_code" };
  } finally {
    client.release();
  }
}

/**
 * حسابِ متصل به این آیدی تلگرام را برمی‌گرداند و هم‌زمان هندلش را تازه می‌کند.
 *
 * هر آپدیتی که از تلگرام می‌رسد جدیدترین یوزرنیم کاربر را همراه دارد، پس
 * همین‌جا می‌نویسیمش تا `tg_handle` هرگز بیات نشود. اگر کاربر یوزرنیمش را
 * برداشته باشد، NULL می‌شود — که درست است، نه اینکه مقدار قدیمی بماند.
 */
export async function playerByTgUserId(
  tgUserId: number,
  handle?: string | null
): Promise<{ id: number; displayName: string } | null> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ id: number; display_name: string }>(
    `UPDATE players SET tg_handle=$2
      WHERE tg_user_id=$1
      RETURNING id, display_name`,
    [tgUserId, handle ? handle.replace(/^@+/, "") : null]
  );
  if (!r.rowCount) return null;
  return { id: r.rows[0].id, displayName: r.rows[0].display_name };
}

/** هدیه‌ی عضویت گروه — فقط یک بار برای هر حساب. */
export async function grantGroupBonus(
  tgUserId: number
): Promise<{ granted: boolean; credits: number }> {
  await ensureTelegramTables();
  const pool = await db();
  const res = await pool.query<{ credits: number }>(
    `UPDATE players SET credits = credits + $1, group_bonus_at = now()
      WHERE tg_user_id=$2 AND group_bonus_at IS NULL
      RETURNING credits`,
    [GROUP_BONUS_CREDITS, tgUserId]
  );
  return {
    granted: (res.rowCount ?? 0) > 0,
    credits: res.rows[0]?.credits ?? 0,
  };
}

/**
 * آیا این حساب هویت تلگرام اثبات‌شده دارد؟
 *
 * مرز مصوب مالک (۲۰۲۶/۰۸/۰۹): شرط هر عمل *پولی* — واریز، شرط، ساخت بازار،
 * برداشت. بازی‌های امتیازی آزادند. مرز عمدا روی «ورود پول» است نه «خروج
 * پول»: اگر فقط برداشت را قفل کنیم، کاربر واریز و شرط می‌کند و تازه آن‌وقت
 * می‌فهمد پولش گیر کرده — بدترین حالت ممکن برای اعتماد.
 *
 * هنوز به هیچ روتی وصل نشده: تا وقتی مینی‌اپ راه نیفتاده، روشن‌کردنش پول
 * همه را قفل می‌کند بدون اینکه راهی برای اتصال وجود داشته باشد.
 */
export async function hasLinkedTelegram(playerId: number): Promise<boolean> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ tg_user_id: string | null }>(
    "SELECT tg_user_id FROM players WHERE id=$1",
    [playerId]
  );
  return Boolean(r.rows[0]?.tg_user_id);
}

export type TgStatus = {
  linked: boolean;
  bonusClaimed: boolean;
  bonusCredits: number;
};

export async function getTgStatus(playerId: number): Promise<TgStatus> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ tg_user_id: string | null; group_bonus_at: string | null }>(
    "SELECT tg_user_id, group_bonus_at FROM players WHERE id=$1",
    [playerId]
  );
  return {
    linked: Boolean(r.rows[0]?.tg_user_id),
    bonusClaimed: Boolean(r.rows[0]?.group_bonus_at),
    bonusCredits: GROUP_BONUS_CREDITS,
  };
}

/** دکمه‌های شیشه‌ای زیر پیام — همان چیزی که هویت رأی‌دهنده را می‌دهد. */
export type InlineButton = { text: string; url?: string; callback_data?: string };

/** ارسال پیام مستقیم از سایت به کاربر — بدون نیاز به دخالت ربات. */
export async function sendTelegram(
  tgUserId: number,
  text: string,
  buttons?: InlineButton[][]
): Promise<boolean> {
  const r = await tgCall("sendMessage", {
    chat_id: tgUserId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
  return r.ok;
}

/** پیام به کاربر بر اساس شناسه‌ی بازیکن (اگر تلگرامش وصل باشد). */
export async function notifyPlayer(playerId: number, text: string): Promise<boolean> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ tg_user_id: string | null }>(
    "SELECT tg_user_id FROM players WHERE id=$1",
    [playerId]
  );
  const id = r.rows[0]?.tg_user_id;
  if (!id) return false;
  return sendTelegram(Number(id), text);
}
