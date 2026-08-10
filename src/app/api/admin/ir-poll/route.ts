import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureIrTables, impliedPct } from "@/lib/iran";
import { botReady, sendMarketPoll } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// ارسال نظرسنجی یک بازار به کانال یا گروه.
//
// پشت کوکی ادمین است و نه بازِ عمومی: پیام از دهان ربات پلتفرم بیرون می‌رود،
// پس هرکسی نباید بتواند هر بازاری را هر جایی منتشر کند.
//
// chatId را ادمین می‌دهد (‎@channelusername یا شناسه‌ی عددی). ربات باید در آن
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

  let body: { marketId?: number; chatId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = Number(body.marketId);
  const chatId = String(body.chatId ?? "").trim();
  if (!Number.isInteger(marketId) || !chatId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const r = await pool.query(
    `SELECT id, question, category, status, yes_total, no_total, bettors, closes_at
       FROM ir_markets WHERE id=$1`,
    [marketId]
  );
  if (!r.rowCount) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const m = r.rows[0];
  // بازار بسته را نباید به‌عنوان نظرسنجی فرستاد؛ مخاطب روی چیزی کلیک می‌کند
  // که دیگر نمی‌تواند در آن شرکت کند.
  if (m.status !== "open") {
    return NextResponse.json({ ok: false, error: "market_not_open" }, { status: 409 });
  }

  const yes = Number(m.yes_total);
  const no = Number(m.no_total);
  const sent = await sendMarketPoll(chatId, {
    id: m.id,
    question: m.question,
    category: m.category,
    yesPct: impliedPct(yes, no),
    bettors: m.bettors,
    volume: yes + no,
    closesAt: m.closes_at,
  });

  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
