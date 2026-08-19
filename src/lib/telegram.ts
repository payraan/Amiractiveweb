// اتصال حساب سایت به تلگرام — پل ورود کاربر به کانال پیام‌رسانی مستقیم.
// وقتی آیدی عددی کاربر ذخیره شد، خود سایت می‌تواند بدون واسطه به او پیام بدهد.

import { randomBytes, timingSafeEqual } from "crypto";
import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { WELCOME_CREDITS } from "@/lib/game";
import { losePoints, winPoints } from "@/lib/poly-scoring";

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
 * گروه/کانالی که هدیه‌ی عضویت به آن گره خورده — مثلا `-1002127501102`.
 *
 * ⚠️ بدون این مقدار، هدیه **داده نمی‌شود** (fail-closed). تا امروز عکسش
 * بود: `/bonus` بیست MOON را بی‌هیچ بررسی‌ای می‌داد و کسی که هرگز عضو
 * نشده بود هم می‌گرفت. چون MOON ارز ورودی چالش است و جایزه‌ی چالش حساب
 * واقعی، آن یعنی یک شیر باز به سمت پول واقعی.
 *
 * ربات باید در آن گروه **عضو** باشد تا `getChatMember` جواب بدهد؛ برای
 * کانال باید ادمین باشد.
 */
const GROUP_ID = (process.env.TG_GROUP_ID ?? "").trim();

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

/**
 * خطاهایی که «عادی»اند و نباید سطح `error` بگیرند.
 *
 * اگر اینها هم خطا شمرده شوند، فیلتر `@level:error` در روزهای پخش پر
 * می‌شود از چیزهایی که هیچ‌کس نمی‌تواند و نباید کاری‌شان بکند — و همان
 * چیزی که واقعا خراب است، لای آن‌ها گم می‌شود.
 */
const EXPECTED_TG_ERRORS =
  /bot was blocked by the user|message is not modified|user is deactivated|chat not found|message to edit not found|bot was kicked|query is too old|message can't be deleted|PARTICIPANT_ID_INVALID|user not found/i;
// ⚠️ `PARTICIPANT_ID_INVALID` و `user not found` عمدا اینجایند: تلگرام
// «این آدم عضو گروه نیست» را به شکل خطای ۴۰۰ جواب می‌دهد، نه پاسخ موفق.
// یعنی هر `/bonus` از یک غیرعضو — که حالت **عادی** است — یک لاگ سطح
// error می‌ساخت. در روز لانچ همان چیزی می‌شد که `@level:error` را
// بی‌فایده می‌کند. `groupMembership` خودش نتیجه را می‌فهمد و ثبت می‌کند.

/** بالاتر از این، تماس کند حساب می‌شود و جدا لاگ می‌گیرد. */
const TG_SLOW_MS = 2000;

/**
 * تماس عمومی با Bot API. توکن هرگز از سرور بیرون نمی‌رود.
 *
 * ⚠️ **این تنها دروازه‌ی خروجی به تلگرام است، پس ابزار مانیتورینگ هم
 * همین‌جاست.** هر پیام، ویرایش، دکمه و بررسی عضویت از این تابع رد می‌شود؛
 * لاگ‌گذاشتن در تک‌تک فراخوان‌ها هم پرهزینه بود و هم دیر یا زود یکی جا
 * می‌افتاد. یک نقطه یعنی پوشش کامل و بدون استثنا.
 *
 * `params` عمدا **لاگ نمی‌شود**: متن پیام کاربر، آدرس کیف پول و کپشن
 * همه آنجا هستند. فقط متد، مدت، و علت خطا ثبت می‌شود.
 */
