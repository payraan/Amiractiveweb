import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { getCuratedMarkets, findMarket } from "@/lib/poly";
import {
  ensureComboTables,
  COMBO_FREE_PER_DAY,
  COMBO_COST,
  COMBO_MIN_LEGS,
  COMBO_MAX_LEGS,
} from "@/lib/combos";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0" };

type Leg = { marketId?: string; choice?: string };

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { legs?: Leg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const rawLegs = Array.isArray(body.legs) ? body.legs : [];
  const seen = new Set<string>();
  const legs: { marketId: string; choice: "yes" | "no" }[] = [];
  for (const l of rawLegs) {
    const id = String(l.marketId ?? "").trim();
    const choice = l.choice === "yes" || l.choice === "no" ? l.choice : null;
    if (!id || !choice || seen.has(id)) continue;
    seen.add(id);
    legs.push({ marketId: id, choice });
  }
  if (legs.length < COMBO_MIN_LEGS || legs.length > COMBO_MAX_LEGS) {
    return NextResponse.json({ ok: false, error: "bad_legs" }, { status: 400 });
  }

  const markets = await getCuratedMarkets();

  // قیمت زنده برای هر پا (ضد کش کهنه)؛ در صورت خطا، کش مبنا
  const resolved: { marketId: string; choice: string; question: string; prob: number }[] =
    [];
  await Promise.all(
    legs.map(async (leg) => {
      const cached = findMarket(markets, leg.marketId);
      let yes = cached ? cached.yesPct / 100 : NaN;
      let question = cached?.question ?? "";
      try {
        const res = await fetch(
          `https://gamma-api.polymarket.com/markets/${leg.marketId}`,
          { headers: UA, cache: "no-store" }
        );
        if (res.ok) {
          const m = await res.json();
          if (m?.closed) {
            yes = NaN;
          } else {
            const prices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(
              Number
            );
            if (Number.isFinite(prices[0]) && prices[0] > 0 && prices[0] < 1) {
              yes = prices[0];
            }
            if (!question) question = String(m.question ?? "");
          }
        }
      } catch {
        /* fallback cached */
      }
      if (Number.isFinite(yes) && question) {
        resolved.push({
          marketId: leg.marketId,
          choice: leg.choice,
          question,
          prob: leg.choice === "yes" ? yes : 1 - yes,
        });
      }
    })
  );

  if (resolved.length !== legs.length) {
    return NextResponse.json({ ok: false, error: "market_not_found" }, { status: 409 });
  }

  const prob = resolved.reduce((acc, l) => acc * l.prob, 1);

  await ensureComboTables();
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

    const cnt = await client.query(
      `SELECT count(*)::int AS n FROM combo_tickets
        WHERE player_id=$1
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date
            = (now() AT TIME ZONE 'Asia/Tehran')::date`,
      [playerId]
    );
    const cost = cnt.rows[0].n < COMBO_FREE_PER_DAY ? 0 : COMBO_COST;

    if (cost > 0 && pl.rows[0].credits < cost) {
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

    const ticket = await client.query(
      `INSERT INTO combo_tickets (player_id, prob, legs_count, charged)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [playerId, prob, resolved.length, cost]
    );
    const ticketId = ticket.rows[0].id;

    for (const l of resolved) {
      await client.query(
        `INSERT INTO combo_legs (ticket_id, market_id, question, choice, prob)
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, l.marketId, l.question, l.choice, l.prob]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, charged: cost, prob });
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
