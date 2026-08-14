// اتصال حساب سایت به تلگرام — پل ورود کاربر به کانال پیام‌رسانی مستقیم.
// وقتی آیدی عددی کاربر ذخیره شد، خود سایت می‌تواند بدون واسطه به او پیام بدهد.

import { randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { WELCOME_CREDITS } from "@/lib/game";

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

// trim چون فضای خالی یا خط جدیدِ اضافه در پنل متغیرها دیده نمی‌شود ولی
// مقدار را خراب می‌کند — و چون تلگرام همان رشته را برمی‌گرداند، مقایسه‌ی
// وبهوک هم باید با همان مقدار trim‌شده باشد.
const WEBHOOK_SECRET = (process.env.TG_WEBHOOK_SECRET ?? "").trim();
const SITE_URL = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");

/**
 * تلگرام برای secret_token فقط A-Z a-z 0-9 _ - را می‌پذیرد (۱ تا ۲۵۶ کاراکتر).
 *
 * این را خودمان اینجا می‌سنجیم تا خطا پیش از تماس با تلگرام و به زبان خودمان
 * گفته شود. تله‌ی رایج: `openssl rand -base64 32` که + و / و = تولید می‌کند و
 * تلگرام ردش می‌کند. مقدار درست با `openssl rand -hex 32` ساخته می‌شود.
 */
export function webhookSecretShapeValid(): boolean {
  return /^[A-Za-z0-9_-]{1,256}$/.test(WEBHOOK_SECRET);
}

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
  params: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {}
): Promise<TgResult<T>> {
  if (!BOT_TOKEN) return { ok: false, error: "bot_not_configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
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
/**
 * ایراد پیکربندی وبهوک، پیش از هر تماسی با تلگرام. `null` یعنی سالم.
 *
 * هم دکمه‌ی ثبت از این استفاده می‌کند و هم صفحه‌ی وضعیت — تا ایراد *قبل* از
 * فشردن دکمه دیده شود، نه به شکل یک «Bad Request» مبهم بعد از آن.
 */
export function webhookConfigError():
  | "site_url_missing"
  | "site_url_not_https"
  | "webhook_secret_missing"
  | "webhook_secret_invalid"
  | null {
  const url = webhookUrl();
  if (!url) return "site_url_missing";
  // تلگرام فقط وبهوک HTTPS می‌پذیرد.
  if (!url.startsWith("https://")) return "site_url_not_https";
  if (!WEBHOOK_SECRET) return "webhook_secret_missing";
  if (!webhookSecretShapeValid()) return "webhook_secret_invalid";
  return null;
}

export async function registerWebhook() {
  const url = webhookUrl();
  const bad = webhookConfigError();
  if (bad) return { ok: false as const, error: bad };
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
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS tg_blocked_at TIMESTAMPTZ");
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS tg_checked_at TIMESTAMPTZ");
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

/**
 * حساب متناظر با یک کاربر تلگرام را پیدا می‌کند، و اگر نبود می‌سازد.
 *
 * این تنها مسیر ثبت‌نامی است که هویتش واقعا اثبات شده — چون فقط پس از
 * اعتبارسنجی initData صدا زده می‌شود. مسیر قدیمیِ یوزرنیم+رمز هیچ اثباتی
 * نداشت و همان حفره‌ای بود که این فاز برای بستنش باز شد.
 *
 * قاعده‌ی تصادم (مصوب): کلید هویت `tg_user_id` است و همیشه برنده است.
 * اگر هندل تلگرام قبلا به‌عنوان یوزرنیمِ ورودِ حساب دیگری گرفته شده باشد،
 * حساب تازه با یوزرنیم خالی ساخته می‌شود — حساب قدیمی نه تغییر نام می‌دهد،
 * نه حذف می‌شود، نه خودکار ادغام می‌شود. ادغام خودکار روی تطابق هندل یعنی
 * تحویل موجودی و سابقه‌ی یک غریبه به هر کسی که آن هندل را دارد.
 */
export async function findOrCreateTgPlayer(user: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}): Promise<{ id: number; displayName: string; created: boolean }> {
  const handle = user.username ? user.username.replace(/^@+/, "") : null;

  const existing = await playerByTgUserId(user.id, handle);
  if (existing) return { ...existing, created: false };

  const pool = await db();
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim().slice(0, 40) ||
    handle ||
    "کاربر نارمون";

  // یوزرنیمِ ورود فقط اگر آزاد باشد برداشته می‌شود. خالی‌بودنش مشکلی نیست:
  // این حساب رمز ندارد و هرگز از مسیر رمز وارد نمی‌شود.
  const free = handle
    ? !(await pool.query("SELECT 1 FROM players WHERE tg_username=$1", [
        handle.toLowerCase(),
      ])).rowCount
    : false;

  const insert = async (username: string | null) =>
    pool.query<{ id: number; display_name: string }>(
      `INSERT INTO players
         (tg_username, display_name, password_hash, credits, tg_user_id, tg_handle, tg_linked_at)
       VALUES ($1,$2,NULL,$3,$4,$5,now())
       ON CONFLICT (tg_user_id) WHERE tg_user_id IS NOT NULL DO NOTHING
       RETURNING id, display_name`,
      [username, displayName, WELCOME_CREDITS, user.id, handle]
    );

  let res;
  try {
    res = await insert(free && handle ? handle.toLowerCase() : null);
  } catch (err) {
    // مسابقه‌ی نادر روی یوزرنیم: بین چک و درج، کس دیگری همان را گرفت.
    if ((err as { code?: string })?.code === "23505") {
      res = await insert(null);
    } else {
      throw err;
    }
  }

  if (res.rowCount) {
    return { id: res.rows[0].id, displayName: res.rows[0].display_name, created: true };
  }

  // ON CONFLICT چیزی برنگرداند: یعنی درخواست همزمانِ دیگری زودتر ساختش.
  const again = await playerByTgUserId(user.id, handle);
  if (again) return { ...again, created: false };
  throw new Error("tg_account_create_failed");
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
  /** ربات بلاک شده — مسیرهای ورودِ پول قفل‌اند تا آنبلاک شود. */
  blocked: boolean;
  bonusClaimed: boolean;
  bonusCredits: number;
};

export async function getTgStatus(playerId: number): Promise<TgStatus> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ group_bonus_at: string | null }>(
    "SELECT group_bonus_at FROM players WHERE id=$1",
    [playerId]
  );
  // همان بازبینی مسیر پولی، تا صفحه‌ی وضعیت با آنچه هنگام خرج‌کردن اتفاق
  // می‌افتد یکی باشد. ولی این روت با هر بارگذاری صفحه صدا زده می‌شود (نوار
  // بالا)، پس اینجا نتیجه تا TTL کش می‌شود؛ مسیر پولی خودش همیشه تازه
  // می‌پرسد.
  const link = await checkTelegramLink(playerId, { maxAgeMs: TG_CHECK_TTL_MS });
  return {
    linked: link.linked,
    blocked: link.blocked,
    bonusClaimed: Boolean(r.rows[0]?.group_bonus_at),
    bonusCredits: GROUP_BONUS_CREDITS,
  };
}

