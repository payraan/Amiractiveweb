// چلنج پراپ پیش‌بینی — ورود با کردیت، سنجش با پوینت، جایزه‌ی مهارتی.
// همه‌ی اعداد این فایل قابل تنظیم‌اند.

import { db } from "@/lib/db";

export type ChallengeTier = {
  id: string;
  label: string; // "$1,000"
  size: number;
  fee: number; // کردیت ورود
  target: number; // هدف پوینت
  maxDrawdown: number; // حداکثر افت از سقف (Trailing)
  dailyLoss: number; // سقف ضرر روزانه (پوینت)
  minPreds: number; // حداقل پیش‌بینی تسویه‌شده
  days: number; // مهلت
  prize: string;
  popular?: boolean;
};

export const CHALLENGES: ChallengeTier[] = [
  {
    id: "c1k",
    label: "$1,000",
    size: 1000,
    fee: 50,
    target: 150,
    maxDrawdown: 75,
    dailyLoss: 40,
    minPreds: 15,
    days: 30,
    prize: "حساب معاملاتی واقعی ۱۰۰ دلاری",
  },
  {
    id: "c5k",
    label: "$5,000",
    size: 5000,
    fee: 150,
    target: 250,
    maxDrawdown: 125,
    dailyLoss: 60,
    minPreds: 15,
    days: 30,
    prize: "حساب معاملاتی واقعی ۲۰۰ دلاری",
  },
  {
    id: "c10k",
    label: "$10,000",
    size: 10000,
    fee: 250,
    target: 350,
    maxDrawdown: 175,
    dailyLoss: 90,
    minPreds: 15,
    days: 30,
    prize: "حساب معاملاتی واقعی ۵۰۰ دلاری",
    popular: true,
  },
  {
    id: "c50k",
    label: "$50,000",
    size: 50000,
    fee: 500,
    target: 500,
    maxDrawdown: 250,
    dailyLoss: 120,
    minPreds: 20,
    days: 30,
    prize: "اشتراک یک‌ماهه‌ی ربات + حساب ۵۰۰ دلاری",
  },
];

export function tierById(id: string): ChallengeTier | null {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

// ── tables ─────────────────────────────────────────────────────
let ready: Promise<void> | null = null;
export async function ensureChallengeTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS player_challenges (
           id SERIAL PRIMARY KEY,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           tier_id TEXT NOT NULL,
           entry_fee INTEGER NOT NULL,
           status TEXT NOT NULL DEFAULT 'active',
           fail_reason TEXT,
           started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           deadline TIMESTAMPTZ NOT NULL
         )`
      );
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS one_active_challenge
           ON player_challenges (player_id) WHERE status = 'active'`
      );
    });
  }
  return ready;
}

// ── start ──────────────────────────────────────────────────────
export async function startChallenge(
  playerId: number,
  tierId: string
): Promise<{ ok: boolean; error?: string }> {
  const tier = tierById(tierId);
  if (!tier) return { ok: false, error: "bad_tier" };

  await ensureChallengeTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const active = await client.query(
      `SELECT id FROM player_challenges WHERE player_id=$1 AND status='active'`,
      [playerId]
    );
    if (active.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "active_exists" };
    }

    const pl = await client.query(
      "SELECT credits FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_authed" };
    }
    if (pl.rows[0].credits < tier.fee) {
      await client.query("ROLLBACK");
      return { ok: false, error: "insufficient_credits" };
    }

    await client.query("UPDATE players SET credits = credits - $1 WHERE id=$2", [
      tier.fee,
      playerId,
    ]);
    await client.query(
      `INSERT INTO player_challenges (player_id, tier_id, entry_fee, deadline)
       VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)`,
      [playerId, tier.id, tier.fee, String(tier.days)]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : "server_error" };
  } finally {
    client.release();
  }
}

// ── evaluation ─────────────────────────────────────────────────
export type ChallengeState = {
  id: number;
  tierId: string;
  label: string;
  status: string;
  failReason: string | null;
  points: number;
  target: number;
  drawdown: number;
  maxDrawdown: number;
  worstDay: number;
  dailyLoss: number;
  settledCount: number;
  minPreds: number;
  daysLeft: number;
  prize: string;
};

export async function getChallengeState(
  playerId: number
): Promise<ChallengeState | null> {
  await ensureChallengeTables();
  const pool = await db();

  const ch = await pool.query(
    `SELECT id, tier_id, status, fail_reason, started_at, deadline
       FROM player_challenges
      WHERE player_id=$1
      ORDER BY started_at DESC
      LIMIT 1`,
    [playerId]
  );
  if (!ch.rowCount) return null;
  const row = ch.rows[0];
  const tier = tierById(row.tier_id);
  if (!tier) return null;

  const preds = await pool.query<{ points: number; settled_at: string }>(
    `SELECT points, settled_at FROM poly_predictions
      WHERE player_id=$1 AND status='settled'
        AND created_at >= $2
        AND settled_at IS NOT NULL AND settled_at <= $3
      ORDER BY settled_at ASC`,
    [playerId, row.started_at, row.deadline]
  );

  let total = 0;
  let peak = 0;
  let maxDD = 0;
  const daily = new Map<string, number>();
  for (const p of preds.rows) {
    const pts = Number(p.points) || 0;
    total += pts;
    if (total > peak) peak = total;
    if (peak - total > maxDD) maxDD = peak - total;
    const day = new Date(p.settled_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Tehran",
    });
    daily.set(day, (daily.get(day) ?? 0) + pts);
  }
  let worstDay = 0;
  for (const v of daily.values()) if (v < worstDay) worstDay = v;

  const now = Date.now();
  const deadlineMs = new Date(row.deadline).getTime();
  const daysLeft = Math.max(0, Math.ceil((deadlineMs - now) / 86_400_000));

  let status: string = row.status;
  let failReason: string | null = row.fail_reason;

  if (status === "active") {
    if (maxDD > tier.maxDrawdown) {
      status = "failed";
      failReason = "drawdown";
    } else if (worstDay < -tier.dailyLoss) {
      status = "failed";
      failReason = "daily_loss";
    } else if (total >= tier.target && preds.rowCount! >= tier.minPreds) {
      status = "passed";
    } else if (now > deadlineMs) {
      status = "failed";
      failReason = "expired";
    }
    if (status !== row.status) {
      await pool.query(
        `UPDATE player_challenges SET status=$1, fail_reason=$2 WHERE id=$3`,
        [status, failReason, row.id]
      );
    }
  }

  return {
    id: row.id,
    tierId: tier.id,
    label: tier.label,
    status,
    failReason,
    points: total,
    target: tier.target,
    drawdown: maxDD,
    maxDrawdown: tier.maxDrawdown,
    worstDay,
    dailyLoss: tier.dailyLoss,
    settledCount: preds.rowCount ?? 0,
    minPreds: tier.minPreds,
    daysLeft,
    prize: tier.prize,
  };
}
