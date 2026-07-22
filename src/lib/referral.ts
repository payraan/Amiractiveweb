// سیستم دعوت — کد اختصاصی هر کاربر، پورسانت کردیتی از شارژ دعوت‌شده‌ها.

import { db } from "@/lib/db";

export const REFERRAL_PERCENT = 10; // درصد پورسانت از هر شارژ دعوت‌شده
export const REFERRAL_BONUS = 5; // کردیت هدیه به دعوت‌شده هنگام ثبت‌نام
export const REF_COOKIE = "amir_ref";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون حروف گیج‌کننده

function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

let ready: Promise<void> | null = null;
export async function ensureReferralTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_code TEXT");
      await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by INTEGER");
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS players_referral_code_key
           ON players (referral_code) WHERE referral_code IS NOT NULL`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS referral_earnings (
           id SERIAL PRIMARY KEY,
           referrer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           referred_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           topup_credits INTEGER NOT NULL,
           commission INTEGER NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
    });
  }
  return ready;
}

/** کد دعوت کاربر را برمی‌گرداند و اگر نداشت می‌سازد. */
export async function getOrCreateCode(playerId: number): Promise<string> {
  await ensureReferralTables();
  const pool = await db();

  const cur = await pool.query<{ referral_code: string | null }>(
    "SELECT referral_code FROM players WHERE id=$1",
    [playerId]
  );
  if (!cur.rowCount) return "";
  if (cur.rows[0].referral_code) return cur.rows[0].referral_code;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    try {
      const res = await pool.query(
        `UPDATE players SET referral_code=$1
          WHERE id=$2 AND referral_code IS NULL
          RETURNING referral_code`,
        [code, playerId]
      );
      if (res.rowCount) return code;
      const again = await pool.query<{ referral_code: string | null }>(
        "SELECT referral_code FROM players WHERE id=$1",
        [playerId]
      );
      if (again.rows[0]?.referral_code) return again.rows[0].referral_code;
    } catch {
      // برخورد کد تکراری → تلاش دوباره
    }
  }
  return "";
}

/** هنگام ثبت‌نام، دعوت‌شده را به دعوت‌کننده وصل می‌کند و هدیه می‌دهد. */
export async function attachReferral(
  newPlayerId: number,
  rawCode: string
): Promise<boolean> {
  const code = normalizeCode(rawCode);
  if (!code) return false;

  await ensureReferralTables();
  const pool = await db();

  const ref = await pool.query<{ id: number }>(
    "SELECT id FROM players WHERE referral_code=$1",
    [code]
  );
  if (!ref.rowCount) return false;
  const referrerId = ref.rows[0].id;
  if (referrerId === newPlayerId) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE players SET referred_by=$1, credits = credits + $2
        WHERE id=$3 AND referred_by IS NULL`,
      [referrerId, REFERRAL_BONUS, newPlayerId]
    );
    await client.query("COMMIT");
    return (upd.rowCount ?? 0) > 0;
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return false;
  } finally {
    client.release();
  }
}

/** پس از شارژ کردیت یک کاربر، پورسانت را به دعوت‌کننده‌اش می‌دهد. */
export async function payReferralCommission(
  referredId: number,
  topupCredits: number
): Promise<{ paid: number; referrerId: number | null }> {
  await ensureReferralTables();
  const pool = await db();

  const row = await pool.query<{ referred_by: number | null }>(
    "SELECT referred_by FROM players WHERE id=$1",
    [referredId]
  );
  const referrerId = row.rows[0]?.referred_by ?? null;
  if (!referrerId || topupCredits <= 0) return { paid: 0, referrerId: null };

  const commission = Math.floor((topupCredits * REFERRAL_PERCENT) / 100);
  if (commission <= 0) return { paid: 0, referrerId };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE players SET credits = credits + $1 WHERE id=$2", [
      commission,
      referrerId,
    ]);
    await client.query(
      `INSERT INTO referral_earnings (referrer_id, referred_id, topup_credits, commission)
       VALUES ($1, $2, $3, $4)`,
      [referrerId, referredId, topupCredits, commission]
    );
    await client.query("COMMIT");
    return { paid: commission, referrerId };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { paid: 0, referrerId };
  } finally {
    client.release();
  }
}

export type ReferralStats = {
  code: string;
  invited: number;
  activeInvited: number;
  earned: number;
  recent: { name: string; credits: number; commission: number; at: string }[];
};

export async function getReferralStats(playerId: number): Promise<ReferralStats> {
  const code = await getOrCreateCode(playerId);
  const pool = await db();

  const [inv, earn, recent] = await Promise.all([
    pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM players WHERE referred_by=$1",
      [playerId]
    ),
    pool.query<{ total: number; actives: number }>(
      `SELECT coalesce(sum(commission),0)::int AS total,
              count(DISTINCT referred_id)::int AS actives
         FROM referral_earnings WHERE referrer_id=$1`,
      [playerId]
    ),
    pool.query(
      `SELECT p.display_name, e.topup_credits, e.commission, e.created_at
         FROM referral_earnings e
         JOIN players p ON p.id = e.referred_id
        WHERE e.referrer_id=$1
        ORDER BY e.created_at DESC
        LIMIT 10`,
      [playerId]
    ),
  ]);

  return {
    code,
    invited: Number(inv.rows[0]?.n ?? 0),
    activeInvited: Number(earn.rows[0]?.actives ?? 0),
    earned: Number(earn.rows[0]?.total ?? 0),
    recent: recent.rows.map((r) => ({
      name: String(r.display_name ?? ""),
      credits: Number(r.topup_credits),
      commission: Number(r.commission),
      at: new Date(r.created_at).toISOString(),
    })),
  };
}