/**
 * فرار دادن متنِ کاربر قبل از رفتن داخل پیام HTML تلگرام.
 *
 * همه‌ی پیام‌های ربات با parse_mode=HTML می‌روند، و سؤال بازار را کاربر
 * می‌نویسد. بدون این، دو چیز خراب می‌شد:
 *
 *  ۱. شکستن: سؤالی مثل «قیمت > ۹۰ هزار» تگ نامعتبر می‌ساخت، تلگرام کل پیام
 *     را رد می‌کرد و کارت بازار بی‌سروصدا منتشر نمی‌شد.
 *  ۲. جعل: تلگرام در حالت HTML تگ <a href> را می‌پذیرد، پس می‌شد لینک
 *     دلخواه با متن دلخواه داخل پستِ کانال رسمی نارمون جا داد — یعنی
 *     فیشینگ با اعتبار کانال خودمان.
 *
 * فقط همین سه کاراکتر: تلگرام برای HTML خودش دقیقا همین‌ها را می‌خواهد.
 */
export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * دکمه‌های شیشه‌ای زیر پیام — همان چیزی که هویت رأی‌دهنده را می‌دهد.
 *
 * `web_app` مینی‌اپ را همان‌جا داخل تلگرام باز می‌کند، بدون بیرون‌رفتن به
 * مرورگر. **فقط در چت خصوصی کار می‌کند**؛ برای کانال باید `url` با
 * `t.me/<bot>/<app>?startapp=` استفاده شود.
 */
