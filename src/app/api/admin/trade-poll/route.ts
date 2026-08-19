import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { cookies } from "next/headers";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { botReady } from "@/lib/telegram";
import { postTradeMarket } from "@/lib/trade-posts";

export const dynamic = "force-dynamic";

// ارسال کارت یک بازار ترید به کانال یا گروه — قرینه‌ی `/api/admin/ir-poll`.
//
// پشت کوکی ادمین است و نه بازِ عمومی: پیام از دهان ربات پلتفرم بیرون می‌رود،
// پس هرکسی نباید بتواند هر بازاری را هر جایی منتشر کند.

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

  let body: { marketId?: string; chatId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = String(body.marketId ?? "").trim();
  const chatId = String(body.chatId ?? "").trim();
  // live فقط وقتی کار می‌کند که ربات در آن کانال ادمین باشد؛ forward برای
  // جایی است که نیست و کارت قرار است دست‌به‌دست شود.
  const mode = body.mode === "live" ? "live" : "forward";
  if (!marketId || !chatId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const sent = await postTradeMarket(marketId, chatId, mode);
  if (!sent.ok) {
    log.error("admin.trade_poll_failed", { marketId, chatId, mode, err: sent.error });
    const status =
      sent.error === "not_found" ? 404 : sent.error === "bad_market_id" ? 400 : 502;
    return NextResponse.json({ ok: false, error: sent.error }, { status });
  }

  log.info("admin.trade_poll", { marketId, chatId, mode });
  return NextResponse.json({ ok: true });
}
