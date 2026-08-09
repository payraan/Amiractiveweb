import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureIrTables } from "@/lib/iran";
import { verifyTgSession, TG_AUTH_HEADER } from "@/lib/tg-auth";

export const dynamic = "force-dynamic";

/**
 * وضعیت حساب برای مینی‌اپ.
 *
 * هویت از هدر x-tg-auth می‌آید، نه از کوکی — مینی‌اپ داخل iframe شخص‌ثالث
 * اجرا می‌شود و کوکی SameSite=Lax آنجا فرستاده نمی‌شود.
 */
export async function GET(req: Request) {
  const playerId = verifyTgSession(req.headers.get(TG_AUTH_HEADER));
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
    total_points: number;
  }>(
    `SELECT display_name, tg_handle, credits, usdt_balance, total_points
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
      usdtBalance: Number(p.usdt_balance),
      totalPoints: p.total_points,
    },
  });
}
