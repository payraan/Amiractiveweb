import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { getOrCreateRound, isClosed } from "@/lib/rounds";
import { tf, isAssetOpen, type Asset, type TimeframeId } from "@/lib/game";

export const dynamic = "force-dynamic";

type Body = { asset?: string; timeframe?: string; guess?: number | string };

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const asset = body.asset === "BTC" || body.asset === "XAU" ? (body.asset as Asset) : null;
  const t = body.timeframe ? tf(body.timeframe) : undefined;
  const guess = Number(body.guess);

  if (!asset) return NextResponse.json({ ok: false, error: "bad_asset" }, { status: 400 });
  if (!t) return NextResponse.json({ ok: false, error: "bad_timeframe" }, { status: 400 });
  if (!Number.isFinite(guess) || guess <= 0)
    return NextResponse.json({ ok: false, error: "bad_guess" }, { status: 400 });
  if (!isAssetOpen(asset))
    return NextResponse.json({ ok: false, error: "market_closed" }, { status: 409 });

  const round = await getOrCreateRound(asset, t.id as TimeframeId);
  if (!round) return NextResponse.json({ ok: false, error: "no_round" }, { status: 409 });
  if (isClosed(round))
    return NextResponse.json({ ok: false, error: "round_closed" }, { status: 409 });

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // lock the player row while we compute cost + deduct
    const pl = await client.query(
      "SELECT credits FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }
    const credits: number = pl.rows[0].credits;

    // enforce per-timeframe daily cap (e.g. 1h = once per day)
    if (t.dailyMax != null) {
      const cnt = await client.query(
        `SELECT count(*)::int AS n
           FROM predictions
          WHERE player_id=$1 AND timeframe=$2
            AND (created_at AT TIME ZONE 'Asia/Tehran')::date
              = (now() AT TIME ZONE 'Asia/Tehran')::date`,
        [playerId, t.id]
      );
      if (cnt.rows[0].n >= t.dailyMax) {
        await client.query("ROLLBACK");
        return NextResponse.json({ ok: false, error: "daily_limit" }, { status: 409 });
      }
    }

    // how many free predictions of this timeframe used today (Tehran day)?
    let cost = t.cost;
    if (t.freeFirst > 0) {
      const used = await client.query(
        `SELECT count(*)::int AS n
           FROM predictions
          WHERE player_id=$1 AND timeframe=$2 AND charged=0
            AND (created_at AT TIME ZONE 'Asia/Tehran')::date
              = (now() AT TIME ZONE 'Asia/Tehran')::date`,
        [playerId, t.id]
      );
      if (used.rows[0].n < t.freeFirst) cost = 0;
    }

    if (cost > 0 && credits < cost) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_credits", cost, credits },
        { status: 402 }
      );
    }

    try {
      await client.query(
        `INSERT INTO predictions (round_id, player_id, guess, timeframe, charged)
         VALUES ($1, $2, $3, $4, $5)`,
        [round.id, playerId, guess, t.id, cost]
      );
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      if (
        typeof err === "object" &&
        err &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        return NextResponse.json({ ok: false, error: "already_predicted" }, { status: 409 });
      }
      throw err;
    }

    let remaining = credits;
    if (cost > 0) {
      const upd = await client.query(
        "UPDATE players SET credits = credits - $1 WHERE id=$2 RETURNING credits",
        [cost, playerId]
      );
      remaining = upd.rows[0].credits;
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, roundId: round.id, charged: cost, credits: remaining });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