export type InlineButton = {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
};

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
  if (!r.ok) await noteSendFailure(tgUserId, r.error);
  return r.ok;
}

// ═══ تشخیص بلاک‌شدن ربات ═════════════════════════════════════
//
// ضدتقلبِ همه‌ی مکانیزم‌های پاداش روی «یک نفر = یک حساب» ایستاده و تنها
// لنگر آن، حساب تلگرام است. اگر کاربر بعد از اتصال ربات را بلاک کند، آن
// لنگر عملا از بین می‌رود: نه اعلان برداشت به او می‌رسد، نه هیچ پیام
// امنیتی دیگری. پس تا وقتی از پلتفرم استفاده می‌کند باید ربات را نگه دارد.
//
// ── تشخیص رایگان است ──
// وقتی ربات بلاک شده باشد، تلگرام به sendMessage خطای
// «Forbidden: bot was blocked by the user» می‌دهد. یعنی همان پیام‌هایی که
// به‌هرحال می‌فرستیم، خودشان آشکارساز‌اند و هیچ تماس اضافه‌ای لازم نیست.
// بررسی دوره‌ای با getChat روی ده‌ها هزار حساب عمدا ساخته نشد.
//
// ⚠️ فقط همین یک خطا علامت می‌زند. «chat not found» و «user is deactivated»
// عمدا کنار گذاشته شده‌اند: اولی مبهم است و دومی حسابی است که کاربر هیچ
// راهی برای درست‌کردنش ندارد، پس قفل‌کردنش فقط یک بن‌بست می‌سازد.
const BLOCKED_RE = /bot was blocked by the user/i;

/** خطای ارسال را می‌بیند و اگر «بلاک» بود، حساب را علامت می‌زند. */
async function noteSendFailure(tgUserId: number, error: string): Promise<void> {
  if (!BLOCKED_RE.test(error)) return;
  try {
    await markTelegramBlocked(tgUserId);
  } catch {
    // علامت‌زدن نباید مسیر اصلی را بشکند.
  }
}

/** علامت بلاک را می‌زند و زمان بررسی را تازه می‌کند. */
export async function markTelegramBlocked(tgUserId: number): Promise<void> {
  await ensureTelegramTables();
  const pool = await db();
  await pool.query(
    `UPDATE players
        SET tg_blocked_at = COALESCE(tg_blocked_at, now()),
            tg_checked_at = now()
      WHERE tg_user_id = $1`,
    [tgUserId]
  );
}

/**
 * علامت بلاک را برمی‌دارد.
 *
 * از وبهوک هم صدا زده می‌شود: هر پیام یا کلیکی که از کاربر برسد یعنی چت باز
 * است. آن مسیر هیچ تماسی با تلگرام لازم ندارد.
 */
export async function clearTelegramBlocked(tgUserId: number): Promise<void> {
  await ensureTelegramTables();
  const pool = await db();
  await pool.query(
    "UPDATE players SET tg_blocked_at=NULL, tg_checked_at=now() WHERE tg_user_id=$1",
    [tgUserId]
  );
}

