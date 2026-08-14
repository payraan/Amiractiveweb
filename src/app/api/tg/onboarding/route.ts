import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureTelegramTables } from "@/lib/telegram";
import { TERMS_VERSION } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// ثبت پذیرش قوانین و پایان آموزش اول ورود.
//
// دو کنش جدا در یک روت، چون هر دو یک چیزند: «این کاربر این دروازه را رد
// کرده». جدا کردنشان به دو روت فقط دو مسیر با یک منطق می‌ساخت.
//
// ⚠️ نسخه‌ی پذیرش از **سرور** می‌آید نه از بدنه‌ی درخواست. اگر کلاینت نسخه را
// می‌فرستاد، هرکسی می‌توانست بنویسد «نسخه‌ی ۹۹ را پذیرفتم» و برای همیشه از
// دیدن هر قوانین تازه‌ای فرار کند.

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { what?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // توکن معتبر یعنی ورودی قبلا انجام شده و ستون‌ها ساخته شده‌اند — ولی آن
  // ورود ممکن است روی نمونه‌ی دیگری از سرور یا پیش از دیپلوی بوده باشد.
  // اینجا هم اطمینان می‌گیریم تا این روت به ترتیب فراخوانی وابسته نماند.
  await ensureTelegramTables();
  const pool = await db();

  if (body.what === "terms") {
    await pool.query(
      "UPDATE players SET terms_at = now(), terms_version = $2 WHERE id = $1",
      [playerId, TERMS_VERSION]
    );
    return NextResponse.json({ ok: true });
  }

  if (body.what === "tour") {
    await pool.query("UPDATE players SET tour_at = now() WHERE id = $1", [playerId]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
}
