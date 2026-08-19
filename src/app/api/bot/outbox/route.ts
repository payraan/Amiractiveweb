import { NextResponse } from "next/server";
import { runOutboxTick } from "@/lib/notify-outbox";

export const dynamic = "force-dynamic";

// تیک صف اعلان شخصی. با همان `SETTLE_KEY` کرون تسویه — یک راز کمتر برای
// نگهداری.
//
// ── چرا خودش را زنجیر می‌کند ──
// اعلان نتیجه باید نزدیکِ لحظه‌ی تسویه برسد، نه ربع ساعت بعد. یک بازار
// پرمخاطب می‌تواند صدها اعلان بسازد؛ با تکیه بر کرون هر ۱۵ دقیقه، آخرین
// نفر ساعت‌ها بعد خبردار می‌شد.
//
// دقیقا الگوی `/api/bot/broadcast`: هر تیک، اگر کار مانده و پیشرفت داشته،
// تیک بعدی را **بدون await** صدا می‌زند و خودش تمام می‌شود.
const TICK_BUDGET_MS = 30_000;

export async function POST(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const r = await runOutboxTick(TICK_BUDGET_MS);

  // ⚠️ شرط «پیشرفت داشته» حیاتی است — بدون آن یک تیکِ بی‌حاصل بلافاصله
  // تیک بعدی را صدا می‌زند و حلقه‌ی تنگ می‌سازد.
  const progressed = r.sent + r.failed + r.skipped > 0;
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  if (r.remaining > 0 && progressed && !r.throttled && base) {
    fetch(`${base}/api/bot/outbox`, {
      method: "POST",
      headers: { "x-settle-key": key },
      cache: "no-store",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, ...r });
}
