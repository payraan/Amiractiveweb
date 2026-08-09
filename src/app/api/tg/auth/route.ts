import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findOrCreateTgPlayer } from "@/lib/telegram";
import { attachReferral } from "@/lib/referral";
import {
  verifyTelegramInitData,
  signTgSession,
  TG_SESSION_MAX_AGE_S,
} from "@/lib/tg-auth";

export const dynamic = "force-dynamic";

// ورود مینی‌اپ: initData معتبر = هویت اثبات‌شده.
//
// این هم‌زمان دو کار می‌کند: ثبت‌نام را یک‌کلیکی و بدون رمز می‌کند، و حفره‌ی
// «هرکسی می‌تواند با هندل هر شخص دیگری ثبت‌نام کند» را می‌بندد — چون از این
// مسیر، آیدی عددی تلگرام توسط خود تلگرام امضا شده است.
//
// پاسخ یک توکن کوتاه‌عمر است که کلاینت باید در هدر x-tg-auth بفرستد، نه
// کوکی. دلیلش در بالای src/lib/tg-auth.ts نوشته شده.

export async function POST(req: Request) {
  let body: { initData?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const check = verifyTelegramInitData(String(body.initData ?? ""));
  if (!check.ok) {
    const status = check.error === "not_configured" ? 503 : 401;
    // فقط نام فیلدها، بدون هیچ مقداری — تا اگر امضا نخواند بشود فهمید
    // تلگرام واقعا چه فرستاده، بدون اینکه داده‌ی کاربر جایی نشت کند.
    return NextResponse.json(
      { ok: false, error: check.error, fields: check.fields },
      { status }
    );
  }

  let player;
  try {
    player = await findOrCreateTgPlayer(check.user);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // دعوت فقط برای حساب تازه‌ساخته معنا دارد؛ وگرنه هر کاربر قدیمی می‌توانست
  // با باز کردن یک لینک دعوت، خودش را به دعوت‌کننده‌ی تازه بچسباند.
  if (player.created && check.startParam?.startsWith("ref_")) {
    try {
      await attachReferral(player.id, check.startParam.slice(4));
    } catch {
      /* ثبت‌نام نباید به‌خاطر کد دعوت شکست بخورد */
    }
  }

  const pool = await db();
  const me = await pool.query<{ credits: number; usdt_balance: string }>(
    "SELECT credits, usdt_balance FROM players WHERE id=$1",
    [player.id]
  );

  return NextResponse.json({
    ok: true,
    token: signTgSession(player.id),
    expiresIn: TG_SESSION_MAX_AGE_S,
    created: player.created,
    player: {
      id: player.id,
      displayName: player.displayName,
      credits: me.rows[0]?.credits ?? 0,
      usdtBalance: Number(me.rows[0]?.usdt_balance ?? 0),
    },
    // مقصد deep link تا کلاینت بداند کاربر را کجا ببرد
    startParam: check.startParam,
  });
}
