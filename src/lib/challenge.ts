// چلنج پراپ پیش‌بینی — ورود با MOON، سنجش با پوینت، جایزه‌ی مهارتی.
// همه‌ی اعداد این فایل قابل تنظیم‌اند.

import { db } from "@/lib/db";

export type ChallengeTrack = "forex" | "predict";

export type ChallengeTier = {
  id: string;
  track: ChallengeTrack;
  label: string; // "$1,000"
  size: number;
  fee: number; // MOON ورود
  target: number; // هدف پوینت
  maxDrawdown: number; // حداکثر افت از سقف (Trailing)
  dailyLoss: number; // سقف ضرر روزانه (پوینت)
  minPreds: number; // حداقل پیش‌بینی تسویه‌شده
  minDays: number; // حداقل روزهای فعال (روزی که حداقل یک تسویه داشته)
  days: number; // مهلت
  prize: string;
  payoutNote?: string; // توضیح نحوه‌ی پرداخت جایزه
  popular?: boolean;
};

// ── قوانین مشترک همه‌ی چلنج‌ها ──────────────────────────────────
//
// قانون ثبات: هیچ روزی نباید بیش از این درصدِ کلِ سود باشد. این قانون
// استراتژی «بلیت بخت‌آزمایی» را می‌بندد — کسی که با دو برد روی گزینه‌های
// خیلی بعید به هدف برسد، آن روز سهم بیش از حد از سودش دارد و قبول
// نمی‌شود. قبولی نیازمند عملکرد مستمر در چند روز است.
export const CONSISTENCY_PCT = 35;

// فقط پیش‌بینی‌هایی که در این بازه‌ی احتمال ثبت شده‌اند در ارزیابی چلنج
// حساب می‌شوند. گزینه‌های خیلی بعید (زیر ۲۵٪) قمار بلیت‌بخت‌آزمایی‌اند:
// باخت‌های کوچک و بردهای نادرِ بزرگ. گزینه‌های خیلی محتمل (بالای ۷۵٪)
// قمار معکوس‌اند: بردهای کوچکِ مکرر که قانون ثبات را دور می‌زنند.
// شبیه‌سازی نشان داد هر دو سر طیف نرخ قبولی را مصنوعی بالا می‌برند.
export const ELIGIBLE_PROB_MIN = 0.25;
export const ELIGIBLE_PROB_MAX = 0.75;

// فقط این تعداد از اولین پیش‌بینی‌های تسویه‌شده در ارزیابی حساب می‌شوند.
// بدون این سقف، بازیکنی که حتی مزیت کوچکی دارد می‌تواند با حجم بالا
// مزیتش را تجمیع کند و عملا همیشه به هدف برسد — یعنی نتیجه به «چقدر
// بازی کردی» گره می‌خورد نه «چقدر خوب پیش‌بینی کردی».
export const MAX_COUNTED_PREDS = 50;

// سقف تعداد ورود به چلنج در ۳۰ روز گذشته (فقط مسیر حساب پیش‌بینی).
// مسیر فارکس محدود نیست چون جایزه‌اش حساب مارکتینگی بروکر است و
// هزینه‌ای برای ما ندارد.
export const MAX_ENTRIES_PER_30D = 3;

export const CHALLENGES: ChallengeTier[] = [
  // ── مسیر الف: حساب معاملاتی واقعی نزد بروکر همکار ───────────
  {
    id: "fx250",
    track: "forex",
    label: "$250",
    size: 250,
    fee: 600,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب معاملاتی ۲۵۰ دلاری",
    payoutNote: "حساب واقعی نزد بروکر همکار — سود قابل برداشت",
  },
  {
    id: "fx500",
    track: "forex",
    label: "$500",
    size: 500,
    fee: 1000,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب معاملاتی ۵۰۰ دلاری",
    payoutNote: "حساب واقعی نزد بروکر همکار — سود قابل برداشت",
    popular: true,
  },
  {
    id: "fx1k",
    track: "forex",
    label: "$1,000",
    size: 1000,
    fee: 1800,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب معاملاتی ۱,۰۰۰ دلاری",
    payoutNote: "حساب واقعی نزد بروکر همکار — سود قابل برداشت",
  },

  // ── مسیر ب: حساب پیش‌بینی با پرداخت کریپتویی سقف‌دار ─────────
  {
    id: "pr5k",
    track: "predict",
    label: "$5,000",
    size: 5000,
    fee: 400,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب پیش‌بینی ۵,۰۰۰ دلاری",
    payoutNote: "پرداخت کریپتویی پس از بررسی، تا سقف ۱۵۰ دلار",
  },
  {
    id: "pr10k",
    track: "predict",
    label: "$10,000",
    size: 10000,
    fee: 700,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب پیش‌بینی ۱۰,۰۰۰ دلاری",
    payoutNote: "پرداخت کریپتویی پس از بررسی، تا سقف ۳۰۰ دلار",
  },
  {
    id: "pr25k",
    track: "predict",
    label: "$25,000",
    size: 25000,
    fee: 1600,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب پیش‌بینی ۲۵,۰۰۰ دلاری",
    payoutNote: "پرداخت کریپتویی پس از بررسی، تا سقف ۷۵۰ دلار",
  },
  {
    id: "pr50k",
    track: "predict",
    label: "$50,000",
    size: 50000,
    fee: 2800,
    target: 300,
    maxDrawdown: 150,
    dailyLoss: 60,
    minPreds: 25,
    minDays: 7,
    days: 30,
    prize: "حساب پیش‌بینی ۵۰,۰۰۰ دلاری",
    payoutNote: "پرداخت کریپتویی پس از بررسی، تا سقف ۱,۵۰۰ دلار",
  },
];

