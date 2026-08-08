import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureIrTables, COMMISSION, PROPOSE_FEE_USDT } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * دفترکل درآمد پلتفرم — تفکیک‌شده بر اساس نوع، دوره و بازار.
 *
 * ⚠️ تفکیک واقعی از دمو: پول واقعی فقط از وبهوک درگاه وارد می‌شود؛ هر شارژ
 * دستیِ ادمین یعنی حساب تستی. پس همه‌ی اعداد دو نسخه دارند و پیش‌فرض گزارش،
 * «واقعی» است تا آمار تست هرگز با درآمد واقعی قاطی نشود.
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
  const where =
    scope === "demo"
      ? "WHERE r.is_demo"
      : scope === "all"
        ? ""
        : "WHERE NOT r.is_demo";
  const plWhere =
    scope === "demo" ? "WHERE is_demo" : scope === "all" ? "" : "WHERE NOT is_demo";

  const [byKind, totals, recent, topMarkets, liabilities, split, daily] =
    await Promise.all([
      pool.query(
        `SELECT r.kind, COALESCE(SUM(r.amount),0)::float AS total, COUNT(*)::int AS n
           FROM platform_revenue r ${where}
          GROUP BY r.kind ORDER BY total DESC`
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(r.amount),0)::float AS all_time,
           COALESCE(SUM(r.amount) FILTER (WHERE r.created_at >= now() - interval '30 days'),0)::float AS d30,
           COALESCE(SUM(r.amount) FILTER (WHERE r.created_at >= now() - interval '7 days'),0)::float AS d7,
           COALESCE(SUM(r.amount) FILTER (WHERE r.created_at >= date_trunc('day', now())),0)::float AS today
         FROM platform_revenue r ${where}`
      ),
      pool.query(
        `SELECT r.id, r.kind, r.amount::float AS amount, r.note, r.created_at,
                r.market_id, r.is_demo, m.question, p.tg_username AS username
           FROM platform_revenue r
           LEFT JOIN ir_markets m ON m.id = r.market_id
           LEFT JOIN players p ON p.id = r.player_id
           ${where}
          ORDER BY r.created_at DESC LIMIT 100`
      ),
      pool.query(
        `SELECT r.market_id, m.question, COALESCE(SUM(r.amount),0)::float AS total
           FROM platform_revenue r
           LEFT JOIN ir_markets m ON m.id = r.market_id
           ${where ? where + " AND" : "WHERE"} r.market_id IS NOT NULL
          GROUP BY r.market_id, m.question ORDER BY total DESC LIMIT 10`
      ),
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(usdt_balance),0)::float FROM players ${plWhere}) AS user_balances,
           (SELECT COALESCE(SUM(b.stake),0)::float FROM ir_bets b JOIN players p ON p.id=b.player_id
             WHERE b.status='open'${scope === "demo" ? " AND p.is_demo" : scope === "all" ? "" : " AND NOT p.is_demo"}) AS locked_in_markets`
      ),
      // همیشه هر دو طرف را برگردان تا ادمین بداند چقدرش تست است
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE NOT is_demo),0)::float AS real_total,
           COALESCE(SUM(amount) FILTER (WHERE is_demo),0)::float AS demo_total,
           (SELECT COUNT(*)::int FROM players WHERE is_demo) AS demo_players,
           (SELECT COUNT(*)::int FROM players WHERE NOT is_demo) AS real_players
         FROM platform_revenue`
      ),
      // سری زمانی روزانه برای نمودار
      pool.query(
        `SELECT (r.created_at AT TIME ZONE 'Asia/Tehran')::date AS day,
                COALESCE(SUM(r.amount),0)::float AS total
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
