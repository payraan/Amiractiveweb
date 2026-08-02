import { db } from "@/lib/db";

// ═══ بازار ایران — اقتصاد پولی ═══════════════════════════════
//
// برخلاف بازارهای خارجی که امتیازی‌اند، اینجا با پول واقعی (تتر) کار
// می‌شود. دلیل تفکیک: بازارهای خارجی از پالی‌مارکت می‌آیند و تسویه‌شان
// دست ما نیست؛ بازارهای ایرانی را خودمان می‌سازیم و تسویه می‌کنیم.
//
// ── مکانیزم: استخر تجمیعی (Parimutuel) ──
// همه‌ی شرط‌ها در یک استخر جمع می‌شوند، کمیسیون کسر می‌شود، و باقی بین
// برنده‌ها به نسبت سهمشان تقسیم می‌شود. برخلاف دفتر سفارش، به نقدینگی
// اولیه نیاز ندارد و از روز اول کار می‌کند.
//
//   ضریب برد = (کل استخر × (۱ − کمیسیون)) ÷ مجموع شرط‌های طرف برنده
//
// همان منطق صفر-انتظار بقیه‌ی پلتفرم: طرف کم‌طرفدار پاداش بزرگ‌تر.
//
// ── تله‌ای که بسته شده ──
// اگر بازار شدیدا تک‌طرفه شود (مثلا ۹۹٪ روی یک گزینه)، ضریب برد به زیر
// ۱ می‌رسد و برنده با اینکه درست حدس زده، ضرر می‌کند. این حس فریب می‌دهد.
// راه‌حل: اگر ضریب طرف برنده زیر MIN_ODDS بیفتد، بازار باطل و کل پول
// برگردانده می‌شود (کمیسیون هم برنمی‌داریم).

export const COMMISSION = 0.03; // ۳٪ — از حجم، نه از سود
export const MIN_STAKE_USDT = 3; // بر اساس فی شبکه‌ی تتر
export const MIN_ODDS = 1.05; // زیر این، بازار باطل می‌شود
export const MIN_PARTICIPANTS = 10; // تا این تعداد، بازار «در حال شکل‌گیری»
export const DISPUTE_HOURS = 24; // پنجره‌ی اعتراض پس از تسویه

export type IrMarketStatus =
  | "pending" // منتظر تأیید انسانی
  | "open" // باز برای شرط
  | "locked" // بسته، منتظر نتیجه
  | "settling" // نتیجه ثبت شده، در پنجره‌ی اعتراض
  | "settled" // تسویه‌ی نهایی و پرداخت
  | "void"; // باطل — پول برگشت

let ready: Promise<void> | null = null;

export async function ensureIrTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      // کیف پول: موجودی تتر هر کاربر
      await pool.query(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS usdt_balance NUMERIC(18,6) NOT NULL DEFAULT 0"
      );

      // دفترکل تغییرناپذیر — هر تغییر موجودی یک سطر.
      // موجودی همیشه باید با جمع دفترکل بخواند؛ مبنای حسابرسی.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS wallet_ledger (
           id BIGSERIAL PRIMARY KEY,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           amount NUMERIC(18,6) NOT NULL,
           kind TEXT NOT NULL,
           ref TEXT,
           balance_after NUMERIC(18,6) NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS wl_player_idx ON wallet_ledger(player_id, created_at DESC)"
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_markets (
           id SERIAL PRIMARY KEY,
           creator_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
           question TEXT NOT NULL,
           category TEXT NOT NULL DEFAULT 'other',
           source_note TEXT NOT NULL,
           closes_at TIMESTAMPTZ NOT NULL,
           status TEXT NOT NULL DEFAULT 'pending',
           outcome TEXT,
           yes_total NUMERIC(18,6) NOT NULL DEFAULT 0,
           no_total NUMERIC(18,6) NOT NULL DEFAULT 0,
           bettors INTEGER NOT NULL DEFAULT 0,
           settled_at TIMESTAMPTZ,
           void_reason TEXT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS irm_status_idx ON ir_markets(status, closes_at)"
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_bets (
           id BIGSERIAL PRIMARY KEY,
           market_id INTEGER NOT NULL REFERENCES ir_markets(id) ON DELETE CASCADE,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           side TEXT NOT NULL,
           stake NUMERIC(18,6) NOT NULL,
           payout NUMERIC(18,6),
           status TEXT NOT NULL DEFAULT 'open',
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS irb_market_idx ON ir_bets(market_id, player_id)"
      );
    });
  }
  return ready;
}

/** ضریب برد هر ۱ تتر برای یک طرف. صفر یعنی آن طرف شرطی ندارد. */
export function oddsFor(
  yesTotal: number,
  noTotal: number,
  side: "yes" | "no"
): number {
  const winners = side === "yes" ? yesTotal : noTotal;
  if (winners <= 0) return 0;
  return ((yesTotal + noTotal) * (1 - COMMISSION)) / winners;
}

