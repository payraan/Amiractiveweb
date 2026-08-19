import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { cookies } from "next/headers";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import {
  botReady,
  registerWebhook,
  setBotCommands,
  tgCall,
  webhookConfigError,
  webhookUrl,
} from "@/lib/telegram";

// فهرست دستورها — همان چیزی که کنار فیلد تایپ دیده می‌شود.
//
// با همان دکمه‌ی ثبت وبهوک ثبت می‌شود، نه جدا: دو دکمه یعنی روزی یکی زده
// می‌شود و دیگری نه، و بعد فهرست دستورها با ربات نمی‌خواند.
const COMMANDS = [
  { command: "start", description: "منوی اصلی" },
  { command: "app", description: "باز کردن اپلیکیشن نارمون" },
  { command: "wallet", description: "کیف پول و موجودی" },
  { command: "profile", description: "کارنامه و آمار من" },
  { command: "invite", description: "دعوت دوستان و پورسانت" },
  { command: "support", description: "پشتیبانی" },
  { command: "bonus", description: "هدیه‌ی عضویت کانال" },
  { command: "help", description: "راهنما" },
];

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
    log.error("tg.webhook_register_failed", { url: webhookUrl(), err: r.error });
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  // ⚠️ ثبت وبهوک، لحظه‌ای است که ربات زنده یا مرده می‌شود. بعد از هر تغییر
  // SITE_URL باید دوباره زده شود؛ اگر یادش برود، همه‌ی پیام‌ها به آدرس
  // قدیمی می‌روند و بی‌صدا گم می‌شوند.
  log.warn("tg.webhook_registered", { url: webhookUrl() });
  // شکست ثبت دستورها نباید ثبت موفق وبهوک را «ناموفق» نشان دهد — وبهوک
  // چیزی است که ربات بدون آن اصلا کار نمی‌کند، فهرست دستورها فقط آرایش است.
  const cmds = await setBotCommands(COMMANDS);
  return NextResponse.json({
    ok: true,
    url: webhookUrl(),
    commands: cmds.ok ? COMMANDS.length : { error: cmds.error },
  });
}
