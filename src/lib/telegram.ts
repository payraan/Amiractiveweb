// اتصال حساب سایت به تلگرام — پل ورود کاربر به کانال پیام‌رسانی مستقیم.
// وقتی آیدی عددی کاربر ذخیره شد، خود سایت می‌تواند بدون واسطه به او پیام بدهد.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";

export const GROUP_BONUS_CREDITS = 20; // هدیه‌ی عضویت در گروه
export const LINK_CODE_TTL_MIN = 15;

export const BOT_USERNAME = process.env.BOT_USERNAME || "Amiractivesupportbot";
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const BOT_API_KEY = process.env.BOT_API_KEY || "";

export function botKeyValid(header: string | null): boolean {
  return Boolean(BOT_API_KEY) && header === BOT_API_KEY;
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

/** کد یک‌بارمصرف برای اتصال می‌سازد و لینک عمیق ربات را برمی‌گرداند. */
export async function createLinkCode(
  playerId: number
): Promise<{ code: string; deepLink: string }> {
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

/** ربات پس از دریافت /start این را صدا می‌زند تا اتصال نهایی شود. */
export async function consumeLinkCode(
  code: string,
  tgUserId: number
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
      `UPDATE players SET tg_user_id=$1, tg_linked_at=now()
        WHERE id=$2 RETURNING display_name`,
      [tgUserId, playerId]
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

/** ارسال پیام مستقیم از سایت به کاربر — بدون نیاز به دخالت ربات. */
export async function sendTelegram(
  tgUserId: number,
  text: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgUserId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    const j = await res.json();
    return Boolean(j?.ok);
  } catch {
    return false;
  }
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
