import { db } from "@/lib/db";
import { ensureIrTables } from "@/lib/iran";
import { ensureTelegramTables } from "@/lib/telegram";
import { CAPS, WINDOWS } from "@/lib/leaderboard";

// رتبه‌ی پروفایل **همان تخته‌ی `main` ماهانه‌ی لیدربورد است**.
// از منبع مشترک خوانده می‌شود تا دو عدد با یک نام از هم جدا نشوند.
const RANK_CAP = CAPS.main.monthly;
const RANK_WINDOW = WINDOWS.monthly;

// ═══ داده‌ی پنل کاربری — یک منبع برای سه سطح ═══════════════════
//
// سایت، مینی‌اپ و ربات همگی همین را می‌خوانند. اگر هرکدام کوئری خودش را
// می‌داشت، «درصد برتر» در ربات و در سایت روزی دو عدد متفاوت می‌شد و هیچ
// تستی هم نمی‌گرفتش.
//
// چرا یک تابع و نه چند تا: پنل کاربری با یک بار لود باید کامل باشد؛ پنج
// درخواست موازی روی اتصال ایران یعنی پنج فرصت برای کند شدن یا شکست.
//
// تفکیک مهم: اقتصاد تتری (بازار ایران) و اقتصاد امتیازی (نبض بازار و ترید
// پیش‌بینی) هرگز با هم جمع نمی‌شوند. سود و زیان تتری پول واقعی است؛ امتیاز نیست.

