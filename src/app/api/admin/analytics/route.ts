import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureEventsTable } from "@/lib/events";

export const dynamic = "force-dynamic";

// تحلیل رفتار کاربر — همه‌ی اعداد از `app_events`.
//
// ⚠️ همه‌ی برچسب‌های روز با `to_char` از خود پستگرس می‌آیند، نه با `::date`.
// درایور pg ستون DATE را به شیء Date جاوااسکریپت تبدیل می‌کند و `String()`
// روی آن فرم خوانای انسانی می‌دهد نه ISO — همان باگی که نمودار رشد کاربران
// را «Invalid Date» کرده بود. سرور هم روی وقت ترکیه است، پس `toISOString()`
// چاره نبود: روز را جابه‌جا می‌کرد.
//
// ⚠️ همه‌ی پنجره‌ها به وقت تهران‌اند، نه UTC. «ساعت اوج فعالیت» به وقت
// سروری که در استانبول است، هیچ تصمیمی را راهنمایی نمی‌کند.

const TZ = "Asia/Tehran";

export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await ensureEventsTable();

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 30));
  const since = `${days} days`;
  const pool = await db();

  const [funnel, byCat, topMarkets, daily, hourly, surfaces, retention, totals] =
    await Promise.all([
      // ── ۱) قیف: هر پله چند بار، و چند کاربر یکتا ──
      pool.query(
        `SELECT kind, count(*)::int AS n,
                count(DISTINCT player_id)::int AS people
           FROM app_events
          WHERE created_at > now() - $1::interval
          GROUP BY kind`,
        [since]
      ),

      // ── ۲) تقاضای دسته‌ها ← «کدام بازار بیشترین تقاضا را دارد» ──
      pool.query(
        `SELECT game, category,
                count(*) FILTER (WHERE kind='market_open')::int AS opens,
                count(*) FILTER (WHERE kind='predict')::int     AS predicts,
                count(DISTINCT player_id) FILTER (WHERE kind='market_open')::int AS people
           FROM app_events
          WHERE created_at > now() - $1::interval
            AND category IS NOT NULL
            AND kind IN ('market_open','predict')
          GROUP BY game, category
          ORDER BY opens DESC
          LIMIT 40`,
        [since]
      ),

      // ── ۳) پرتقاضاترین بازارها ──
      pool.query(
        `SELECT game, market_id, category,
                count(*) FILTER (WHERE kind='market_open')::int AS opens,
                count(*) FILTER (WHERE kind='predict')::int     AS predicts
           FROM app_events
          WHERE created_at > now() - $1::interval
            AND market_id IS NOT NULL
            AND kind IN ('market_open','predict')
          GROUP BY game, market_id, category
          ORDER BY opens DESC
          LIMIT 20`,
        [since]
      ),

      // ── ۴) سری زمانی روزانه، تفکیک‌شده بر اساس پله ──
      pool.query(
        `SELECT to_char((created_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE kind='list_view')::int   AS views,
                count(*) FILTER (WHERE kind='market_open')::int AS opens,
                count(*) FILTER (WHERE kind='predict')::int     AS predicts,
                count(DISTINCT player_id)::int                  AS people
           FROM app_events
          WHERE created_at > now() - $1::interval
          GROUP BY day ORDER BY day ASC`,
        [since]
      ),

      // ── ۵) ساعت اوج (وقت تهران) ← بگوید بازار را کِی منتشر کنی ──
      pool.query(
        `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE '${TZ}')::int AS hour,
                count(*)::int AS n
           FROM app_events
          WHERE created_at > now() - $1::interval
          GROUP BY hour ORDER BY hour`,
        [since]
      ),

      // ── ۶) سایت در برابر مینی‌اپ ──
      pool.query(
        `SELECT surface,
                count(*) FILTER (WHERE kind='market_open')::int AS opens,
                count(*) FILTER (WHERE kind='predict')::int     AS predicts,
                count(DISTINCT player_id)::int                  AS people
           FROM app_events
          WHERE created_at > now() - $1::interval
          GROUP BY surface`,
        [since]
      ),

      // ── ۷) ماندگاری ──
      // برای هر روزِ اولین فعالیتِ یک کاربر: چند نفرشان روز بعد و هفته‌ی
      // بعد برگشتند. ستون جدا نمی‌خواهد — هر رویدادِ دارای player_id یعنی
      // آن کاربر آن روز فعال بوده.
      pool.query(
        `WITH firsts AS (
           SELECT player_id,
                  min((created_at AT TIME ZONE '${TZ}')::date) AS d0
             FROM app_events WHERE player_id IS NOT NULL
            GROUP BY player_id
         ), acts AS (
           SELECT DISTINCT player_id, (created_at AT TIME ZONE '${TZ}')::date AS d
             FROM app_events WHERE player_id IS NOT NULL
         )
         SELECT to_char(f.d0, 'YYYY-MM-DD') AS day,
                count(DISTINCT f.player_id)::int AS cohort,
                count(DISTINCT a1.player_id)::int AS d1,
                count(DISTINCT a7.player_id)::int AS d7
           FROM firsts f
           LEFT JOIN acts a1 ON a1.player_id=f.player_id AND a1.d = f.d0 + 1
           LEFT JOIN acts a7 ON a7.player_id=f.player_id AND a7.d = f.d0 + 7
          WHERE f.d0 > (now() AT TIME ZONE '${TZ}')::date - $1::interval
          GROUP BY f.d0 ORDER BY f.d0 ASC`,
        [since]
      ),

      // ── ۸) سرجمع ──
      pool.query(
        `SELECT count(*)::int AS events,
                count(DISTINCT player_id)::int AS people,
                to_char(min(created_at) AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS first_day
           FROM app_events`
      ),
    ]);

  const num = (v: unknown) => Number(v ?? 0);

  return NextResponse.json({
    ok: true,
    days,
    totals: {
      events: num(totals.rows[0]?.events),
      people: num(totals.rows[0]?.people),
      firstDay: totals.rows[0]?.first_day ?? null,
    },
    funnel: Object.fromEntries(
      funnel.rows.map((r) => [
        String(r.kind),
        { n: num(r.n), people: num(r.people) },
      ])
    ),
    byCategory: byCat.rows.map((r) => ({
      game: String(r.game ?? "—"),
      category: String(r.category),
      opens: num(r.opens),
      predicts: num(r.predicts),
      people: num(r.people),
    })),
    topMarkets: topMarkets.rows.map((r) => ({
      game: String(r.game ?? "—"),
      marketId: String(r.market_id),
      category: r.category ? String(r.category) : null,
      opens: num(r.opens),
      predicts: num(r.predicts),
    })),
    daily: daily.rows.map((r) => ({
      day: String(r.day),
      views: num(r.views),
      opens: num(r.opens),
      predicts: num(r.predicts),
      people: num(r.people),
    })),
    hourly: hourly.rows.map((r) => ({ hour: num(r.hour), n: num(r.n) })),
    surfaces: surfaces.rows.map((r) => ({
      surface: String(r.surface),
      opens: num(r.opens),
      predicts: num(r.predicts),
      people: num(r.people),
    })),
    retention: retention.rows.map((r) => ({
      day: String(r.day),
      cohort: num(r.cohort),
      d1: num(r.d1),
      d7: num(r.d7),
    })),
  });
}