export async function tgCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {}
): Promise<TgResult<T>> {
  if (!BOT_TOKEN) {
    log.error("tg.not_configured", { method });
    return { ok: false, error: "bot_not_configured" };
  }
  const t0 = Date.now();
  // شناسه‌ی چت تنها فیلدی است که برمی‌داریم — بدون آن، «ارسال ناموفق» را
  // نمی‌شود به هیچ کاربری نسبت داد و لاگ فقط یک شمارنده می‌شود.
  const chatId =
    typeof params.chat_id === "number" || typeof params.chat_id === "string"
      ? params.chat_id
      : undefined;
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
      parameters?: { retry_after?: number };
    };
    const ms = Date.now() - t0;

    if (!j.ok) {
      const error = j.description ?? `http_${res.status}`;
      const fields = { method, chatId, ms, status: res.status, err: error };
      // ۴۲۹ همیشه باید دیده شود: یعنی داریم به سقف تلگرام می‌خوریم و
      // پیام‌ها عقب می‌افتند.
      if (res.status === 429) {
        log.warn("tg.rate_limited", {
          ...fields,
          retryAfter: j.parameters?.retry_after,
        });
      } else if (EXPECTED_TG_ERRORS.test(error)) {
        log.debug("tg.call_rejected", fields);
      } else {
        log.error("tg.call_failed", fields);
      }
      return { ok: false, error };
    }

    if (ms > TG_SLOW_MS) log.warn("tg.slow", { method, chatId, ms });
    else log.debug("tg.call", { method, chatId, ms });
    return { ok: true, result: j.result as T };
  } catch (err) {
    const error = err instanceof Error ? err.message : "network_error";
    // تایم‌اوت و قطعی شبکه، برخلاف خطای منطقیِ تلگرام، همیشه مهم‌اند:
    // یعنی پیام اصلا نرفته و ما هم نمی‌دانیم رفته یا نه.
    log.error("tg.network_failed", {
      method,
      chatId,
      ms: Date.now() - t0,
      err: error,
    });
    return { ok: false, error };
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
      // پذیرش قوانین: هم لحظه‌اش و هم **نسخه‌ی متنی** که پذیرفته شده. بدون
      // نسخه، رکورد پذیرش بی‌ارزش است — متن که عوض شود، معلوم نیست کاربر چه
      // چیزی را قبول کرده بود.
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS terms_at TIMESTAMPTZ");
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS terms_version INTEGER");
      // آموزش اول ورود — عمدا در دیتابیس و نه localStorage: کاربری که اپ را
      // روی گوشی دوم باز می‌کند نباید دوباره سه اسلاید ببیند.
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS tour_at TIMESTAMPTZ");
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

  // ⚠️ هر شکستِ اتصال ثبت می‌شود. کد نامعتبرِ پشت‌سرهم از یک آیدی، الگوی
  // حدس‌زدن کد است — و کدِ درست یعنی تحویل یک حساب کامل.
  if (!row.rowCount) {
    log.warn("tg.link_failed", { tgUserId, reason: "bad_code" });
    return { ok: false, error: "bad_code" };
  }
  if (row.rows[0].used_at) {
    log.warn("tg.link_failed", {
      tgUserId,
      playerId: row.rows[0].player_id,
      reason: "already_used",
    });
    return { ok: false, error: "already_used" };
  }

  const ageMin = (Date.now() - new Date(row.rows[0].created_at).getTime()) / 60000;
  if (ageMin > LINK_CODE_TTL_MIN) {
    log.info("tg.link_failed", {
      tgUserId,
      playerId: row.rows[0].player_id,
      reason: "expired",
      ageMin: Math.round(ageMin),
    });
    return { ok: false, error: "expired" };
  }

  const playerId = row.rows[0].player_id;

  const taken = await pool.query(
    "SELECT id FROM players WHERE tg_user_id=$1 AND id <> $2",
    [tgUserId, playerId]
  );
  if (taken.rowCount) {
    // ⚠️ سیگنال چندحسابی: یک تلگرام که می‌خواهد به حساب دومی هم وصل شود.
    log.warn("tg.link_failed", {
      tgUserId,
      playerId,
      reason: "tg_taken",
      heldBy: taken.rows[0].id,
    });
    return { ok: false, error: "tg_taken" };
  }

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
    log.info("tg.linked", { playerId, tgUserId });
    return {
      ok: true,
      playerId,
      displayName: upd.rows[0]?.display_name ?? "",
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log.error("tg.link_error", {
      playerId,
      tgUserId,
      err: err instanceof Error ? err.message : "error",
    });
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
    // ⚠️ مهم‌ترین رویداد ضدتقلب: نرخ ساخت حساب. جهش ناگهانی یعنی یا کمپین
    // گرفته، یا کسی دارد حساب می‌سازد. `handleTaken` نشان می‌دهد هندلی که
    // آورده قبلا مالِ حساب دیگری بوده.
    log.info("tg.account_created", {
      playerId: res.rows[0].id,
      tgUserId: user.id,
      withHandle: Boolean(handle),
      handleTaken: Boolean(handle) && !free,
    });
    return { id: res.rows[0].id, displayName: res.rows[0].display_name, created: true };
  }

  // ON CONFLICT چیزی برنگرداند: یعنی درخواست همزمانِ دیگری زودتر ساختش.
  const again = await playerByTgUserId(user.id, handle);
  if (again) return { ...again, created: false };
  throw new Error("tg_account_create_failed");
}

