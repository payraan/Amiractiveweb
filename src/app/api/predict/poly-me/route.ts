import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensurePolyTables, POLY_FREE_PER_DAY } from "@/lib/poly";
import { translationsFor } from "@/lib/translate";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ ok: true, predictions: [], freeLeft: 0 });

  await ensurePolyTables();
  const pool = await db();

  const [preds, cnt] = await Promise.all([
    pool.query(
      `SELECT market_id, question, choice, prob,
              ROUND(points)::int AS points, status, created_at
         FROM poly_predictions
        WHERE player_id=$1
        ORDER BY created_at DESC
        LIMIT 20`,
      [playerId]
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM poly_predictions
        WHERE player_id=$1
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date
            = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [playerId]
    ),
  ]);

  // عنوان اینجا از دیتابیس می‌آید (لحظه‌ی ثبت ذخیره شده)، نه از فهرست
  // زنده — پس ترجمه‌اش هم باید جداگانه پیدا شود، وگرنه کارنامه‌ی خود کاربر
  // انگلیسی می‌ماند در حالی که همان بازار در فهرست فارسی است.
  let fa = new Map<string, string>();
  try {
    fa = await translationsFor(preds.rows.map((r) => String(r.question)));
  } catch {
    /* بدون ترجمه ادامه می‌دهیم */
  }

  return NextResponse.json({
    ok: true,
    freeLeft: Math.max(0, POLY_FREE_PER_DAY - cnt.rows[0].n),
    predictions: preds.rows.map((r) => ({
      marketId: r.market_id,
      question: r.question,
      questionFa: fa.get(String(r.question).trim()) ?? null,
      choice: r.choice,
      probPct: Math.round(Number(r.prob) * 100),
      points: r.points,
      status: r.status,
    })),
  });
}