/**
 * بازبینی زنده‌ی چت، بدون فرستادن هیچ پیامی.
 *
 * sendChatAction فقط نشانگر «در حال تایپ» را روشن می‌کند — چیزی در چت
 * نمی‌ماند — ولی اگر ربات بلاک باشد همان ۴۰۳ را می‌دهد. getChat به این کار
 * نمی‌آید چون برای کاربرِ بلاک‌کننده هم موفق برمی‌گردد.
 *
 * ⚠️ سه حالت دارد و این تفکیک حیاتی است. اگر «هر خطایی» را بلاک بگیریم، یک
 * قطعی تلگرام یا توکن اشتباه، *همه‌ی* کاربران را از خرج‌کردن قفل می‌کند. پس:
 *
 *   • `blocked` فقط با همان رشته‌ی صریح تلگرام — تنها چیزی که علامت می‌زند.
 *   • `open`    فقط با پاسخ موفق — تنها چیزی که علامت را برمی‌دارد.
 *   • `unknown` هر چیز دیگر: وضعیت ذخیره‌شده دست‌نخورده می‌ماند.
 *
 * تایم‌اوت کوتاه است چون این تماس داخل مسیر خرج‌کردن کاربر می‌نشیند؛ تلگرامِ
 * کند نباید ثبت پیش‌بینی را معطل کند. تایم‌اوت هم `unknown` است.
 */
async function probeChat(tgUserId: number): Promise<"open" | "blocked" | "unknown"> {
  const r = await tgCall(
    "sendChatAction",
    { chat_id: tgUserId, action: "typing" },
    { timeoutMs: 5000 }
  );
  if (r.ok) return "open";
  return BLOCKED_RE.test(r.error) ? "blocked" : "unknown";
}

export type TgLink = { linked: boolean; blocked: boolean };

/** فاصله‌ی پیش‌فرض بین دو بازبینی برای نمایش وضعیت. */
export const TG_CHECK_TTL_MS = 10 * 60 * 1000;

/**
 * وضعیت اتصال تلگرام.
 *
 * ⚠️ **چرا اینجا فعالانه بازبینی می‌شود:** بلاک‌کردن ربات هیچ خبری به ما
 * نمی‌دهد. اگر فقط منتظر شکستِ ارسال بمانیم، کاربری که ربات را بلاک کرده تا
 * وقتی اتفاقی پیامی برایش نفرستیم «سالم» می‌ماند — و ممکن است هرگز نفرستیم.
 * نسخه‌ی اول همین ایراد را داشت و در تست مالک هیچ‌چیز قفل نشد.
 *
 * `maxAgeMs` هزینه را مهار می‌کند: مسیرهای پولی صفر می‌دهند (همیشه بازبینی،
 * چون آنجا دقت مهم‌تر از یک رفت‌وبرگشت است) و نمایش وضعیت `TG_CHECK_TTL_MS`.
 */
export async function checkTelegramLink(
  playerId: number,
  opts: { maxAgeMs?: number } = {}
): Promise<TgLink> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{
    tg_user_id: string | null;
    tg_blocked_at: string | null;
    tg_checked_at: string | null;
  }>(
    "SELECT tg_user_id, tg_blocked_at, tg_checked_at FROM players WHERE id=$1",
    [playerId]
  );
  const row = r.rows[0];
  if (!row?.tg_user_id) return { linked: false, blocked: false };

  const tgId = Number(row.tg_user_id);
  const stored = Boolean(row.tg_blocked_at);

  const maxAge = opts.maxAgeMs ?? 0;
  if (maxAge > 0 && row.tg_checked_at) {
    const age = Date.now() - new Date(row.tg_checked_at).getTime();
    if (age < maxAge) return { linked: true, blocked: stored };
  }

  const state = await probeChat(tgId);
  if (state === "blocked") {
    await markTelegramBlocked(tgId);
    return { linked: true, blocked: true };
  }
  if (state === "open") {
    await clearTelegramBlocked(tgId);
    return { linked: true, blocked: false };
  }
  // unknown: زمان بررسی هم به‌روز نمی‌شود تا دفعه‌ی بعد دوباره تلاش شود.
  return { linked: true, blocked: stored };
}

