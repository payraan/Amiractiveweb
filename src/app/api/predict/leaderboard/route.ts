import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── رتبه‌بندی ────────────────────────────────────────────────────
//
// دو ایراد نسخه‌ی قبلی که اینجا رفع شده‌اند:
//
// ۱) فقط جدول predictions (نبض بازار) شمرده می‌شد. آرنا و کمبو به
//    total_points بازیکن اضافه می‌شدند و در پروفایل دیده می‌شدند، ولی در
//    لیدربورد اصلا حساب نمی‌شدند. یعنی کسی که فقط آرنا بازی می‌کرد هرگز
//    در رتبه‌بندی ظاهر نمی‌شد.
//
// ۲) مجموع امتیاز بدون سقف تعداد شمرده می‌شد. چون کردیت پیش‌بینی بیشتر
//    می‌خرد، بازیکنِ ماهری که کردیت می‌خرید می‌توانست ده‌ها برابر بازیکن
//    رایگان امتیاز جمع کند — یعنی عملا پول رتبه می‌خرید. این مستقیما با
//    قاعده‌ی «کردیت فقط قابلیت می‌خرد نه رتبه» در تضاد بود.
//
// حالا فقط MAX_COUNTED پیش‌بینیِ نخستِ هر بازیکن در بازه شمرده می‌شود، پس
// همه در هر دوره تعداد فرصت برابر دارند و کردیت فقط «بازی بیشتر» می‌خرد.
// این پیش‌نیاز پاداش نقدی است: بدون آن، رتبه خریدنی است.

const WINDOWS: Record<string, string> = {
  daily: "1 day",
  weekly: "7 days",
  monthly: "30 days",
  all: "",
};

/** سقف پیش‌بینیِ محاسبه‌شده در هر بازه. نخستین‌ها شمرده می‌شوند، نه بهترین‌ها. */
const MAX_COUNTED: Record<string, number> = {
  daily: 10,
  weekly: 25,
  monthly: 60,
  all: 60,
};

/** سقف تیکت کمبو. کمتر است چون کمبو اهرم دارد و هر تیکت وزن بیشتری می‌گیرد. */
const MAX_COMBO: Record<string, number> = {
  daily: 5,
  weekly: 10,
  monthly: 20,
  all: 20,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "monthly";
  const win = WINDOWS[range] ?? WINDOWS.monthly;
  // دو رتبه‌بندی جدا:
  //   main  = نبض بازار + آرنا، بدون اهرم، سقف‌دار → پایه‌ی پاداش و اعتبار
  //   combo = فقط کمبو، با اهرم آزاد → حالت پرریسکِ سرگرمی
  // اگر کمبو در رتبه‌بندی اصلی می‌ماند، اهرمِ خریدنی دوباره پول را به رتبه
  // وصل می‌کرد؛ جداکردنش همان چیزی است که هر دو را سالم نگه می‌دارد.
  const game = searchParams.get("game") === "combo" ? "combo" : "main";
  const cap =
    game === "combo"
      ? MAX_COMBO[range] ?? MAX_COMBO.monthly
      : MAX_COUNTED[range] ?? MAX_COUNTED.monthly;
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 50) || 50)
  );

  const pool = await db();

  // شرط بازه برای هر منبع. برای range=all هیچ فیلتر زمانی اعمال نمی‌شود.
  const cut = (col: string) =>
    range === "all" ? "TRUE" : `${col} >= now() - interval '${win}'`;

  const sources =
    game === "combo"
      ? `SELECT ct.player_id, ct.points, ct.settled_at
           FROM combo_tickets ct
          WHERE ct.status = 'settled'
            AND ct.points IS NOT NULL
            AND ct.settled_at IS NOT NULL
            AND ${cut("ct.settled_at")}`
      : `SELECT p.player_id, p.points, r.settle_at AS settled_at
           FROM predictions p
           JOIN rounds r ON r.id = p.round_id
          WHERE r.status = 'settled'
            AND p.points IS NOT NULL
            AND ${cut("r.settle_at")}

         UNION ALL

         SELECT pp.player_id, pp.points, pp.settled_at
           FROM poly_predictions pp
          WHERE pp.status = 'settled'
            AND pp.points IS NOT NULL
            AND pp.settled_at IS NOT NULL
            AND ${cut("pp.settled_at")}`;

  const { rows } = await pool.query(
    `WITH unified AS (
        ${sources}
     ),
     ranked AS (
        SELECT player_id,
               points,
               ROW_NUMBER() OVER (
                 PARTITION BY player_id ORDER BY settled_at ASC, points ASC
               ) AS rn
          FROM unified
     ),
     capped AS (
        SELECT player_id,
               COALESCE(SUM(points), 0)::int AS points,
               COUNT(*)::int                 AS plays
          FROM ranked
         WHERE rn <= $1
         GROUP BY player_id
     )
     SELECT pl.display_name, c.points, c.plays
       FROM capped c
       JOIN players pl ON pl.id = c.player_id
      ORDER BY c.points DESC, c.plays ASC
      LIMIT $2`,
    [cap, limit]
  );

  // شمار کل شرکت‌کننده‌های واجد شرایط، برای محاسبه‌ی رتبه‌ی درصدی.
  // پاداش بر پایه‌ی همین درصد بنا می‌شود، نه بر پایه‌ی رتبه‌ی خام.
  const totalRes = await pool.query<{ n: string }>(
    `WITH unified AS (
        ${sources}
     )
     SELECT count(DISTINCT player_id) AS n FROM unified`
  );
  const total = Number(totalRes.rows[0]?.n ?? 0);

  return NextResponse.json({
    ok: true,
    range,
    game,
    maxCounted: cap,
    totalPlayers: total,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      points: r.points,
      plays: r.plays,
      // درصد بالاتر یعنی جایگاه بهتر: نفر اول از همه بالاتر است.
      percentile: total > 0 ? Math.round(((total - i) / total) * 100) : 0,
    })),
  });
}
