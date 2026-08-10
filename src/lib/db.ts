import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const conn = process.env.DATABASE_URL;

/**
 * SSL فقط برای دیتابیس‌های راه‌دور لازم است.
 *
 * قاعده‌ی قبلی «هرچه railway.internal نیست، SSL بگیرد» بود و روی توسعه‌ی
 * لوکال می‌شکست: Postgres لوکال SSL ندارد و کل اتصال با خطای
 * "The server does not support SSL connections" از کار می‌افتاد — یعنی
 * ثبت‌نام، ورود و لیدربورد هیچ‌کدام کار نمی‌کردند.
 */
function needsSsl(url: string | undefined): boolean {
  if (!url) return false;
  if (process.env.PGSSL === "off") return false; // فرار اضطراری
  try {
    const host = new URL(url).hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal"); // شامل railway.internal
    return !isLocal;
  } catch {
    // اگر رشته‌ی اتصال قابل تجزیه نبود، به رفتار قبلی برگرد
    return !url.includes("railway.internal");
  }
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString: conn,
    max: 5,
    ssl: needsSsl(conn) ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

// Base tables + idempotent migrations. Safe to run on every cold start.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  tg_username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_played DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rounds (
  id SERIAL PRIMARY KEY,
  asset TEXT NOT NULL,
  round_date DATE NOT NULL,
  close_at TIMESTAMPTZ NOT NULL,
  settle_at TIMESTAMPTZ NOT NULL,
  settle_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  UNIQUE (asset, round_date)
);
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guess NUMERIC NOT NULL,
  error_pct NUMERIC,
  points INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, player_id)
);

-- migrations (idempotent) --
ALTER TABLE players ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_asset_round_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_round ON rounds(asset, timeframe, close_at);

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS timeframe TEXT NOT NULL DEFAULT '24h';
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS charged INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_predictions_round ON predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_predictions_player ON predictions(player_id);

-- ── هویت: لنگر واقعی tg_user_id است، نه یوزرنیم ──────────────
--
-- تا امروز کلید هویت tg_username بود و NOT NULL UNIQUE. سه مشکل داشت:
--   ۱. یوزرنیم در تلگرام اختیاری است — کاربر بدون یوزرنیم اصلا INSERT نمی‌شد.
--   ۲. کاربر یوزرنیمش را عوض می‌کند و مقدار ذخیره‌شده بیات می‌شود.
--   ۳. چون ثبت‌نام وب هیچ اثبات تلگرامی نمی‌خواست، ممکن است کسی هندل شخص
--      دیگری را گرفته باشد؛ وقتی صاحب واقعی از مینی‌اپ بیاید تصادم می‌شود.
--
-- راه‌حل: سه ستون با سه نقش جدا.
--   tg_user_id  → تنها کلید هویت (ایندکس یکتای شرطی، در telegram.ts)
--   tg_username → فقط کلید ورود با رمز برای حساب‌های قدیمی، می‌تواند خالی باشد
--   tg_handle   → هندل فعلی تلگرام، فقط برچسب، یکتا نیست، هر بار تازه می‌شود
--
-- حساب تلگرام‌زاد رمز ندارد؛ هویتش با initData اثبات می‌شود. پس رمز nullable
-- می‌شود — و مسیر ورود با رمز باید حساب بدون رمز را صریحا رد کند.
ALTER TABLE players ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE players ALTER COLUMN tg_username DROP NOT NULL;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_tg_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS players_tg_username_uniq
  ON players (tg_username) WHERE tg_username IS NOT NULL;

ALTER TABLE players ADD COLUMN IF NOT EXISTS tg_handle TEXT;

-- امتیاز اعشاری می‌شود.
--
-- چرا: امتیاز ترید و کمبو از احتمالِ پیوسته می‌آید ولی در ستون INTEGER
-- می‌نشست، پس برد و باخت جدا گرد می‌شدند. چون احتمال دو طرف مکمل‌اند، در هر
-- بازار همیشه یک طرف بود که گرد کردن به نفعش تمام می‌شد. شبیه‌سازی ۲۰۰ هزار
-- باری نشان داد کسی که همیشه آن طرف را بزند به‌طور میانگین +۰.۴۵ امتیاز در هر
-- پیش‌بینی می‌گیرد — بدون ذره‌ای مهارت. این دقیقا خاصیت صفر-انتظار را نقض
-- می‌کرد.
--
-- با NUMERIC دیگر گرد کردنی در کار نیست و EV برای هر احتمالی دقیقا صفر است.
-- نمایش همچنان گردشده است (روت‌ها ROUND می‌کنند)، پس رابط کاربری عوض نمی‌شود.
ALTER TABLE players ALTER COLUMN total_points TYPE NUMERIC(14,4);
`;

let ready: Promise<void> | null = null;

export function db(): Promise<Pool> {
  if (!ready) {
    ready = pool.query(SCHEMA).then(() => undefined);
  }
  return ready.then(() => pool);
}

/**
 * ثبت فعالیت روزانه‌ی بازیکن: به‌روزرسانی streak و last_played.
 *
 * این ستون‌ها از ابتدا در اسکیمای players بودند و پنل ادمین با
 * last_played آمار «کاربران فعال هفته» را گزارش می‌کرد، ولی هیچ‌جای کد
 * آن‌ها را نمی‌نوشت — پس آن آمار همیشه صفر بود و استریک هرگز ساخته نمی‌شد.
 *
 * قابل فراخوانی داخل ترنزاکشن موجود است (client را پاس بده) یا مستقل.
 * فراخوانی چندباره در یک روز استریک را دستکاری نمی‌کند.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function touchActivity(client: any, playerId: number): Promise<void> {
  await client.query(
    `UPDATE players
        SET streak = CASE
              WHEN last_played = (now() AT TIME ZONE 'Asia/Tehran')::date THEN streak
              WHEN last_played = (now() AT TIME ZONE 'Asia/Tehran')::date - 1 THEN streak + 1
              ELSE 1
            END,
            last_played = (now() AT TIME ZONE 'Asia/Tehran')::date
      WHERE id = $1`,
    [playerId]
  );
}