export function tiersByTrack(track: ChallengeTrack): ChallengeTier[] {
  return CHALLENGES.filter((c) => c.track === track);
}

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

    // ردیف بازیکن را همین اول قفل می‌کنیم. هر بررسیِ بعدی (چلنج فعال و
    // سقف ورود) پشت این قفل سریالی می‌شود، پس دو درخواست همزمان نمی‌توانند
    // هر دو شمارش را زیر سقف ببینند و چهارمین ورود را ثبت کنند.
    const pl = await client.query(
      "SELECT credits FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_authed" };
    }

    const active = await client.query(
      `SELECT id FROM player_challenges WHERE player_id=$1 AND status='active'`,
      [playerId]
    );
    if (active.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "active_exists" };
    }

    // سقف ورود مجدد — فقط مسیر حساب پیش‌بینی. سمت سرور اعمال می‌شود،
    // نه فقط در UI، وگرنه با درخواست مستقیم به API دور زده می‌شود.
    if (tier.track === "predict") {
      const predictIds = CHALLENGES.filter((c) => c.track === "predict").map(
        (c) => c.id
      );
      const recent = await client.query(
        `SELECT count(*)::int AS n FROM player_challenges
          WHERE player_id=$1
            AND tier_id = ANY($2::text[])
            AND started_at > now() - interval '30 days'`,
        [playerId, predictIds]
      );
      if ((recent.rows[0]?.n ?? 0) >= MAX_ENTRIES_PER_30D) {
        await client.query("ROLLBACK");
        return { ok: false, error: "entry_limit" };
      }
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
  activeDays: number;
  minDays: number;
  bestDayPct: number;
  consistencyPct: number;
  consistencyOk: boolean;
  track: ChallengeTrack;
  payoutNote: string | null;
  daysLeft: number;
  prize: string;
  /** کارنامه‌ی برد و باخت داخل همین چلنج */
  wins: number;
  losses: number;
  winRate: number | null;
  bestDay: number;
  /** سود/زیان روزانه، قدیم به جدید — برای نمودار و جدول */
  dailyPnl: { day: string; points: number }[];
  peak: number;
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

  // فقط پیش‌بینی‌های داخل بازه‌ی احتمال مجاز در ارزیابی حساب می‌شوند.
  // گزینه‌های خیلی بعید قمارند و گزینه‌های خیلی محتمل مهارتی نشان نمی‌دهند.
  const preds = await pool.query<{ points: number; settled_at: string }>(
    `SELECT points, settled_at FROM poly_predictions
      WHERE player_id=$1 AND status='settled'
        AND created_at >= $2
        AND settled_at IS NOT NULL AND settled_at <= $3
        AND prob >= $4 AND prob <= $5
      ORDER BY settled_at ASC
      LIMIT $6`,
    [playerId, row.started_at, row.deadline, ELIGIBLE_PROB_MIN, ELIGIBLE_PROB_MAX, MAX_COUNTED_PREDS]
  );

  let total = 0;
  let peak = 0;
  let maxDD = 0;
  let wins = 0;
  let losses = 0;
  const daily = new Map<string, number>();
  for (const p of preds.rows) {
    const pts = Number(p.points) || 0;
    if (pts > 0) wins += 1;
    else if (pts < 0) losses += 1;
    total += pts;
    if (total > peak) peak = total;
    if (peak - total > maxDD) maxDD = peak - total;
    const day = new Date(p.settled_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Tehran",
    });
    daily.set(day, (daily.get(day) ?? 0) + pts);
  }
  let worstDay = 0;
  let bestDay = 0;
  for (const v of daily.values()) {
    if (v < worstDay) worstDay = v;
    if (v > bestDay) bestDay = v;
  }
  const activeDays = daily.size;
  // سهم بهترین روز از کل سود — پایه‌ی قانون ثبات
  const bestDayPct = total > 0 ? Math.round((bestDay / total) * 100) : 0;
  const consistencyOk = total <= 0 ? false : bestDayPct <= CONSISTENCY_PCT;

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
    } else if (
      total >= tier.target &&
      preds.rowCount! >= tier.minPreds &&
      activeDays >= tier.minDays &&
      consistencyOk
    ) {
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
    activeDays,
    minDays: tier.minDays,
    bestDayPct,
    consistencyPct: CONSISTENCY_PCT,
    consistencyOk,
    track: tier.track,
    payoutNote: tier.payoutNote ?? null,
    daysLeft,
    prize: tier.prize,
    wins,
    losses,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : null,
    bestDay,
    dailyPnl: [...daily.entries()].map(([day, points]) => ({ day, points })),
    peak,
  };
}
