import { NextResponse } from "next/server";
import { db, touchActivity } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import {
  ensureIrTables,
  moveFunds,
  recordRevenue,
  PROPOSE_FEE_USDT,
} from "@/lib/iran";
import { isIrCategory } from "@/lib/ir-categories";

export const dynamic = "force-dynamic";

// هزینه‌ی پیشنهاد بازار (ضد اسپم) از کیف پول تتر کسر می‌شود — بازار ایران
// هیچ MOON ندارد؛ MOON فقط مال بازار خارجی است. اگر ادمین رد کند،
// همین مبلغ کامل برمی‌گردد (روت ادمین).

/** حداکثر بازار در انتظار تأیید برای هر کاربر */
const MAX_PENDING = 3;

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: {
    question?: string;
    category?: string;
    sourceNote?: string;
    closesAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const question = String(body.question ?? "").trim();
  const sourceNote = String(body.sourceNote ?? "").trim();
  const category = String(body.category ?? "other").trim();
  const closesAt = new Date(String(body.closesAt ?? ""));

  if (question.length < 15 || question.length > 200) {
    return NextResponse.json({ ok: false, error: "bad_question" }, { status: 400 });
  }
  // منبع تسویه اجباری است — بدون آن سر نتیجه دعوا می‌شود
  if (sourceNote.length < 10) {
    return NextResponse.json({ ok: false, error: "source_required" }, { status: 400 });
  }
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "bad_date" }, { status: 400 });
  }
  // بدون این چک، هر رشته‌ای در ستون category می‌نشست و فیلتر دسته‌ها
  // بازارهایی را نشان نمی‌داد که دسته‌ی نامعتبر داشتند.
  if (!isIrCategory(category)) {
    return NextResponse.json({ ok: false, error: "bad_category" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pl = await client.query(
      "SELECT usdt_balance FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }

    const pending = await client.query(
      "SELECT count(*)::int AS n FROM ir_markets WHERE creator_id=$1 AND status='pending'",
      [playerId]
    );
    if (pending.rows[0].n >= MAX_PENDING) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "too_many_pending" }, { status: 429 });
    }

    if (Number(pl.rows[0].usdt_balance) < PROPOSE_FEE_USDT) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_funds" },
        { status: 402 }
      );
    }

    const ins = await client.query(
      `INSERT INTO ir_markets (creator_id, question, category, source_note, closes_at, status, fee_usdt)
       VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id`,
      [playerId, question, category, sourceNote, closesAt.toISOString(), PROPOSE_FEE_USDT]
    );
    await moveFunds(
      client,
      playerId,
      -PROPOSE_FEE_USDT,
      "ir_propose_fee",
      `m${ins.rows[0].id}`
    );
    await recordRevenue(client, "ir_propose_fee", PROPOSE_FEE_USDT, {
      marketId: ins.rows[0].id,
      playerId,
    });

    await touchActivity(client, playerId);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, cost: PROPOSE_FEE_USDT });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
