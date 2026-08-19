import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { currentPlayerId } from "@/lib/current-player";
import {
  botReady,
  createLinkCode,
  getTgStatus,
  grantGroupBonusForPlayer,
  GROUP_BONUS_CREDITS,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: true, authed: false, status: null });
  }
  const status = await getTgStatus(playerId);
  // botReady به کلاینت می‌گوید کارت اتصال را اصلا نشان ندهد — تا وقتی ربات
  // ست نشده، دکمه‌ای که همیشه شکست می‌خورد بدتر از نبودنش است.
  return NextResponse.json({ ok: true, authed: true, status, botReady: botReady() });
}

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  // ── دریافت هدیه‌ی عضویت، بدون رفتن به ربات ──────────────────
  //
  // ⚠️ تا امروز تنها راهِ گرفتن هدیه، تایپ `/bonus` در ربات بود و **هیچ
  // بررسی خودکاری وجود نداشت**. کاربر عضو گروه می‌شد، به سایت برمی‌گشت،
  // و همان جمله‌ی «هنوز هدیه نگرفته‌اید» را می‌دید — بدون اینکه بفهمد
  // منتظر چیست. عملا یک بن‌بست بود، نه یک تأخیر.
  //
  // حالا همان منطق از سایت و مینی‌اپ هم صدا زده می‌شود. هیچ مسیر پولی
  // موازی ساخته نشده: دقیقا همان تابعی است که ربات صدا می‌زند.
  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* بدنه اختیاری است — نبودنش یعنی درخواستِ لینک اتصال */
  }
  if (body.action === "bonus") {
    const r = await grantGroupBonusForPlayer(playerId);
    return NextResponse.json(
      r.ok
        ? { ok: true, granted: r.granted, credits: r.credits }
        : { ok: false, error: r.reason, bonusCredits: GROUP_BONUS_CREDITS },
      { status: r.ok ? 200 : 409 }
    );
  }

  if (!botReady()) {
    return NextResponse.json(
      { ok: false, error: "bot_not_configured" },
      { status: 503 }
    );
  }
  const { deepLink } = await createLinkCode(playerId);
  // شروع اتصال. با `tg.linked` جفت می‌شود و نشان می‌دهد چند نفر لینک
  // گرفتند ولی هرگز تمامش نکردند — یعنی جایی از قیف اتصال می‌شکند.
  log.info("tg.link_started", { playerId });
  return NextResponse.json({ ok: true, deepLink });
}
