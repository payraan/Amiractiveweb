import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import {
  botReady,
  registerWebhook,
  tgCall,
  webhookConfigError,
  webhookUrl,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

// ثبت و بازبینی وبهوک — پشت کوکی ادمین.
//
// عمدا اینجاست و نه در ترمینال: ثبت وبهوک یعنی صدا زدن setWebhook با توکن
// ربات. اگر مالک بخواهد آن را با curl بزند، توکن در تاریخچه‌ی شل و احتمالا
// در کلیپ‌بورد می‌نشیند. اینجا توکن از متغیر محیطی خوانده می‌شود و هرگز از
// سرور بیرون نمی‌رود.

/** وضعیت فعلی وبهوک نزد تلگرام */
export async function GET() {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!botReady()) {
    return NextResponse.json(
      { ok: false, error: "bot_not_configured" },
      { status: 503 }
    );
  }

  const [me, info] = await Promise.all([
    tgCall<{ username: string; first_name: string }>("getMe"),
    tgCall<{
      url: string;
      pending_update_count: number;
      last_error_message?: string;
      last_error_date?: number;
    }>("getWebhookInfo"),
  ]);

  return NextResponse.json({
    ok: true,
    expectedUrl: webhookUrl(),
    // ایراد پیکربندی را همین‌جا برمی‌گردانیم تا پیش از فشردن دکمه دیده شود.
    configError: webhookConfigError(),
    bot: me.ok ? me.result : { error: me.error },
    webhook: info.ok ? info.result : { error: info.error },
  });
}

/** ثبت وبهوک روی آدرس فعلی SITE_URL */
export async function POST() {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!botReady()) {
    return NextResponse.json(
      { ok: false, error: "bot_not_configured" },
      { status: 503 }
    );
  }

  const r = await registerWebhook();
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: webhookUrl() });
}
