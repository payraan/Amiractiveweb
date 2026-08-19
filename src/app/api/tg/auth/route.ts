import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { findOrCreateTgPlayer } from "@/lib/telegram";
import { attachReferral } from "@/lib/referral";
import { TERMS_VERSION } from "@/lib/onboarding";
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
    // ⚠️ `bad_hash` یعنی یا کسی امضا جعل کرده، یا توکن ربات عوض شده و
    // **هیچ‌کس** نمی‌تواند وارد شود. دومی خرابیِ تمام‌عیارِ لانچ است و
    // بدون لاگ فقط به شکل «اپ باز نمی‌شود» دیده می‌شود.
    if (check.error === "bad_hash" || check.error === "not_configured") {
      log.error("tg.auth_rejected", { reason: check.error, fields: check.fields });
    } else {
      log.info("tg.auth_rejected", { reason: check.error });
    }
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
  } catch (err) {
    log.error("tg.auth_failed", {
      tgUserId: check.user.id,
      err: err instanceof Error ? err.message : "error",
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
  log.info("tg.auth", {
    playerId: player.id,
    tgUserId: check.user.id,
    created: player.created,
    // مقصد deep link: نشان می‌دهد کاربر از کدام کارت/کانال آمده — یعنی
    // اندازه‌گیری واقعیِ اینکه کدام بازار ترافیک می‌آورد.
    start: check.startParam ?? undefined,
  });

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
  const me = await pool.query<{
    credits: number;
    usdt_balance: string;
    demo_balance: string;
    terms_version: number | null;
    tour_at: string | null;
  }>(
    "SELECT credits, usdt_balance, demo_balance, terms_version, tour_at FROM players WHERE id=$1",
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
      usdtBalance:
        Number(me.rows[0]?.usdt_balance ?? 0) +
        Number(me.rows[0]?.demo_balance ?? 0),
    },
    // دروازه‌های اولین ورود.
    //
    // `needsTerms` با **مقایسه‌ی نسخه** سنجیده می‌شود نه با «خالی بودن»:
    // وقتی متن قوانین عوض شود و نسخه بالا برود، کسی که نسخه‌ی قبلی را
    // پذیرفته باید دوباره ببیند. با شرطِ «تاریخ دارد یا نه» این هرگز
    // اتفاق نمی‌افتاد.
    needsTerms: (me.rows[0]?.terms_version ?? 0) < TERMS_VERSION,
    needsTour: !me.rows[0]?.tour_at,
    // مقصد deep link تا کلاینت بداند کاربر را کجا ببرد
    startParam: check.startParam,
  });
}
