import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensureIrTables, DISPUTE_HOURS } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * ثبت اعتراض به نتیجه‌ی یک بازار.
 *
 * فقط کسی می‌تواند اعتراض کند که خودش روی همان بازار شرط بسته باشد — وگرنه
 * هر رهگذری می‌توانست تسویه را بی‌دلیل معلق کند. اعتراض فقط داخل پنجره‌ی
 * ۲۴ ساعته پذیرفته می‌شود و هر کاربر روی هر بازار یک بار.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { marketId?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = Number(body.marketId);
  const reason = String(body.reason ?? "").trim();
  if (!Number.isInteger(marketId)) {
    return NextResponse.json({ ok: false, error: "bad_market" }, { status: 400 });
  }
  if (reason.length < 15 || reason.length > 600) {
    return NextResponse.json({ ok: false, error: "bad_reason" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();

  const m = await pool.query(
    "SELECT status, settled_at FROM ir_markets WHERE id=$1",
    [marketId]
  );
  if (!m.rowCount) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const row = m.rows[0];
  if (row.status !== "settling") {
    return NextResponse.json({ ok: false, error: "not_disputable" }, { status: 409 });
  }
  const since = row.settled_at
    ? Date.now() - new Date(row.settled_at).getTime()
    : Number.POSITIVE_INFINITY;
  if (since > DISPUTE_HOURS * 3600_000) {
    return NextResponse.json({ ok: false, error: "window_closed" }, { status: 409 });
  }

  // فقط شرکت‌کننده‌ی همان بازار
  const bet = await pool.query(
    "SELECT 1 FROM ir_bets WHERE market_id=$1 AND player_id=$2 LIMIT 1",
    [marketId, playerId]
  );
  if (!bet.rowCount) {
    return NextResponse.json({ ok: false, error: "not_participant" }, { status: 403 });
  }

  const ins = await pool.query(
    `INSERT INTO ir_disputes (market_id, player_id, reason)
     VALUES ($1,$2,$3)
     ON CONFLICT (market_id, player_id) DO NOTHING
     RETURNING id`,
    [marketId, playerId, reason]
  );
  if (!ins.rowCount) {
    return NextResponse.json({ ok: false, error: "already_disputed" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id: ins.rows[0].id });
}

/** وضعیت اعتراض خودِ کاربر روی یک بازار — برای نمایش دکمه */
export async function GET(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  const marketId = Number(new URL(req.url).searchParams.get("market"));
  if (!Number.isInteger(marketId)) {
    return NextResponse.json({ ok: false, error: "bad_market" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();

  const [m, mine, count] = await Promise.all([
    pool.query("SELECT status, settled_at FROM ir_markets WHERE id=$1", [marketId]),
    playerId
      ? pool.query(
          "SELECT status, reason FROM ir_disputes WHERE market_id=$1 AND player_id=$2",
          [marketId, playerId]
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    pool.query(
      "SELECT count(*)::int AS n FROM ir_disputes WHERE market_id=$1 AND status='open'",
      [marketId]
    ),
  ]);
  if (!m.rowCount) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const row = m.rows[0];
  const since = row.settled_at
    ? Date.now() - new Date(row.settled_at).getTime()
    : Number.POSITIVE_INFINITY;
  const windowOpen =
    row.status === "settling" && since <= DISPUTE_HOURS * 3600_000;

  let canDispute = false;
  if (windowOpen && playerId && !mine.rowCount) {
    const bet = await pool.query(
      "SELECT 1 FROM ir_bets WHERE market_id=$1 AND player_id=$2 LIMIT 1",
      [marketId, playerId]
    );
    canDispute = Boolean(bet.rowCount);
  }

  return NextResponse.json({
    ok: true,
    windowOpen,
    canDispute,
    openCount: count.rows[0].n,
    mine: mine.rows[0] ?? null,
    endsAt: row.settled_at
      ? new Date(
          new Date(row.settled_at).getTime() + DISPUTE_HOURS * 3600_000
        ).toISOString()
      : null,
  });
}