/** آیا هدیه‌ی عضویت اصلا پیکربندی شده؟ */
export function groupBonusReady(): boolean {
  return Boolean(BOT_TOKEN && GROUP_ID);
}

/**
 * وضعیت عضویت یک کاربر در گروه هدیه.
 *
 * ⚠️ سه حالته و نامتقارن است — دقیقا همان الگوی `probeChat`:
 *
 *   • `member`  فقط با پاسخ موفقِ تلگرام و وضعیتِ صریحِ عضویت.
 *   • `left`    فقط با پاسخ موفق و وضعیت `left`/`kicked`.
 *   • `unknown` هر چیز دیگر (تایم‌اوت، قطعی تلگرام، ربات ادمین نیست).
 *
 * چرا این تفکیک: اگر «هر خطا» را «عضو نیست» بگیریم، یک دقیقه اختلال
 * تلگرام به همه می‌گوید «تو عضو نیستی» و کاربر واقعی گیج می‌شود. و اگر
 * برعکس، «هر خطا» را «عضو است» بگیریم، همان شیر بازِ قبلی برمی‌گردد.
 * پس در حالت مبهم **هیچ‌کاری نمی‌کنیم** و از کاربر می‌خواهیم دوباره
 * امتحان کند.
 *
 * `restricted` یعنی کاربر در گروه هست ولی محدود شده؛ فقط اگر `is_member`
 * باشد عضو حساب می‌شود — کسی که سکوت گرفته هنوز عضو است، کسی که بیرون
 * انداخته شده نه.
 */
export async function groupMembership(
  tgUserId: number
): Promise<"member" | "left" | "unknown"> {
  if (!groupBonusReady()) return "unknown";
  const r = await tgCall<{ status: string; is_member?: boolean }>(
    "getChatMember",
    { chat_id: GROUP_ID, user_id: tgUserId },
    { timeoutMs: 8000 }
  );
  if (!r.ok) {
    // «user not found» یعنی تلگرام قطعا می‌داند این آدم آنجا نیست — تنها
    // خطایی که معنای قطعی دارد. بقیه‌ی خطاها پیکربندی یا شبکه‌اند.
    if (/user not found|PARTICIPANT_ID_INVALID/i.test(r.error)) return "left";
    log.warn("tg.member_check_failed", { tgUserId, err: r.error });
    return "unknown";
  }
  const st = r.result?.status ?? "";
  if (st === "creator" || st === "administrator" || st === "member") return "member";
  if (st === "restricted") return r.result?.is_member ? "member" : "left";
  return "left"; // left | kicked
}

export type GroupBonusResult =
  | { ok: true; credits: number; granted: number }
  | {
      ok: false;
      reason: "not_configured" | "no_account" | "already" | "not_member" | "unknown";
    };

/**
 * هدیه‌ی عضویت گروه — فقط یک بار برای هر حساب، و **فقط با عضویت واقعی**.
 *
 * ترتیب عمدی است و هزینه را کم می‌کند: اول حساب، بعد «قبلا گرفته؟»، و
 * تازه بعدش تماس با تلگرام. کسی که ده بار `/bonus` بزند فقط یک بار
 * `getChatMember` می‌سازد.
 *
 * ⚠️ اعطا همچنان با همان `UPDATE … WHERE group_bonus_at IS NULL` اتمیک
 * انجام می‌شود، پس دو `/bonus` هم‌زمان هم دو بار پرداخت نمی‌کند.
 */
