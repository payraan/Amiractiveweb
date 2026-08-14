import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureIrTables } from "@/lib/iran";
import { currentPlayerId } from "@/lib/current-player";

export const dynamic = "force-dynamic";

/**
 * وضعیت حساب برای مینی‌اپ.
 *
 * هویت از `currentPlayerId` می‌آید مثل هر روت دیگر، نه مستقیم از هدر.
 * پیش‌تر فقط `x-tg-auth` را می‌خواند و همین یک استثنا بود در قاعده‌ی «همه‌ی
 * روت‌ها از یک مسیر هویت می‌گیرند» — و استثنای هویتی، همان چیزی است که دیر
 * یا زود از بقیه جدا می‌شود. `currentPlayerId` هم هدر را اول می‌سنجد، پس
 * رفتار مینی‌اپ دقیقا همان است و سایت هم می‌تواند بخواندش.
 */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();
  const r = await pool.query<{
    display_name: string;
    tg_handle: string | null;
    credits: number;
    usdt_balance: string;
    demo_balance: string;
    total_points: number;
  }>(
    // ⚠️ `ROUND(...)::int` اجباری است. `total_points` از نوع NUMERIC(14,4)
    // است و بدون cast، درایور pg آن را **رشته** برمی‌گرداند ("0.0000")؛
    // اولین محاسبه‌ی کلاینت روی آن به‌جای جمع، الحاق رشته می‌شود. همه‌ی
    // روت‌های دیگر این cast را دارند و این یکی جا مانده بود.
    `SELECT display_name, tg_handle, credits, usdt_balance, demo_balance,
            ROUND(total_points)::int AS total_points
       FROM players WHERE id=$1`,
    [playerId]
  );
  if (!r.rowCount) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  const p = r.rows[0];
  return NextResponse.json({
    ok: true,
    player: {
      id: playerId,
      displayName: p.display_name,
      handle: p.tg_handle,
      credits: p.credits,
      usdtBalance: Number(p.usdt_balance) + Number(p.demo_balance ?? 0),
      withdrawable: Number(p.usdt_balance),
      demoBalance: Number(p.demo_balance ?? 0),
      totalPoints: p.total_points,
    },
  });
}
