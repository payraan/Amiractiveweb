import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import {
  getCuratedMarkets,
  findMarket,
  ensurePolyTables,
  POLY_FREE_PER_DAY,
  POLY_EXTRA_COST,
} from "@/lib/poly";

export const dynamic = "force-dynamic";

type Body = { marketId?: string; choice?: string };

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

  const marketId = String(body.marketId ?? "").trim();
  const choice = body.choice === "yes" || body.choice === "no" ? body.choice : null;
  if (!marketId || !choice) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const markets = await getCuratedMarkets();
  const market = findMarket(markets, marketId);
  if (!market) {
    return NextResponse.json({ ok: false, error: "market_not_found" }, { status: 404 });
  }

  // قیمت زنده در لحظه‌ی ثبت (بستن حفره‌ی کش کهنه)؛ اگر نشد، کش مبنا می‌ماند.
  let yesLive = market.yesPct / 100;
  try {
    const liveRes = await fetch(
      `https://gamma-api.polymarket.com/markets/${marketId}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (liveRes.ok) {
      const lm = await liveRes.json();
      if (lm?.closed) {
        return NextResponse.json({ ok: false, error: "market_not_found" }, { status: 409 });
      }
      const prices = (JSON.parse(lm.outcomePrices ?? "[]") as string[]).map(Number);
      if (Number.isFinite(prices[0]) && prices[0] > 0 && prices[0] < 1) {
        yesLive = prices[0];
      }
    }
  } catch {
    /* fallback to cached price */
  }
  const prob = choice === "yes" ? yesLive : 1 - yesLive;

  await ensurePolyTables();
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
    const credits: number = pl.rows[0].credits;

    const cnt = await client.query(
      `SELECT count(*)::int AS n FROM poly_predictions
        WHERE player_id=$1
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date
            = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [playerId]
    );
    const usedToday: number = cnt.rows[0].n;
    const cost = usedToday < POLY_FREE_PER_DAY ? 0 : POLY_EXTRA_COST;

    if (cost > 0 && credits < cost) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_credits" },
        { status: 402 }
      );
    }

    if (cost > 0) {
      await client.query("UPDATE players SET credits = credits - $1 WHERE id=$2", [
        cost,
        playerId,
      ]);
    }

    await client.query(
      `INSERT INTO poly_predictions (player_id, market_id, question, choice, prob, charged)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [playerId, marketId, market.question, choice, prob, cost]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, charged: cost });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ ok: false, error: "already_predicted" }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
