import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensureIrTables, moveFunds, MIN_STAKE_USDT } from "@/lib/iran";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { marketId?: number; side?: string; stake?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const marketId = Number(body.marketId);
  const side = body.side === "yes" || body.side === "no" ? body.side : null;
  const stake = Number(body.stake);

  if (!Number.isInteger(marketId) || !side) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!Number.isFinite(stake) || stake < MIN_STAKE_USDT) {
    return NextResponse.json({ ok: false, error: "stake_too_low" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ردیف بازیکن اول قفل می‌شود تا درخواست‌های همزمان سریالی شوند
    const pl = await client.query(
      "SELECT usdt_balance FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }
    if (Number(pl.rows[0].usdt_balance) < stake) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_funds" },
        { status: 402 }
      );
    }

    const m = await client.query(
      "SELECT status, closes_at FROM ir_markets WHERE id=$1 FOR UPDATE",
      [marketId]
    );
    if (!m.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (m.rows[0].status !== "open") {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "market_closed" }, { status: 409 });
    }
    if (new Date(m.rows[0].closes_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "market_closed" }, { status: 409 });
    }

    await moveFunds(client, playerId, -stake, "ir_bet", `m${marketId}`);

    // آیا این کاربر برای اولین بار روی این بازار شرط می‌بندد؟
    const prev = await client.query(
      "SELECT 1 FROM ir_bets WHERE market_id=$1 AND player_id=$2 LIMIT 1",
      [marketId, playerId]
    );

    await client.query(
      `INSERT INTO ir_bets (market_id, player_id, side, stake)
       VALUES ($1,$2,$3,$4)`,
      [marketId, playerId, side, stake]
    );
    await client.query(
      `UPDATE ir_markets
          SET yes_total = yes_total + $1,
              no_total  = no_total  + $2,
              bettors   = bettors   + $3
        WHERE id = $4`,
      [side === "yes" ? stake : 0, side === "no" ? stake : 0, prev.rowCount ? 0 : 1, marketId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "error";
    return NextResponse.json(
      { ok: false, error: msg === "insufficient_funds" ? msg : "server_error" },
      { status: msg === "insufficient_funds" ? 402 : 500 }
    );
  } finally {
    client.release();
  }
}
