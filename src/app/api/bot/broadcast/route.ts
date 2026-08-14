import { NextResponse } from "next/server";
import { runBroadcastTick } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// تیک پخش سراسری. با هدر  x-settle-key: <SETTLE_KEY>  صدا زده می‌شود —
// همان کلیدی که کرون تسویه استفاده می‌کند، تا مالک یک راز کمتر نگه دارد.
//
// ── چرا خودش خودش را زنجیر می‌کند ──
// کرون هر ۱۵ دقیقه است. با ۵۰ هزار مخاطب و سقف تلگرام، پخش نیم‌ساعت ارسال
// پیوسته می‌خواهد؛ اگر فقط منتظر کرون بمانیم روزها طول می‌کشد. پس هر تیک
// وقتی کارِ باقی‌مانده دارد، تیک بعدی را **بدون await** صدا می‌زند و خودش
// تمام می‌شود. درخواست‌ها کوتاه می‌مانند و پخش پیوسته پیش می‌رود.
//
// کرون همچنان لازم است: اگر پروسه وسط زنجیره ری‌استارت شود (دیپلوی)،
// زنجیره پاره می‌شود و کرون بعدی دوباره راهش می‌اندازد.
//
// ⚠️ ارسال I/O است نه محاسبه؛ در فاصله‌ی بین پیام‌ها نود آزاد است و
// درخواست‌های سایت عادی جواب می‌گیرند.

const TICK_BUDGET_MS = 45_000;

export async function POST(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const r = await runBroadcastTick(TICK_BUDGET_MS);

  // ⚠️ شرط «پیشرفت داشته» حیاتی است. اگر فقط به `done` نگاه کنیم، یک تیکِ
  // بی‌حاصل — مثلا وقتی همه‌ی ردیف‌های مانده تازه توسط تیک دیگری برداشته
  // شده‌اند — بلافاصله تیک بعدی را صدا می‌زند و آن هم بعدی را: یک حلقه‌ی
  // تنگ که سرور را می‌خورد بدون اینکه حتی یک پیام بفرستد.
  //
  // اگر پیشرفتی نبود، کار متوقف نمی‌ماند: کرون هر ۱۵ دقیقه دوباره تیک
  // می‌زند و ردیف‌های رهاشده تا آن موقع کهنه شده‌اند و برداشته می‌شوند.
  const progressed = r.sent + r.failed > 0;
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  // ۴۲۹ یعنی تندتر از سقف رفته‌ایم؛ زنجیره را قطع می‌کنیم تا کرون بعدی با
  // فاصله شروع کند، وگرنه فقط تندتر به دیوار می‌خوریم.
  if (!r.done && r.jobId && progressed && !r.throttled && base) {
    // بدون await: این درخواست همین‌جا تمام می‌شود.
    fetch(`${base}/api/bot/broadcast`, {
      method: "POST",
      headers: { "x-settle-key": key },
      cache: "no-store",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, ...r });
}
