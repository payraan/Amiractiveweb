import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables, impliedPct } from "@/lib/iran";
import { botReady, marketPoll, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// «کارت بازار را برای خودم بفرست» — مسیر انتشار بدون ادمین‌شدن ربات.
//
// ربات کارت را در چت خصوصیِ خودِ کاربر می‌فرستد و کاربر آن را به هر کانال یا
// گروهی که *خودش* ادمین است فوروارد می‌کند. ربات هیچ‌جا ادمین نمی‌شود.
//
// این فقط با دکمه‌های از نوع لینک کار می‌کند: تلگرام کیبورد اینلاینِ لینکی را
// در فوروارد نگه می‌دارد ولی دکمه‌های callback را نگه نمی‌دارد. به همین دلیل
// marketPoll از اول لینک می‌سازد نه callback_data.

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

  let body: { marketId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const marketId = Number(body.marketId);
  if (!Number.isInteger(marketId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  await ensureIrTables();
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

  const r = await pool.query(
    `SELECT id, question, category, status, yes_total, no_total, bettors, closes_at
       FROM ir_markets WHERE id=$1`,
    [marketId]
  );
  if (!r.rowCount) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const m = r.rows[0];
  if (m.status !== "open") {
    return NextResponse.json({ ok: false, error: "market_not_open" }, { status: 409 });
  }

  const yes = Number(m.yes_total);
  const no = Number(m.no_total);
  const { text, buttons } = marketPoll({
    id: m.id,
    question: m.question,
    category: m.category,
    yesPct: impliedPct(yes, no),
    bettors: m.bettors,
    volume: yes + no,
    closesAt: m.closes_at,
  });

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
