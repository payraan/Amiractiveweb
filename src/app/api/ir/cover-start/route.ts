import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables } from "@/lib/iran";
import { setCoverFlow } from "@/lib/bot-flow";

export const dynamic = "force-dynamic";

// ── آماده‌سازی آپلود کاور ─────────────────────────────────────
//
// ⚠️ چرا این روت لازم شد: مسیر قبلی به لینک عمیق `?start=cover_<id>` تکیه
// داشت. تلگرام وقتی چت ربات **از قبل باز باشد** معمولا `/start` را دوباره
// نمی‌فرستد و فقط چت را می‌آورد جلو — یعنی کاربر از مینی‌اپ بیرون می‌افتاد،
// به ربات می‌رسید، و هیچ اتفاقی نمی‌افتاد. روی پروداکشن دقیقا همین شد:
// از چند بازار، فقط آنی که لینکش دستی و از یک چت دیگر باز شده بود کاور
// گرفت.
//
// حالا خودِ مینی‌اپ وضعیت را ست می‌کند و بعد چت را باز می‌کند. اگر لینک هم
// کار کند چیزی خراب نمی‌شود (`setCoverFlow` فقط همان ردیف را بازنویسی
// می‌کند)، ولی دیگر به آن وابسته نیستیم.

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { marketId?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const marketId = Number(body.marketId);
  if (!Number.isInteger(marketId) || marketId <= 0) {
    return NextResponse.json({ ok: false, error: "bad_market" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();

  const r = await pool.query<{ creator_id: number | null; status: string }>(
    "SELECT creator_id, status FROM ir_markets WHERE id=$1",
    [marketId]
  );
  if (!r.rowCount) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  // فقط سازنده — همان شرطی که خودِ ربات هم دارد.
  if (r.rows[0].creator_id !== playerId) {
    return NextResponse.json({ ok: false, error: "not_creator" }, { status: 403 });
  }

  const tg = await pool.query<{ tg_user_id: string | null }>(
    "SELECT tg_user_id FROM players WHERE id=$1",
    [playerId]
  );
  const tgId = Number(tg.rows[0]?.tg_user_id ?? 0);
  // بدون تلگرامِ وصل، عکسی نمی‌رسد که کاور شود.
  if (!tgId) {
    return NextResponse.json(
      { ok: false, error: "telegram_required" },
      { status: 403 }
    );
  }

  await setCoverFlow(tgId, marketId);

  const bot = (process.env.TG_BOT_USERNAME ?? "").replace(/^@/, "");
  return NextResponse.json({
    ok: true,
    // لینک همچنان برگردانده می‌شود تا چت ربات باز شود؛ ولی وضعیت از قبل
    // ست شده و دیگر به `/start` وابسته نیست.
    botUrl: bot ? `https://t.me/${bot}` : null,
  });
}