// ── نظرسنجی بازار در کانال ───────────────────────────────────
//
// عمدا poll بومی تلگرام نیست. poll بومی هویت رأی‌دهنده را نمی‌دهد، پس نه
// می‌شود رأی را به حسابی وصل کرد و نه شرط تتری ثبت کرد — یعنی حلقه‌ی امتیاز
// و پول بسته نمی‌شود. دکمه‌ی شیشه‌ای با لینک مینی‌اپ این را حل می‌کند:
// کاربر روی همان بازار وارد اپ می‌شود و آنجا هویتش با initData اثبات است.
//
// دکمه‌ها لینک‌اند نه callback_query: با لینک، تلگرام خودش مینی‌اپ را روی
// همان بازار باز می‌کند و ما یک رفت‌وبرگشت و یک حالت میانی کمتر داریم.

export type MarketPollInput = {
  id: number;
  question: string;
  category: string;
  yesPct: number;
  bettors: number;
  volume: number;
  closesAt: string;
};

function bar(yesPct: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, yesPct)) / 100) * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function faDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "long",
    day: "numeric",
  });
}

/**
 * حالت کارت:
 *  • forward — دکمه‌های لینک. موقع فوروارد باقی می‌مانند، ولی نسخه‌ی
 *    فوروارد‌شده پیام مستقلی است که ربات نمی‌تواند ویرایشش کند، پس درصدهایش
 *    برای همیشه روی همان لحظه یخ می‌زند. کارت این را صریح می‌گوید.
 *  • live — دکمه‌های callback. رأی درجا می‌گیرند و ربات می‌تواند پیام را
 *    ویرایش کند، ولی *در فوروارد حذف می‌شوند*. فقط وقتی معنی دارد که خودِ
 *    ربات مستقیم در کانال پست کرده باشد، یعنی آنجا ادمین باشد.
 *
 * این دوگانگی انتخاب ما نیست؛ محدودیت خود تلگرام است. هر کدام یکی از دو
 * چیز را می‌دهد و نمی‌شود هر دو را با هم داشت.
 */
export type PollMode = "forward" | "live";