export async function grantGroupBonusForPlayer(
  playerId: number
): Promise<GroupBonusResult> {
  await ensureTelegramTables();
  const pool = await db();
  const r = await pool.query<{ tg_user_id: string | null }>(
    "SELECT tg_user_id FROM players WHERE id=$1",
    [playerId]
  );
  const tgId = Number(r.rows[0]?.tg_user_id ?? 0);
  // بدون تلگرامِ متصل، عضویتی برای سنجیدن وجود ندارد.
  if (!tgId) return { ok: false, reason: "no_account" };
  return grantGroupBonus(tgId);
}

export async function grantGroupBonus(tgUserId: number): Promise<GroupBonusResult> {
  await ensureTelegramTables();

  if (!groupBonusReady()) {
    log.warn("bonus.not_configured", { tgUserId });
    return { ok: false, reason: "not_configured" };
  }

  const pool = await db();
  const cur = await pool.query<{ id: number; group_bonus_at: string | null }>(
    "SELECT id, group_bonus_at FROM players WHERE tg_user_id=$1",
    [tgUserId]
  );
  if (!cur.rowCount) return { ok: false, reason: "no_account" };
  const playerId = cur.rows[0].id;
  if (cur.rows[0].group_bonus_at) return { ok: false, reason: "already" };

  const state = await groupMembership(tgUserId);
  if (state !== "member") {
    log.info("bonus.denied", { playerId, tgUserId, state });
    return { ok: false, reason: state === "left" ? "not_member" : "unknown" };
  }

  const res = await pool.query<{ credits: number }>(
    `UPDATE players SET credits = credits + $1, group_bonus_at = now()
      WHERE tg_user_id=$2 AND group_bonus_at IS NULL
      RETURNING credits`,
    [GROUP_BONUS_CREDITS, tgUserId]
  );
  // صفر ردیف یعنی درخواست هم‌زمانِ دیگری زودتر گرفتش.
  if (!res.rowCount) return { ok: false, reason: "already" };

  log.info("bonus.granted", {
    playerId,
    tgUserId,
    granted: GROUP_BONUS_CREDITS,
    credits: res.rows[0].credits,
  });
  return { ok: true, credits: res.rows[0].credits, granted: GROUP_BONUS_CREDITS };
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
 * رنگ دکمه — روی هر دو نوع دکمه کار می‌کند.
 *
 * از Bot API 9.4 (فوریه ۲۰۲۶) فیلد `style` اضافه شد. مستندات رسمی:
 * «Must be one of "danger" (red), "success" (green) or "primary" (blue).
 * If omitted, then an app-specific style is used.»
 *
 * ⚠️ سند فاز ۴ نوشته بود «Bot API هیچ فیلدی برای رنگ دکمه ندارد و تنها
 * اهرم ایموجی است». آن نتیجه‌گیری اشتباه بود — احتمالا پیش از ۹.۴ بررسی
 * شده. رنگ‌های ربات‌های خارجی همین فیلد است، نه ترفند.
 *
 * قاعده‌ی رنگ در نارمون، همان قاعده‌ی رنگ بقیه‌ی محصول:
 *   success → پول به داخل و کنش مثبت (واریز، تأیید)
 *   danger  → کنش برگشت‌ناپذیر یا خروج پول (برداشت)
 *   primary → مقصد اصلی (مینی‌اپ)
 * بقیه بی‌رنگ می‌مانند؛ اگر همه‌ی دکمه‌ها رنگی باشند، رنگ دیگر معنا ندارد.
 */
export type ButtonStyle = "danger" | "success" | "primary";

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
  style?: ButtonStyle;
};

