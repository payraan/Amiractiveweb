import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RANGES, capFor, windowFor, type LbRange } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

// ── رتبه‌بندی ────────────────────────────────────────────────────
//
// دو ایراد نسخه‌ی قبلی که اینجا رفع شده‌اند:
//
// ۱) فقط جدول predictions (نبض بازار) شمرده می‌شد. ترید پیش‌بینی و کمبو به
//    total_points بازیکن اضافه می‌شدند و در پروفایل دیده می‌شدند، ولی در
//    لیدربورد اصلا حساب نمی‌شدند. یعنی کسی که فقط ترید پیش‌بینی بازی می‌کرد هرگز
//    در رتبه‌بندی ظاهر نمی‌شد.
//
// ۲) مجموع امتیاز بدون سقف تعداد شمرده می‌شد. چون MOON پیش‌بینی بیشتر
//    می‌خرد، بازیکنِ ماهری که MOON می‌خرید می‌توانست ده‌ها برابر بازیکن
//    رایگان امتیاز جمع کند — یعنی عملا پول رتبه می‌خرید. این مستقیما با
//    قاعده‌ی «MOON فقط قابلیت می‌خرد نه رتبه» در تضاد بود.
//
// حالا فقط CAPS[game][range] پیش‌بینیِ نخستِ هر بازیکن در بازه شمرده می‌شود، پس
// همه در هر دوره تعداد فرصت برابر دارند و MOON فقط «بازی بیشتر» می‌خرد.
// این پیش‌نیاز پاداش نقدی است: بدون آن، رتبه خریدنی است.

// ⚠️ بازه‌ها و سقف‌ها از `@/lib/leaderboard` می‌آیند، نه از اینجا.
// تا امروز اینجا و در `profile.ts` جدا نوشته شده بودند و هر تغییری در
// یکی، دیگری را بی‌صدا از آن جدا می‌کرد.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // بازه نرمال می‌شود تا پاسخ همان چیزی را echo کند که واقعاً حساب شده.
  // نسخه‌ی قبلی range را خام برمی‌گرداند، پس `range=daily` بعد از حذف آن
  // بازه، داده‌ی ماهانه را با برچسب «روزانه» می‌داد.
  const raw = searchParams.get("range") ?? "monthly";
  const range: LbRange = (RANGES as string[]).includes(raw)
    ? (raw as LbRange)
    : "monthly";
  const win = windowFor(range);
  // دو رتبه‌بندی جدا:
  //   main  = نبض بازار + ترید پیش‌بینی، بدون اهرم، سقف‌دار → پایه‌ی پاداش و اعتبار
  //   combo = فقط کمبو، با اهرم آزاد → حالت پرریسکِ سرگرمی
  // اگر کمبو در رتبه‌بندی اصلی می‌ماند، اهرمِ خریدنی دوباره پول را به رتبه
  // وصل می‌کرد؛ جداکردنش همان چیزی است که هر دو را سالم نگه می‌دارد.
  const game = searchParams.get("game") === "combo" ? "combo" : "main";
  const cap = capFor(game, range);
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

  // ⚠️ نه شمار کل شرکت‌کننده‌ها بیرون می‌رود، نه `percentile`.
  //
  // فرستادن شمار کل از اول ممنوع بود (عدد تجاری ماست). ولی `percentile`
  // در کنار `rank` **همان عدد را برمی‌گرداند**:
  //     total = (rank − ۱) ÷ (۱ − percentile ÷ ۱۰۰)
  // با جمعیت کوچک این جبر جواب دقیق می‌دهد، پس کامنت قبلی («درصد
  // می‌ماند چون خودش تعداد را نمی‌گوید») غلط بود.
  //
  // با حذف `percentile`، کوئریِ شمارش هم حذف شد: هیچ‌کس مصرفش نمی‌کرد و
  // **همان CTE سنگین را بار دوم اجرا می‌کرد**. یعنی این حذف، هزینه‌ی هر
  // درخواست لیدربورد را نصف هم می‌کند.

  return NextResponse.json({
    ok: true,
    range,
    game,
    maxCounted: cap,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      points: r.points,
      plays: r.plays,
    })),
  });
}
