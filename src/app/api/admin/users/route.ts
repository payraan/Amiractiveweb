import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureIrTables } from "@/lib/iran";

export const dynamic = "force-dynamic";

/** فهرست کامل کاربران با آمار فعالیت و مالی */
export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await ensureIrTables();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = searchParams.get("sort") ?? "recent";
  const pool = await db();

  const order =
    sort === "points"
      ? "p.total_points DESC"
      : sort === "credits"
        ? "p.credits DESC"
        : sort === "balance"
          ? "p.usdt_balance DESC"
          : sort === "active"
            ? "p.last_played DESC NULLS LAST"
            : "p.created_at DESC";

  const { rows } = await pool.query(
    `SELECT p.id, p.tg_username, p.tg_handle, p.display_name, p.credits,
            ROUND(p.total_points)::int AS total_points, p.is_demo,
            p.streak, p.last_played, p.created_at, p.tg_user_id,
            COALESCE(p.usdt_balance,0) AS usdt_balance,
            (SELECT count(*) FROM predictions   x WHERE x.player_id=p.id)::int AS pulse_preds,
            (SELECT count(*) FROM poly_predictions x WHERE x.player_id=p.id)::int AS arena_preds,
            (SELECT count(*) FROM combo_tickets x WHERE x.player_id=p.id)::int AS combos,
            (SELECT count(*) FROM player_challenges x WHERE x.player_id=p.id)::int AS challenges,
            (SELECT count(*) FROM ir_bets x WHERE x.player_id=p.id)::int AS ir_bets,
            (SELECT COALESCE(SUM(x.stake),0) FROM ir_bets x WHERE x.player_id=p.id)::float AS ir_volume,
            (SELECT COALESCE(SUM(x.amount),0) FROM credit_topups x WHERE x.player_id=p.id)::int AS topup_credits
       FROM players p
      WHERE ($1 = '' OR lower(p.tg_username) LIKE '%'||$1||'%'
             OR lower(p.tg_handle) LIKE '%'||$1||'%'
             OR lower(p.display_name) LIKE '%'||$1||'%')
      ORDER BY ${order}
      LIMIT 300`,
    [q]
  );

  const totals = await pool.query(
    `SELECT count(*)::int AS players,
            (SELECT count(*) FROM players WHERE is_demo)::int AS demo_players,
            COALESCE(SUM(credits),0)::int AS credits,
            COALESCE(SUM(total_points),0)::int AS points,
            COALESCE(SUM(usdt_balance),0)::float AS balance,
            (SELECT count(*) FROM players WHERE tg_user_id IS NOT NULL)::int AS tg_linked,
            (SELECT count(*) FROM players
              WHERE last_played >= (now() AT TIME ZONE 'Asia/Tehran')::date - 7)::int AS active_7d
       FROM players`
  );

  const growth = await pool.query(
    // ⚠️ `to_char` عمدی است، نه `::date`. درایور pg ستون DATE را به یک
    // شیء Date جاوااسکریپت تبدیل می‌کند و `String(...)` روی آن، فرم خوانای
    // انسانی می‌دهد نه ISO — «Fri Jul 31 2026 …» — که `slice(0,10)` آن
    // می‌شود «Fri Jul 31» و در کامپوننت `Invalid Date` می‌شد.
    // `toISOString()` هم چاره نبود: سرور روی وقت ترکیه است و روز را جابه‌جا
    // می‌کند. رشته‌ی آماده از خود پستگرس، هر دو مشکل را ندارد.
    `SELECT to_char((created_at AT TIME ZONE 'Asia/Tehran')::date, 'YYYY-MM-DD') AS day,
            count(*)::int AS n
       FROM players GROUP BY day ORDER BY day ASC LIMIT 120`
  );

  return NextResponse.json({
    ok: true,
    totals: totals.rows[0],
    growth: growth.rows.map((r) => ({ day: String(r.day), n: Number(r.n) })),
    users: rows.map((r) => ({
      id: r.id,
      // حساب تلگرام‌زاد یوزرنیم ورود ندارد؛ هندل زنده‌اش را نشان می‌دهیم
      tg: r.tg_username ?? r.tg_handle,
      name: r.display_name,
      credits: r.credits,
      points: r.total_points,
      balance: Number(r.usdt_balance),
      streak: r.streak,
      lastPlayed: r.last_played,
      joined: r.created_at,
      tgLinked: !!r.tg_user_id,
      isDemo: !!r.is_demo,
      pulsePreds: r.pulse_preds,
      arenaPreds: r.arena_preds,
      combos: r.combos,
      challenges: r.challenges,
      irBets: r.ir_bets,
      irVolume: Number(r.ir_volume),
      topupCredits: Number(r.topup_credits),
    })),
  });
}
