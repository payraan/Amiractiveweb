import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables } from "@/lib/iran";
import { ensureTelegramTables } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * همه‌ی داده‌ی پنل کاربری در یک درخواست.
 *
 * چرا یک endpoint و نه چند تا: پنل کاربری با یک بار لود باید کامل باشد؛ پنج
 * درخواست موازی روی اتصال ایران یعنی پنج فرصت برای کند شدن یا شکست.
 *
 * تفکیک مهم: اقتصاد تتری (بازار ایران) و اقتصاد امتیازی (نبض بازار و آرنا)
 * هرگز با هم جمع نمی‌شوند. سود و زیان تتری پول واقعی است؛ امتیاز نیست.
 */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  // هر دو لازم‌اند: usdt_balance از ir و tg_user_id از telegram می‌آید.
  await Promise.all([ensureIrTables(), ensureTelegramTables()]);
  const pool = await db();

  const [me, wallet, ledger, irPnl, irOpen, pulse, poly, rank, streakDays, mkts, chPassed] =
    await Promise.all([
      pool.query(
        `SELECT id, tg_username, display_name,
                ROUND(total_points)::int AS total_points, streak, credits,
                usdt_balance, created_at, tg_user_id, showcase
           FROM players WHERE id=$1`,
        [playerId]
      ),
      // ورودی و خروجی واقعی پول — مبنای «چقدر گذاشتم، چقدر درآوردم»
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE kind='deposit'),0)::float       AS deposited,
           COALESCE(SUM(-amount) FILTER (WHERE kind='withdraw_hold'),0)::float AS withdrawn,
           COALESCE(SUM(amount) FILTER (WHERE kind='admin_adjust'),0)::float  AS adjusted
         FROM wallet_ledger WHERE player_id=$1`,
        [playerId]
      ),
      pool.query(
        `SELECT amount::float AS amount, kind, ref, balance_after::float AS balance_after,
                created_at
           FROM wallet_ledger WHERE player_id=$1
          ORDER BY created_at DESC LIMIT 100`,
        [playerId]
      ),
      // سود و زیان بازار ایران: پرداختی منهای مبلغ شرط، فقط روی شرط‌های بسته‌شده
      pool.query(
        `SELECT
           COUNT(*)::int                                              AS settled_bets,
           COUNT(*) FILTER (WHERE status='won')::int                  AS won,
           COUNT(*) FILTER (WHERE status='lost')::int                 AS lost,
           COUNT(*) FILTER (WHERE status='refunded')::int             AS refunded,
           COALESCE(SUM(stake),0)::float                              AS staked,
           COALESCE(SUM(COALESCE(payout,0)),0)::float                 AS returned
         FROM ir_bets WHERE player_id=$1 AND status <> 'open'`,
        [playerId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(stake),0)::float AS locked, COUNT(*)::int AS n
           FROM ir_bets WHERE player_id=$1 AND status='open'`,
        [playerId]
      ),
      // کارنامه‌ی نبض بازار
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE points IS NOT NULL)::int AS settled,
                COUNT(*) FILTER (WHERE points > 0)::int AS positive,
                COALESCE(SUM(points),0)::int AS points,
                COALESCE(AVG(error_pct) FILTER (WHERE error_pct IS NOT NULL),0)::float AS avg_err
           FROM predictions WHERE player_id=$1`,
        [playerId]
      ),
      // کارنامه‌ی آرنا (اگر جدولش وجود داشته باشد)
      pool
        .query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE points IS NOT NULL)::int AS settled,
                  COUNT(*) FILTER (WHERE points > 0)::int AS positive,
                  COALESCE(SUM(points),0)::int AS points
             FROM poly_predictions WHERE player_id=$1`,
          [playerId]
        )
        .catch(() => ({ rows: [{ total: 0, settled: 0, positive: 0, points: 0 }] })),
      // جایگاه رتبه: چند درصد کاربران امتیاز کمتری دارند
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM players)                                       AS total_players,
           (SELECT COUNT(*)::int FROM players WHERE total_points >
              (SELECT total_points FROM players WHERE id=$1))                        AS above`,
        [playerId]
      ),
      // روزهای فعال متمایز — برای نشان‌ها
      pool.query(
        `SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Tehran')::date)::int AS days
           FROM predictions WHERE player_id=$1`,
        [playerId]
      ),
      // بازارهای منتشرشده‌ی این کاربر (نه پیشنهادهای رد یا در انتظار)
      pool.query(
        `SELECT COUNT(*)::int AS n FROM ir_markets
          WHERE creator_id=$1 AND status <> 'pending' AND void_reason IS DISTINCT FROM 'rejected'`,
        [playerId]
      ),
      pool
        .query(
          `SELECT COUNT(*)::int AS n FROM player_challenges
            WHERE player_id=$1 AND status='passed'`,
          [playerId]
        )
        .catch(() => ({ rows: [{ n: 0 }] })),
    ]);

  if (!me.rowCount) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const p = me.rows[0];
  const w = wallet.rows[0];
  const ir = irPnl.rows[0];
  const pu = pulse.rows[0];
  const po = poly.rows[0];
  const rk = rank.rows[0];

  const irNet = Number(ir.returned) - Number(ir.staked);
  const totalPlayers = Number(rk.total_players) || 1;
  // بالاتر از چند درصد کاربران؟
  const percentile = Math.round(((totalPlayers - Number(rk.above)) / totalPlayers) * 100);

  const pulseTotal = Number(pu.settled);
  const polyTotal = Number(po.settled);
  const accuracy =
    pulseTotal + polyTotal > 0
      ? Math.round(
          ((Number(pu.positive) + Number(po.positive)) / (pulseTotal + polyTotal)) * 1000
        ) / 10
      : null;

  return NextResponse.json({
    ok: true,
    player: {
      username: p.tg_username,
      displayName: p.display_name,
      credits: p.credits,
      totalPoints: p.total_points,
      streak: p.streak,
      usdtBalance: Number(p.usdt_balance),
      createdAt: p.created_at,
      telegramLinked: Boolean(p.tg_user_id),
    },
    wallet: {
      balance: Number(p.usdt_balance),
      deposited: Number(w.deposited),
      withdrawn: Number(w.withdrawn),
      adjusted: Number(w.adjusted),
      lockedInMarkets: Number(irOpen.rows[0].locked),
      openBets: Number(irOpen.rows[0].n),
    },
    iran: {
      settledBets: Number(ir.settled_bets),
      won: Number(ir.won),
      lost: Number(ir.lost),
      refunded: Number(ir.refunded),
      staked: Number(ir.staked),
      returned: Number(ir.returned),
      net: Math.round(irNet * 1e6) / 1e6,
      winRate:
        Number(ir.won) + Number(ir.lost) > 0
          ? Math.round((Number(ir.won) / (Number(ir.won) + Number(ir.lost))) * 1000) / 10
          : null,
    },
    skill: {
      pulse: {
        total: Number(pu.total),
        settled: pulseTotal,
        positive: Number(pu.positive),
        points: Number(pu.points),
        avgError: Math.round(Number(pu.avg_err) * 100) / 100,
      },
      arena: {
        total: Number(po.total),
        settled: polyTotal,
        positive: Number(po.positive),
        points: Number(po.points),
      },
      accuracy,
      activeDays: Number(streakDays.rows[0].days),
    },
    rank: { totalPlayers, above: Number(rk.above), percentile },
    badgeStats: {
      totalPreds: Number(pu.total) + Number(po.total),
      accuracy,
      activeDays: Number(streakDays.rows[0].days),
      streak: p.streak,
      points: p.total_points,
      percentile,
      deposited: Number(w.deposited),
      irWon: Number(ir.won),
      irLost: Number(ir.lost),
      irNet: Math.round(irNet * 1e6) / 1e6,
      irStaked: Number(ir.staked),
      marketsCreated: Number(mkts.rows[0].n),
      challengesPassed: Number(chPassed.rows[0].n),
      telegramLinked: Boolean(p.tg_user_id),
    },
    showcase: String(p.showcase ?? "").split(",").filter(Boolean),
    ledger: ledger.rows.map((r) => ({
      amount: Number(r.amount),
      kind: r.kind,
      ref: r.ref,
      balanceAfter: Number(r.balance_after),
      createdAt: r.created_at,
    })),
  });
}
