import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { botReady } from "@/lib/telegram";
import { postMarket } from "@/lib/ir-posts";

export const dynamic = "force-dynamic";

// ارسال نظرسنجی یک بازار به کانال یا گروه.
//
// پشت کوکی ادمین است و نه بازِ عمومی: پیام از دهان ربات پلتفرم بیرون می‌رود،
// پس هرکسی نباید بتواند هر بازاری را هر جایی منتشر کند.
//
// chatId را ادمین می‌دهد (@channelusername یا شناسه‌ی عددی). ربات باید در آن
// کانال ادمین باشد وگرنه تلگرام رد می‌کند و همان خطا برگردانده می‌شود.

export async function POST(req: Request) {
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

  let body: { marketId?: number; chatId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = Number(body.marketId);
  const chatId = String(body.chatId ?? "").trim();
  // live فقط وقتی کار می‌کند که ربات در آن کانال ادمین باشد؛ forward برای
  // جایی است که نیست و کارت قرار است دست‌به‌دست شود.
  const mode = body.mode === "live" ? "live" : "forward";
  if (!Number.isInteger(marketId) || !chatId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const sent = await postMarket(marketId, chatId, mode);
  if (!sent.ok) {
    const status =
      sent.error === "not_found" ? 404 : sent.error === "market_not_open" ? 409 : 502;
    return NextResponse.json({ ok: false, error: sent.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
