import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { botReady, marketPoll, sendTelegram } from "@/lib/telegram";
import { tradeIdSafe, tradePollInput } from "@/lib/trade-posts";

export const dynamic = "force-dynamic";

// «کارت بازار ترید را برای خودم بفرست» — قرینه‌ی `/api/ir/poll-me`.
//
// ربات کارت را در چت خصوصیِ خودِ کاربر می‌فرستد و کاربر آن را به هر کانال یا
// گروهی که *خودش* ادمین است فوروارد می‌کند. ربات هیچ‌جا ادمین نمی‌شود.
//
// فقط با دکمه‌های لینکی کار می‌کند: تلگرام کیبورد اینلاینِ لینکی را در فوروارد
// نگه می‌دارد ولی دکمه‌های callback را نگه نمی‌دارد.

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  if (!botReady()) {
    return NextResponse.json(
      { ok: false, error: "bot_not_configured" },
      { status: 503 }
    );
  }

  let body: { marketId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const marketId = String(body.marketId ?? "").trim();
  if (!marketId || !tradeIdSafe(marketId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const pool = await db();

  // آیدی تلگرام از روی همین حساب خوانده می‌شود، نه از بدنه‌ی درخواست — وگرنه
  // هرکسی می‌توانست ربات را وادار کند به هر آیدی دلخواهی پیام بدهد.
  const me = await pool.query<{ tg_user_id: string | null }>(
    "SELECT tg_user_id FROM players WHERE id=$1",
    [playerId]
  );
  const tgUserId = me.rows[0]?.tg_user_id;
  if (!tgUserId) {
    return NextResponse.json(
      { ok: false, error: "telegram_required" },
      { status: 403 }
    );
  }

  // فهرست منتخب فقط بازارهای باز را دارد، پس نبودن در آن یعنی بازار برای
  // پیش‌بینی در دسترس نیست و کارتش هم نباید ساخته شود.
  const input = await tradePollInput(marketId);
  if (!input) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { text, buttons } = marketPoll(input);

  // راهنمای فوروارد جدا فرستاده می‌شود، نه چسبیده به خودِ کارت: کارت باید
  // تمیز بماند چون همان چیزی است که در کانال دیده می‌شود.
  const sent = await sendTelegram(Number(tgUserId), text, buttons);
  if (!sent) {
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
  await sendTelegram(
    Number(tgUserId),
    "☝️ این کارت را به هر کانال یا گروهی که ادمینش هستی <b>فوروارد</b> کن.\n\n" +
      "دکمه‌ها بعد از فوروارد هم کار می‌کنند و مخاطبت را مستقیم به همین بازار می‌برند."
  );

  return NextResponse.json({ ok: true });
}
