import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensureIrTables } from "@/lib/iran";

export const dynamic = "force-dynamic";

/** هزینه‌ی پیشنهاد بازار — ضد اسپم. از کردیت کسر می‌شود نه از کیف پول. */
const PROPOSE_COST = 100;
/** حداکثر بازار در انتظار تأیید برای هر کاربر */
const MAX_PENDING = 3;

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
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

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pl = await client.query(
      "SELECT credits FROM players WHERE id=$1 FOR UPDATE",
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

    if (Number(pl.rows[0].credits) < PROPOSE_COST) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_credits" },
        { status: 402 }
      );
    }

    await client.query("UPDATE players SET credits = credits - $1 WHERE id=$2", [
      PROPOSE_COST,
      playerId,
    ]);
    await client.query(
      `INSERT INTO ir_markets (creator_id, question, category, source_note, closes_at, status)
       VALUES ($1,$2,$3,$4,$5,'pending')`,
      [playerId, question, category, sourceNote, closesAt.toISOString()]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, cost: PROPOSE_COST });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
