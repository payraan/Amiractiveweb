import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureIrTables, COMMISSION, PROPOSE_FEE_USDT } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * دفترکل درآمد پلتفرم — تفکیک‌شده بر اساس نوع، دوره و بازار.
 *
 * ⚠️ **تفکیک بر اساس مبلغ است، نه بر اساس ردیف.**
 *
 * نسخه‌ی قبلی ردیف‌ها را با بولین `is_demo` فیلتر می‌کرد و آن بولین هم از
 * روی *حسابِ* پرداخت‌کننده می‌آمد. نتیجه‌اش این شد که کمیسیون بازارهای
 * کاملا دمو «درآمد واقعی» شمرده شد — چون کمیسیون تسویه پرداخت‌کننده‌ی
 * مشخصی ندارد و به سازنده‌ی بازار سقوط می‌کرد.
 *
 * در استخر parimutuel پول واقعی و دمو با هم مخلوط می‌شوند، پس یک ردیف
 * کمیسیون می‌تواند هم‌زمان هر دو باشد. «این ردیف واقعی است یا دمو؟» پرسش
 * غلطی است؛ پرسش درست «چقدرش؟» است. هر عدد از ستون متناظرش جمع می‌شود:
 * واقعی = `amount − demo_amount`، دمو = `demo_amount`.
 *
 * نکته‌ی حسابداری: «تتر در گردش» مجموع موجودی کاربران است، نه درآمد ما.
 */
export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();

  // scope=demo | real | all — پیش‌فرض واقعی
  const scope = new URL(req.url).searchParams.get("scope") ?? "real";

  // عبارتِ مبلغ برای این نما. هیچ ردیفی کنار گذاشته نمی‌شود؛ فقط سهمِ
  // مربوط به این نما جمع می‌شود.
  const amt =
    scope === "demo"
      ? "r.demo_amount"
      : scope === "all"
        ? "r.amount"
        : "(r.amount - r.demo_amount)";
  // ردیفی که سهمش در این نما صفر است، در فهرست ریز تراکنش‌ها فقط نویز است.
  const nonZero = `${amt} <> 0`;
  const where = `WHERE ${nonZero}`;

  // موجودی کاربران: پول واقعی در `usdt_balance` است و بونوس در
  // `demo_balance` — همان ستون‌هایی که خودِ سیستم با آن‌ها کار می‌کند.
  const balCol =
    scope === "demo"
      ? "demo_balance"
      : scope === "all"
        ? "(usdt_balance + demo_balance)"
        : "usdt_balance";
  // پول قفل‌شده در بازارهای باز، به همان تفکیک.
  const stakeCol =
    scope === "demo"
      ? "b.demo_stake"
      : scope === "all"
        ? "b.stake"
        : "(b.stake - b.demo_stake)";

  const [byKind, totals, recent, topMarkets, liabilities, split, daily] =
    await Promise.all([
      pool.query(
        `SELECT r.kind, COALESCE(SUM(${amt}),0)::float AS total, COUNT(*)::int AS n
           FROM platform_revenue r ${where}
          GROUP BY r.kind ORDER BY total DESC`
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(${amt}),0)::float AS all_time,
           COALESCE(SUM(${amt}) FILTER (WHERE r.created_at >= now() - interval '30 days'),0)::float AS d30,
           COALESCE(SUM(${amt}) FILTER (WHERE r.created_at >= now() - interval '7 days'),0)::float AS d7,
           COALESCE(SUM(${amt}) FILTER (WHERE r.created_at >= date_trunc('day', now())),0)::float AS today
         FROM platform_revenue r ${where}`
      ),
      pool.query(
        `SELECT r.id, r.kind, ${amt}::float AS amount,
                r.amount::float AS gross, r.demo_amount::float AS demo_amount,
                r.note, r.created_at,
                r.market_id, r.is_demo, m.question, p.tg_username AS username
           FROM platform_revenue r
           LEFT JOIN ir_markets m ON m.id = r.market_id
           LEFT JOIN players p ON p.id = r.player_id
           ${where}
          ORDER BY r.created_at DESC LIMIT 100`
      ),
      pool.query(
        `SELECT r.market_id, m.question, COALESCE(SUM(${amt}),0)::float AS total
           FROM platform_revenue r
           LEFT JOIN ir_markets m ON m.id = r.market_id
           ${where} AND r.market_id IS NOT NULL
          GROUP BY r.market_id, m.question ORDER BY total DESC LIMIT 10`
      ),
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(${balCol}),0)::float FROM players) AS user_balances,
           (SELECT COALESCE(SUM(${stakeCol}),0)::float FROM ir_bets b
             WHERE b.status='open') AS locked_in_markets`
      ),
      // همیشه هر دو طرف را برگردان تا ادمین بداند چقدرش تست است
      pool.query(
        `SELECT
           COALESCE(SUM(amount - demo_amount),0)::float AS real_total,
           COALESCE(SUM(demo_amount),0)::float AS demo_total,
           (SELECT COUNT(*)::int FROM players WHERE demo_balance > 0) AS demo_players,
           (SELECT COUNT(*)::int FROM players WHERE usdt_balance > 0) AS real_players
         FROM platform_revenue`
      ),
      // سری زمانی روزانه برای نمودار
      pool.query(
        `SELECT (r.created_at AT TIME ZONE 'Asia/Tehran')::date AS day,
                COALESCE(SUM(${amt}),0)::float AS total
           FROM platform_revenue r ${where}
          GROUP BY day ORDER BY day ASC LIMIT 90`
      ),
    ]);

  return NextResponse.json({
    ok: true,
    scope,
    totals: totals.rows[0],
    byKind: byKind.rows,
    recent: recent.rows,
    topMarkets: topMarkets.rows,
    liabilities: liabilities.rows[0],
    split: split.rows[0],
    daily: daily.rows.map((r) => ({
      day: String(r.day).slice(0, 10),
      total: Number(r.total),
    })),
    config: { commission: COMMISSION, proposeFee: PROPOSE_FEE_USDT },
  });
}
