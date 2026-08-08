import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureIrTables, COMMISSION, PROPOSE_FEE_USDT } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * دفترکل درآمد پلتفرم — تفکیک‌شده بر اساس نوع، دوره و بازار.
 *
 * نکته‌ی حسابداری: «تتر در گردش» مجموع موجودی کاربران است، نه درآمد ما.
 * پول واقعی در کیف پول تجمیعی درگاه می‌ماند؛ این جدول فقط می‌گوید چه سهمی
 * از آن متعلق به پلتفرم است.
 */
export async function GET() {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();

  const [byKind, totals, recent, topMarkets, liabilities] = await Promise.all([
    pool.query(
      `SELECT kind,
              COALESCE(SUM(amount),0)::float AS total,
              COUNT(*)::int AS n
         FROM platform_revenue
        GROUP BY kind
        ORDER BY total DESC`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount),0)::float AS all_time,
         COALESCE(SUM(amount) FILTER (WHERE created_at >= now() - interval '30 days'),0)::float AS d30,
         COALESCE(SUM(amount) FILTER (WHERE created_at >= now() - interval '7 days'),0)::float AS d7,
         COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('day', now())),0)::float AS today
       FROM platform_revenue`
    ),
    pool.query(
      `SELECT r.id, r.kind, r.amount::float AS amount, r.note, r.created_at,
              r.market_id, m.question, p.tg_username AS username
         FROM platform_revenue r
         LEFT JOIN ir_markets m ON m.id = r.market_id
         LEFT JOIN players p ON p.id = r.player_id
        ORDER BY r.created_at DESC
        LIMIT 100`
    ),
    pool.query(
      `SELECT r.market_id, m.question,
              COALESCE(SUM(r.amount),0)::float AS total
         FROM platform_revenue r
         LEFT JOIN ir_markets m ON m.id = r.market_id
        WHERE r.market_id IS NOT NULL
        GROUP BY r.market_id, m.question
        ORDER BY total DESC
        LIMIT 10`
    ),
    // بدهی پلتفرم به کاربران: مجموع موجودی‌ها + پولی که در بازارهای باز قفل است
    pool.query(
      `SELECT
         (SELECT COALESCE(SUM(usdt_balance),0)::float FROM players) AS user_balances,
         (SELECT COALESCE(SUM(stake),0)::float FROM ir_bets WHERE status='open') AS locked_in_markets`
    ),
  ]);

  return NextResponse.json({
    ok: true,
    totals: totals.rows[0],
    byKind: byKind.rows,
    recent: recent.rows,
    topMarkets: topMarkets.rows,
    liabilities: liabilities.rows[0],
    config: { commission: COMMISSION, proposeFee: PROPOSE_FEE_USDT },
  });
}