/** متن و دکمه‌های پیام نظرسنجی یک بازار. */
export function marketPoll(
  m: MarketPollInput,
  mode: PollMode = "forward"
): { text: string; buttons: InlineButton[][] } {
  const noPct = Math.round((100 - m.yesPct) * 10) / 10;
  const app = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}/market` : "";
  const deep = app ? `${app}?startapp=market_${m.id}` : "";

  const freshness =
    mode === "live"
      ? "🔄 درصدها خودکار به‌روز می‌شوند"
      : "💡 درصدهای فوق مربوط به لحظه اشتراک‌گذاری هستند. برای مشاهده آمار لحظه‌ای و ثبت پیش‌بینی، روی دکمه‌های زیر کلیک کنید.";

  const text =
    `📊 <b>بازار پیش‌بینی جدید در نارمون:</b>\n\n` +
    `🔹 ${escapeHtml(m.question)}\n\n` +
    `<code>${bar(m.yesPct)}</code>\n` +
    `🟩 بله ${m.yesPct}٪  ·  🟥 خیر ${noPct}٪\n\n` +
    `👥 تعداد پیش‌بینی‌ها: ${m.bettors} نفر\n` +
    `💎 مجموع استخر: ${m.volume.toFixed(0)} USDT\n` +
    `⏳ مهلت باقی‌مانده: تا ${faDate(m.closesAt)}\n` +
    `${freshness}\n\n` +
    `⚖ نظر شما با اکثریت موافق است یا مخالف؟ پیش‌بینی دقیق خود را ثبت کنید ` +
    `و از استخر تتری (USDT) پاداش بگیرید.`;

  if (mode === "live") {
    // callback_data سقف ۶۴ بایت دارد، پس کوتاه نگه داشته می‌شود.
    return {
      text,
      buttons: [
        [
          { text: `✅ بله (${m.yesPct}٪)`, callback_data: `v:y:${m.id}` },
          { text: `❌ خیر (${noPct}٪)`, callback_data: `v:n:${m.id}` },
        ],
        ...(deep ? [[{ text: "📊 باز کردن بازار", url: deep }]] : []),
      ],
    };
  }

  // دو دکمه‌ی بالا برای کسی که حساب دارد، دکمه‌ی سوم برای تازه‌وارد.
  // تشخیصِ «حساب دارد یا نه» را خود تلگرام انجام نمی‌دهد، پس هر دو مسیر
  // نشان داده می‌شود و مقصدشان یکی است — مینی‌اپ خودش می‌فهمد کاربر تازه
  // است و حساب می‌سازد.
  const buttons: InlineButton[][] = deep
    ? [
        [
          { text: `✅ بله (${m.yesPct}٪)`, url: `${deep}_yes` },
          { text: `❌ خیر (${noPct}٪)`, url: `${deep}_no` },
        ],
        [{ text: "📊 مشاهده بازار و ثبت پیش‌بینی", url: deep }],
        [{ text: "🆕 ساخت حساب کاربری (ثبت‌نام)", url: `${app}?startapp=join_${m.id}` }],
      ]
    : [];

  return { text, buttons };
}

/** ارسال نظرسنجی یک بازار به یک کانال یا گروه. */
export async function sendMarketPoll(
  chatId: string | number,
  m: MarketPollInput,
  mode: PollMode = "forward"
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const { text, buttons } = marketPoll(m, mode);
  if (!buttons.length) return { ok: false, error: "bot_not_configured" };
  const r = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons },
  });
  return r.ok
    ? { ok: true, messageId: r.result.message_id }
    : { ok: false, error: r.error };
}

/** ویرایش یک کارت منتشرشده با اعداد تازه. */
export async function editMarketPoll(
  chatId: string | number,
  messageId: number,
  m: MarketPollInput,
  mode: PollMode = "live"
): Promise<{ ok: boolean; error?: string }> {
  const { text, buttons } = marketPoll(m, mode);
  const r = await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons },
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** پاسخ فوری به لمس دکمه — توست کوچک بالای صفحه‌ی کاربر. */
/**
 * جای‌گزینی متن و دکمه‌های همان پیام.
 *
 * ناوبری منو با ویرایش انجام می‌شود نه با پیام تازه: با هر لمس یک پیام
 * جدید، چت کاربر بعد از چند کلیک پر از کارت‌های مرده می‌شود و پیدا کردن
 * منوی فعلی سخت. اینجا کاربر همیشه یک کارت دارد که عوض می‌شود.
 */
export async function editTelegram(
  chatId: number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][]
): Promise<boolean> {
  const r = await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons ?? [] },
  });
  // «message is not modified» یعنی کاربر همان دکمه را دوباره زده — خطا نیست.
  if (!r.ok && /message is not modified/i.test(r.error)) return true;
  if (!r.ok) await noteSendFailure(chatId, r.error);
  return r.ok;
}

/** فهرست دستورها در منوی کنار فیلد تایپ. */
export async function setBotCommands(
  commands: { command: string; description: string }[]
): Promise<{ ok: boolean; error?: string }> {
  const r = await tgCall("setMyCommands", {
    commands,
    scope: { type: "all_private_chats" },
    language_code: "fa",
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function answerCallback(
  callbackId: string,
  text: string,
  alert = false
): Promise<void> {
  await tgCall("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: alert,
  });
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
