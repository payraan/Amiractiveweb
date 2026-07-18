import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { getOrCreateRound, isClosed } from "@/lib/rounds";
import type { Asset } from "@/lib/market";

export const dynamic = "force-dynamic";

type Body = { asset?: string; guess?: number | string };

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
  const guess = Number(body.guess);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "bad_asset" }, { status: 400 });
  }
  if (!Number.isFinite(guess) || guess <= 0) {
    return NextResponse.json({ ok: false, error: "bad_guess" }, { status: 400 });
  }

  const round = await getOrCreateRound(asset);
  if (isClosed(round)) {
    return NextResponse.json({ ok: false, error: "round_closed" }, { status: 409 });
  }

  const pool = await db();
  try {
    await pool.query(
      `INSERT INTO predictions (round_id, player_id, guess)
       VALUES ($1, $2, $3)`,
      [round.id, playerId, guess]
    );
  } catch (err: unknown) {
    // unique_violation = already predicted this round
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: "already_predicted" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, roundId: round.id });
}