/** `null` یعنی چنین بازیکنی نیست. */
export async function loadProfile(playerId: number) {
  // هر دو لازم‌اند: usdt_balance از ir و tg_user_id از telegram می‌آید.
  await Promise.all([ensureIrTables(), ensureTelegramTables()]);
  const pool = await db();

  const [me, wallet, ledger, irPnl, ir30, irOpen, pulse, poly, rank, streakDays, mkts, chPassed] =
    await Promise.all([
      pool.query(
        `SELECT id, tg_username, display_name,
                ROUND(total_points)::int AS total_points, streak, credits,
                usdt_balance, demo_balance, created_at, tg_user_id, showcase
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
      // همان کارنامه، ولی فقط ۳۰ روز اخیر.
      //
      // ⚠️ مبنا `ir_markets.settled_at` است نه `ir_bets.created_at`: سود و
      // زیان وقتی **محقق** می‌شود که بازار تسویه شود، نه وقتی شرط ثبت
      // می‌شود. شرطی که ماه پیش بسته شده و دیروز تسویه شده، سودِ دیروز
      // است — و کاربری که کارت را باز می‌کند دنبال همین است.
      pool.query(
        `SELECT
           COUNT(*)::int                                  AS settled_bets,
           COUNT(*) FILTER (WHERE b.status='won')::int     AS won,
           COUNT(*) FILTER (WHERE b.status='lost')::int    AS lost,
           COUNT(*) FILTER (WHERE b.status='refunded')::int AS refunded,
           COALESCE(SUM(b.stake),0)::float                 AS staked,
           COALESCE(SUM(COALESCE(b.payout,0)),0)::float    AS returned
         FROM ir_bets b
         JOIN ir_markets m ON m.id = b.market_id
        WHERE b.player_id=$1 AND b.status <> 'open'
          AND m.settled_at IS NOT NULL
          AND m.settled_at >= now() - interval '30 days'`,
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
      // کارنامه‌ی ترید پیش‌بینی (اگر جدولش وجود داشته باشد)
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
      // ── جایگاه رتبه ────────────────────────────────────────
      //
      // ⚠️ **این باید با لیدربورد یکی باشد، وگرنه دو رتبه‌ی متفاوت با یک
      // نام به کاربر نشان داده می‌شود.**
      //
      // نسخه‌ی قبلی از `players.total_points` می‌خواند: جمعِ همه‌ی
      // بازی‌ها، بی‌سقف و همیشگی. دو ایراد داشت:
      //
      //   ۱. با لیدربورد نمی‌خواند. آنجا فقط پیش‌بینی‌های تسویه‌شده‌ی داخل
      //      بازه شمرده می‌شوند، با سقف تعداد، و کمبو جداست.
      //   ۲. **رتبه را خریدنی می‌کرد.** بی‌سقف یعنی هرکس MOON بیشتری بخرد
      //      پیش‌بینی بیشتری ثبت می‌کند و بالاتر می‌رود — دقیقا همان چیزی
      //      که لیدربورد با سقف‌گذاری بست و خط قرمز محصول است.
      //
      // مخرج هم عوض شد: قبلا **همه‌ی** ثبت‌نام‌شده‌ها بودند، حتی کسی که
      // هرگز بازی نکرده. با آن حساب، «۱۳٪ برتر» فقط یعنی «۸۷٪ اصلا بازی
      // نکرده‌اند» — عددی که هیچ چیزی درباره‌ی مهارت نمی‌گوید.
      pool.query(
        `WITH unified AS (
           SELECT pr.player_id, pr.points, r.settle_at AS settled_at
             FROM predictions pr
             JOIN rounds r ON r.id = pr.round_id
            WHERE r.status='settled' AND pr.points IS NOT NULL
              AND r.settle_at >= now() - interval '${RANK_WINDOW}'
           UNION ALL
           SELECT pp.player_id, pp.points, pp.settled_at
             FROM poly_predictions pp
            WHERE pp.status='settled' AND pp.points IS NOT NULL
              AND pp.settled_at >= now() - interval '${RANK_WINDOW}'
         ),
         ranked AS (
           -- ⚠️ ترتیب باید **عیناً** همان لیدربورد باشد
           -- (api/predict/leaderboard/route.ts): نخستین‌ها بر اساس زمان
           -- تسویه شمرده می‌شوند — نه بهترین‌ها و نه بدترین‌ها.
           --
           -- تا امروز اینجا فقط ORDER BY points ASC بود، یعنی ۶۰
           -- پیش‌بینیِ **کم‌امتیازتر** شمرده می‌شد. برای کسی که در
           -- ۳۰ روز بیش از ۶۰ پیش‌بینیِ تسویه‌شده دارد، پروفایل
           -- رتبه‌ای بدتر از لیدربورد نشان می‌داد — دقیقاً همان
           -- «دو رتبه‌ی متفاوت با یک نام» که کامنت بالا از آن پرهیز می‌دهد.
           SELECT player_id, points,
                  ROW_NUMBER() OVER (
                    PARTITION BY player_id ORDER BY settled_at ASC, points ASC
                  ) AS rn
             FROM unified
         ),
         capped AS (
           SELECT player_id, COALESCE(SUM(points),0) AS pts
             FROM ranked WHERE rn <= ${RANK_CAP} GROUP BY player_id
         )
         SELECT
           (SELECT COUNT(*)::int FROM capped)                    AS total_players,
           (SELECT COUNT(*)::int FROM capped
             WHERE pts > COALESCE((SELECT pts FROM capped WHERE player_id=$1), 0)
           )                                                     AS above,
           COALESCE((SELECT ROUND(pts)::int FROM capped WHERE player_id=$1), 0)
                                                                 AS ranked_points,
           -- ⚠️ «آیا خودِ این کاربر رتبه دارد» جدا از «چند نفر رتبه دارند»
           -- است. بدون این، کاربری که هیچ پیش‌بینی تسویه‌شده‌ای ندارد
           -- above=0 می‌گرفت و «۱۰۰٪ برتر» می‌دید — عددی که هم غلط است و
           -- هم دقیقا برعکس واقعیت.
           EXISTS(SELECT 1 FROM capped WHERE player_id=$1)        AS is_ranked`,
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
    return null;
  }
  const p = me.rows[0];
  const w = wallet.rows[0];
  const ir = irPnl.rows[0];
  const pu = pulse.rows[0];
  const po = poly.rows[0];
  const rk = rank.rows[0];

  const irNet = Number(ir.returned) - Number(ir.staked);
  // ⚠️ مخرج فقط کسانی‌اند که در ۳۰ روز گذشته پیش‌بینیِ تسویه‌شده دارند —
  // همان جمعیتی که لیدربورد می‌شمارد. کاربری که هنوز نتیجه‌ای ندارد،
  // درصدش صفر می‌ماند تا عددی ساختگی به او نشان داده نشود.
  const totalPlayers = Number(rk.total_players) || 0;
  const percentile =
    rk.is_ranked && totalPlayers > 0
      ? Math.round(((totalPlayers - Number(rk.above)) / totalPlayers) * 100)
      : 0;

  const pulseTotal = Number(pu.settled);
  const polyTotal = Number(po.settled);
  const accuracy =
    pulseTotal + polyTotal > 0
      ? Math.round(
          ((Number(pu.positive) + Number(po.positive)) / (pulseTotal + polyTotal)) * 1000
        ) / 10
      : null;

  return {
    player: {
      username: p.tg_username,
      displayName: p.display_name,
      credits: p.credits,
      totalPoints: p.total_points,
      streak: p.streak,
      usdtBalance: Number(p.usdt_balance) + Number(p.demo_balance ?? 0),
      withdrawable: Number(p.usdt_balance),
      demoBalance: Number(p.demo_balance ?? 0),
      createdAt: p.created_at,
      telegramLinked: Boolean(p.tg_user_id),
    },
    wallet: {
      balance: Number(p.usdt_balance) + Number(p.demo_balance ?? 0),
      withdrawable: Number(p.usdt_balance),
      demoBalance: Number(p.demo_balance ?? 0),
      deposited: Number(w.deposited),
      withdrawn: Number(w.withdrawn),
      adjusted: Number(w.adjusted),
      lockedInMarkets: Number(irOpen.rows[0].locked),
      openBets: Number(irOpen.rows[0].n),
    },
    // ⚠️ دو بازه کنار هم و نه یکی: «از ابتدا» عدد حقیقی حساب است، ولی برای
    // کسی که تازه شروع کرده و یک ماه بد داشته، تنها عددِ قابلِ دیدن است و
    // دلسردکننده. «۳۰ روز» می‌گوید همین حالا کجاست.
    iran30: (() => {
      const r = ir30.rows[0];
      const net = Number(r.returned) - Number(r.staked);
      const w = Number(r.won);
      const l = Number(r.lost);
      return {
        settledBets: Number(r.settled_bets),
        won: w,
        lost: l,
        refunded: Number(r.refunded),
        staked: Number(r.staked),
        returned: Number(r.returned),
        net: Math.round(net * 1e6) / 1e6,
        winRate: w + l > 0 ? Math.round((w / (w + l)) * 1000) / 10 : null,
      };
    })(),
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
    // ⚠️ `totalPlayers` عمدا بیرون نمی‌رود. تعداد کاربران واقعی پلتفرم
    // عدد تجاری ماست و «رتبه‌ی ۱ از ۱۵» آن را به هر کاربری لو می‌داد.
    // درصد برتر می‌ماند چون خودش تعداد را نمی‌گوید.
    rank: {
      ranked: Boolean(rk.is_ranked),
      above: Number(rk.above),
      percentile,
      // امتیازِ رتبه‌ساز — همان عددی که لیدربورد می‌شمارد، جدا از
      // `totalPoints` که جمع همیشگیِ همه‌ی بازی‌هاست.
      points: Number(rk.ranked_points ?? 0),
    },
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
    };
}