/**
 * دکمه‌ی صفحه‌کلید ثابتِ پایین چت — جدا از دکمه‌ی شیشه‌ای.
 *
 * دو تفاوت بنیادی با `InlineButton`:
 *  • `callback_data` ندارد. لمسش فقط `text` را به‌عنوان پیام عادی می‌فرستد،
 *    پس مسیریابی‌اش از راه متن پیام است نه callback.
 *  • `url` ندارد، ولی `web_app` دارد — و آن هم **فقط در چت خصوصی** کار
 *    می‌کند. در گروه، تلگرام دکمه را می‌فرستد ولی لمسش هیچ کاری نمی‌کند.
 */
export type KeyboardButton = {
  text: string;
  web_app?: { url: string };
  style?: ButtonStyle;
};

/**
 * نصب صفحه‌کلید ثابت زیر فیلد تایپ.
 *
 * `is_persistent: true` یعنی تلگرام آن را باز نگه می‌دارد و کاربر برای
 * رسیدن به منو مجبور نیست دنبال پیام قدیمی بگردد — همان مشکلی که این
 * صفحه‌کلید برای حلش هست.
 *
 * ⚠️ یک پیام نمی‌تواند هم‌زمان `inline_keyboard` و `keyboard` داشته باشد؛
 * `reply_markup` یک فیلد است و یکی جای دیگری را می‌گیرد. برای همین این
 * صفحه‌کلید روی پیام خودش سوار می‌شود و کارت منو دست‌نخورده می‌ماند.
 */
export async function sendKeyboard(
  chatId: number,
  text: string,
  keyboard: KeyboardButton[][]
): Promise<number | null> {
  const r = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      keyboard,
      is_persistent: true,
      resize_keyboard: true, // وگرنه تلگرام ارتفاع کامل می‌دهد و نصف صفحه را می‌خورد
    },
  });
  if (!r.ok) {
    await noteSendFailure(chatId, r.error);
    return null;
  }
  // شناسه برمی‌گردد تا فراخوان بتواند پیامِ حاملِ صفحه‌کلید را پاک کند.
  return r.result?.message_id ?? null;
}

/**
 * حذف یک پیام. خطایش بی‌اهمیت است — پیامی که پاک نشود فقط یک پیام اضافه
 * است، نه یک خرابی.
 */
export async function deleteMessage(
  chatId: number,
  messageId: number
): Promise<void> {
  await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
}

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
    // فقط لبه‌ی تغییر لاگ می‌شود، نه هر بار بررسی — وگرنه یک کاربرِ
    // بلاک‌کرده که صفحه را باز نگه داشته، لاگ را پر می‌کند.
    if (!stored) log.warn("tg.blocked", { playerId, tgUserId: tgId });
    return { linked: true, blocked: true };
  }
  if (state === "open") {
    await clearTelegramBlocked(tgId);
    if (stored) log.info("tg.unblocked", { playerId, tgUserId: tgId });
    return { linked: true, blocked: false };
  }
  log.debug("tg.check_unknown", { playerId, tgUserId: tgId, stored });
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

/**
 * ورودی کارت — یکی از دو اقتصادِ پلتفرم.
 *
 * عمدا اتحاد تفکیک‌شده است و نه یک شکل با فیلدهای اختیاری: بازار ایران
 * استخر تتری دارد و بازار ترید امتیاز. اگر یک شکل مشترک بود، روزی متن تتری
 * روی کارت ترید می‌نشست و به کاربر وعده‌ی پولی داده می‌شد که وجود ندارد.
 * تایپ باید جلوی این را بگیرد، نه حواس‌جمعیِ نویسنده‌ی بعدی.
 *
 * ⚠️ `question` برای ترید باید از قبل فارسی‌شده باشد (`displayTitle`)؛
 * اینجا ترجمه‌ای انجام نمی‌شود.
 */
export type MarketPollInput =
  | {
      kind: "ir";
      id: number;
      question: string;
      category: string;
      yesPct: number;
      bettors: number;
      volume: number; // تتر
      closesAt: string;
    }
  | {
      kind: "trade";
      id: string; // شناسه‌ی پالی‌مارکت رشته است، نه عدد
      question: string;
      category: string;
      yesPct: number;
      volume: number; // دلار — حجم خودِ پالی‌مارکت
      closesAt: string;
    };

