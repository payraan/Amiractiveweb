import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { TIMEFRAMES } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ ok: true, player: null });

  const pool = await db();
  const { rows } = await pool.query(
    // امتیاز در دیتابیس اعشاری است؛ برای نمایش گرد و به عدد تبدیل می‌شود
    // (بدون cast، درایور pg مقدار NUMERIC را رشته برمی‌گرداند).
    `SELECT id, display_name, ROUND(total_points)::int AS total_points, streak, credits
       FROM players WHERE id=$1`,
    [playerId]
  );
  if (!rows.length) return NextResponse.json({ ok: true, player: null });

  // predictions in currently-open rounds → which (asset,timeframe) are locked
  const preds = await pool.query(
    `SELECT r.asset, r.timeframe
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1 AND r.close_at > now()`,
    [playerId]
  );

  // free predictions used today per timeframe (Tehran day)
  const freeUsed = await pool.query(
    `SELECT timeframe, count(*)::int AS n
       FROM predictions
      WHERE player_id=$1 AND charged=0
        AND (created_at AT TIME ZONE 'Asia/Tehran')::date
          = (now() AT TIME ZONE 'Asia/Tehran')::date
      GROUP BY timeframe`,
    [playerId]
  );
  const usedMap: Record<string, number> = {};
  for (const r of freeUsed.rows) usedMap[r.timeframe] = r.n;

  const freeRemaining: Record<string, number> = {};
  for (const t of TIMEFRAMES) {
    freeRemaining[t.id] = Math.max(0, t.freeFirst - (usedMap[t.id] ?? 0));
  }

  // recent settled results for this player (last 8)
  const results = await pool.query(
    `SELECT r.asset, p.timeframe, p.guess, r.settle_price, p.error_pct,
            ROUND(p.points)::int AS points, r.settle_at
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1 AND r.status = 'settled'
      ORDER BY r.settle_at DESC
      LIMIT 8`,
    [playerId]
  );

  // ── کارنامه‌ی کامل نبض بازار ───────────────────────────────
  //
  // ⚠️ `results` بالا فقط هشت مورد **تسویه‌شده** می‌دهد و برای نوار نتایج
  // صفحه‌ی اصلی ساخته شده. تا امروز کاربر هیچ راهی نداشت ببیند چه
  // پیش‌بینی‌هایی **باز** دارد — نه در سایت و نه در مینی‌اپ. ترید این را
  // داشت و نبض بازار نداشت، پس کاربر فکر می‌کرد ثبت نشده.
  //
  // باز و تسویه‌شده با هم می‌آیند تا رابط یک فهرست واحد نشان بدهد؛
  // `points === null` یعنی هنوز تسویه نشده.
  const mine = await pool.query(
    `SELECT p.id, r.asset, p.timeframe, p.guess::float AS guess,
            r.settle_price::float AS settle_price, p.error_pct::float AS error_pct,
            CASE WHEN r.status='settled' THEN ROUND(p.points)::int END AS points,
            r.settle_at, r.status AS round_status, p.created_at
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1
      ORDER BY p.created_at DESC
      LIMIT 100`,
    [playerId]
  );

  // ⚠️ مجموع امتیاز **نبض بازار**، جدا از `total_points`.
  //
  // `total_points` جمع هر سه بازی است (نبض بازار + ترید + کمبو). نشان‌دادن
  // آن در صفحه‌ی نبض بازار یعنی کاربر عددی می‌بیند که با فهرست زیرش
  // نمی‌خواند — دقیقا همان سردرگمی‌ای که در تب ترید هم بود.
  const sum = await pool.query<{ pts: string; settled: string; open: string }>(
    `SELECT COALESCE(SUM(p.points) FILTER (WHERE r.status='settled'),0)::float AS pts,
            COUNT(*) FILTER (WHERE r.status='settled')::text  AS settled,
            COUNT(*) FILTER (WHERE r.status<>'settled')::text AS open
       FROM predictions p
       JOIN rounds r ON r.id = p.round_id
      WHERE p.player_id = $1`,
    [playerId]
  );

  return NextResponse.json({
    ok: true,
    player: {
      id: rows[0].id,
      displayName: rows[0].display_name,
      totalPoints: rows[0].total_points,
      streak: rows[0].streak,
      credits: rows[0].credits,
    },
    predicted: preds.rows.map((r) => ({ asset: r.asset, timeframe: r.timeframe })),
    freeRemaining,
    results: results.rows.map((r) => ({
      asset: r.asset,
      timeframe: r.timeframe,
      guess: Number(r.guess),
      settlePrice: r.settle_price == null ? null : Number(r.settle_price),
      errorPct: r.error_pct == null ? null : Number(r.error_pct),
      points: r.points,
    })),
    mine: mine.rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      timeframe: r.timeframe,
      guess: r.guess,
      settlePrice: r.settle_price,
      errorPct: r.error_pct,
      points: r.points,
      settleAt: r.settle_at,
      createdAt: r.created_at,
    })),
    pulse: {
      points: Math.round(Number(sum.rows[0]?.pts ?? 0)),
      settled: Number(sum.rows[0]?.settled ?? 0),
      open: Number(sum.rows[0]?.open ?? 0),
    },
  });
}