/** احتمال ضمنی بازار — همان چیزی که به کاربر نشان می‌دهیم. */
export function impliedPct(yesTotal: number, noTotal: number): number {
  const t = yesTotal + noTotal;
  if (t <= 0) return 50;
  return Math.round((yesTotal / t) * 1000) / 10;
}

/** آیا این نتیجه ضریب سالمی می‌سازد یا باید باطل شود؟ */
export function wouldBeVoid(
  yesTotal: number,
  noTotal: number,
  outcome: "yes" | "no"
): boolean {
  const o = oddsFor(yesTotal, noTotal, outcome);
  return o > 0 && o < MIN_ODDS;
}

/**
 * تغییر موجودی کیف پول با ثبت در دفترکل.
 * حتما داخل ترنزاکشنی صدا زده شود که ردیف بازیکن را با FOR UPDATE قفل کرده.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function moveFunds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  playerId: number,
  amount: number,
  kind: string,
  ref?: string
): Promise<number> {
  const res = await client.query(
    `UPDATE players SET usdt_balance = usdt_balance + $1
      WHERE id = $2 RETURNING usdt_balance`,
    [amount, playerId]
  );
  const after = Number(res.rows[0].usdt_balance);
  if (after < 0) throw new Error("insufficient_funds");
  await client.query(
    `INSERT INTO wallet_ledger (player_id, amount, kind, ref, balance_after)
     VALUES ($1,$2,$3,$4,$5)`,
    [playerId, amount, kind, ref ?? null, after]
  );
  return after;
}

/**
 * تسویه‌ی یک بازار پس از پایان پنجره‌ی اعتراض.
 *
 * دو مسیر:
 *  ۱. اگر ضریب سالم است → برنده‌ها به نسبت سهم پرداخت می‌گیرند، کمیسیون
 *     برای پلتفرم می‌ماند.
 *  ۲. اگر ضریب زیر حد است یا نتیجه void اعلام شده → کل شرط‌ها بدون کسر
 *     کمیسیون برگردانده می‌شود.
 */
export async function settleIrMarket(
  marketId: number
): Promise<{ ok: boolean; paid?: number; voided?: boolean; error?: string }> {
  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const m = await client.query(
      `SELECT id, status, outcome, yes_total, no_total, settled_at
         FROM ir_markets WHERE id = $1 FOR UPDATE`,
      [marketId]
    );
    if (!m.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }
    const row = m.rows[0];
    if (row.status !== "settling") {
      await client.query("ROLLBACK");
      return { ok: false, error: "bad_status" };
    }

    // پنجره‌ی اعتراض باید تمام شده باشد
    const since = row.settled_at ? Date.now() - new Date(row.settled_at).getTime() : 0;
    if (since < DISPUTE_HOURS * 3600_000) {
      await client.query("ROLLBACK");
      return { ok: false, error: "dispute_window_open" };
    }

    const yes = Number(row.yes_total);
    const no = Number(row.no_total);
    const outcome = row.outcome as "yes" | "no" | "void" | null;

    const bets = await client.query(
      `SELECT id, player_id, side, stake FROM ir_bets
        WHERE market_id = $1 AND status = 'open'`,
      [marketId]
    );

    // مسیر باطل: برگشت کامل بدون کمیسیون
    if (!outcome || outcome === "void" || wouldBeVoid(yes, no, outcome)) {
      for (const b of bets.rows) {
        await moveFunds(client, b.player_id, Number(b.stake), "ir_refund", `m${marketId}`);
        await client.query(
          "UPDATE ir_bets SET status='refunded', payout=$1 WHERE id=$2",
          [Number(b.stake), b.id]
        );
      }
      await client.query(
        "UPDATE ir_markets SET status='void', void_reason=COALESCE(void_reason,'low_odds') WHERE id=$1",
        [marketId]
      );
      await client.query("COMMIT");
      return { ok: true, voided: true };
    }

    // مسیر عادی
    const odds = oddsFor(yes, no, outcome);
    let paid = 0;
    for (const b of bets.rows) {
      const won = b.side === outcome;
      const amt = won ? Number(b.stake) * odds : 0;
      if (won) {
        await moveFunds(client, b.player_id, amt, "ir_payout", `m${marketId}`);
        paid += amt;
      }
      await client.query(
        "UPDATE ir_bets SET status=$1, payout=$2 WHERE id=$3",
        [won ? "won" : "lost", amt, b.id]
      );
    }
    await client.query("UPDATE ir_markets SET status='settled' WHERE id=$1", [
      marketId,
    ]);
    await client.query("COMMIT");
    return { ok: true, paid };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : "error" };
  } finally {
    client.release();
  }
}