/**
 * خطاهایی که یعنی این کارت دیگر وجود ندارد یا دست ما نیست.
 *
 * در یک جا نوشته شده چون هر دو موتور به‌روزرسانی (بازار ایران و ترید) به آن
 * تکیه می‌کنند؛ کپی‌شدنش یعنی روزی یکی‌شان یک حالت را نمی‌شناسد و ردیف مرده
 * برای همیشه در جدول می‌ماند و هر ۱۵ دقیقه دوباره تلاش می‌شود.
 */
export const DEAD_POST_RE =
  /message to edit not found|message can't be edited|chat not found|bot was kicked|bot was blocked|not enough rights/i;

/** حجم دلاری پالی‌مارکت به شکل خوانا: ۱۲.۴M / ۸۵۰K. */
function usdShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

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
  // پیشوند لینک عمیق، مقصدِ تب مینی‌اپ را تعیین می‌کند: `market_` تب بازار
  // ایران، `trade_` تب ترید. parseStartParam در MiniApp همین دو را می‌خواند.
  const slug = m.kind === "trade" ? "trade" : "market";
  const deep = app ? `${app}?startapp=${slug}_${m.id}` : "";
  // callback هم باید بگوید کدام اقتصاد است — شناسه‌ی ۴۲ در بازار ایران و در
  // پالی‌مارکت دو چیز کاملا متفاوت‌اند.
  const cb = m.kind === "trade" ? "t" : "v";

  const freshness =
    mode === "live"
      ? "🔄 درصدها خودکار به‌روز می‌شوند"
      : "💡 درصدهای فوق مربوط به لحظه اشتراک‌گذاری هستند. برای مشاهده آمار لحظه‌ای و ثبت پیش‌بینی، روی دکمه‌های زیر کلیک کنید.";

  // ⚠️ دو متن پایین عمدا جدا نوشته شده‌اند و نباید یکی شوند: بازار ایران
  // استخر تتری دارد و ترید فقط امتیاز. یک متن مشترکِ «پاداش بگیرید» روی
  // کارت ترید یعنی وعده‌ی پولی که وجود ندارد.
  const facts =
    m.kind === "ir"
      ? `👥 تعداد پیش‌بینی‌ها: ${m.bettors} نفر\n` +
        `💎 مجموع استخر: ${m.volume.toFixed(0)} USDT\n`
      : `💵 حجم بازار: ${usdShort(m.volume)}\n`;

  const close =
    m.kind === "ir"
      ? `⚖ نظر شما با اکثریت موافق است یا مخالف؟ پیش‌بینی دقیق خود را ثبت کنید ` +
        `و از استخر تتری (USDT) پاداش بگیرید.`
      : // فرمول صفر-انتظار با عددِ همین بازار نوشته می‌شود، نه به‌شکل کلی:
        // «۲۹ در برابر ۷۱» را کسی که تازه کارت را دیده هم می‌فهمد، در حالی
        // که «۱۰۰ منهای احتمال» توضیح لازم دارد.
        //
        // ⚠️ اعداد از `poly-scoring` می‌آیند نه از حساب دستی. آن فایل صریح
        // می‌گوید فرمول نباید کپی شود، و کارتی که عددش با اپ نخواند روی
        // امتیاز به کاربر دروغ گفته است.
        `⚖ روی «بله» اگر درست دربیایی ${Math.round(winPoints(m.yesPct))} امتیاز ` +
        `می‌گیری و اگر غلط، ${Math.round(-losePoints(m.yesPct))} امتیاز می‌دهی؛ ` +
        `روی «خیر» دقیقا برعکس. گزینه‌ی امن برد کمی دارد — امتیاز وقتی جمع ` +
        `می‌شود که بهتر از بازار دیده باشی.`;

  const head =
    m.kind === "ir"
      ? "📊 <b>بازار پیش‌بینی جدید در نارمون:</b>"
      : "📈 <b>بازار ترید جدید در نارمون:</b>";

  const text =
    `${head}\n\n` +
    `🔹 ${escapeHtml(m.question)}\n\n` +
    `<code>${bar(m.yesPct)}</code>\n` +
    `🟩 بله ${m.yesPct}٪  ·  🟥 خیر ${noPct}٪\n\n` +
    `${facts}` +
    `⏳ مهلت باقی‌مانده: تا ${faDate(m.closesAt)}\n` +
    `${freshness}\n\n` +
    `${close}`;

  if (mode === "live") {
    // callback_data سقف ۶۴ بایت دارد، پس کوتاه نگه داشته می‌شود.
    return {
      text,
      buttons: [
        [
          { text: `✅ بله (${m.yesPct}٪)`, callback_data: `${cb}:y:${m.id}` },
          { text: `❌ خیر (${noPct}٪)`, callback_data: `${cb}:n:${m.id}` },
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
        [
          {
            text: "🆕 ساخت حساب کاربری (ثبت‌نام)",
            url: `${app}?startapp=${m.kind === "trade" ? "tjoin" : "join"}_${m.id}`,
          },
        ],
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

// ═══ صفحه‌های رسانه‌دار ══════════════════════════════════════
//
// هر صفحه‌ی منو یک کارت است: یک تصویر (یا ویدیوی لوپ) با متن زیرش و
// دکمه‌ها. ناوبری همان کارت را عوض می‌کند، نه اینکه کارت تازه بفرستد.
//
// ⚠️ سقف کپشن تلگرام **۱۰۲۴ کاراکتر** است، در حالی که پیام متنی ۴۰۹۶.
// همه‌ی متن‌های منو زیر این سقف نگه داشته شده‌اند؛ اگر روزی یکی بلندتر شد،
// تلگرام کل پیام را رد می‌کند و کارت بی‌سروصدا نمایش داده نمی‌شود.

export type ScreenMedia = { kind: "photo" | "animation"; url: string };

export type Screen = {
  media: ScreenMedia | null;
  text: string;
  buttons: InlineButton[][];
};

/** ارسال یک کارت تازه. */
export async function sendScreen(chatId: number, s: Screen): Promise<boolean> {
  if (!s.media) return sendTelegram(chatId, s.text, s.buttons);

  const method = s.media.kind === "animation" ? "sendAnimation" : "sendPhoto";
  const key = s.media.kind === "animation" ? "animation" : "photo";
  const r = await tgCall(method, {
    chat_id: chatId,
    [key]: s.media.url,
    caption: s.text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: s.buttons },
  });
  if (r.ok) return true;

  // رسانه نرسید (فایل هنوز دیپلوی نشده، یا تلگرام نتوانست بگیردش). پیام
  // بی‌تصویر بهتر از هیچ پیام است — کاربر نباید روی دکمه بزند و سکوت ببیند.
  await noteSendFailure(chatId, r.error);
  return sendTelegram(chatId, s.text, s.buttons);
}

/**
 * جای‌گزینی کارت — تصویر، متن و دکمه‌ها با هم.
 *
 * اگر پیام قبلی رسانه نداشته باشد (کارت‌های قدیمی که پیش از این تغییر
 * فرستاده شده‌اند) `editMessageMedia` شکست می‌خورد؛ آن‌وقت پیام قدیمی حذف و
 * کارت تازه فرستاده می‌شود تا کاربر گیر نکند.
 */
export async function editScreen(
  chatId: number,
  messageId: number,
  s: Screen
): Promise<boolean> {
  if (!s.media) {
    const ok = await editTelegram(chatId, messageId, s.text, s.buttons);
    if (ok) return true;
    await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
    return sendScreen(chatId, s);
  }

  const r = await tgCall("editMessageMedia", {
    chat_id: chatId,
    message_id: messageId,
    media: {
      type: s.media.kind,
      media: s.media.url,
      caption: s.text,
      parse_mode: "HTML",
    },
    reply_markup: { inline_keyboard: s.buttons },
  });
  if (r.ok) return true;
  if (/message is not modified/i.test(r.error)) return true;

  await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
  return sendScreen(chatId, s);
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
