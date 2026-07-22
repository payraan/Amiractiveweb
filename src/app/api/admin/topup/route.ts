import { NextResponse } from "next/server";
import { payReferralCommission } from "@/lib/referral";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE, ensureTopupTable } from "@/lib/admin";
import { normalizeUsername } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { username?: string; amount?: number | string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? "");
  const amount = Math.trunc(Number(body.amount));
  const note = (body.note ?? "").slice(0, 200);

  if (!username) {
    return NextResponse.json({ ok: false, error: "bad_username" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ ok: false, error: "bad_amount" }, { status: 400 });
  }

  await ensureTopupTable();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pl = await client.query(
      "SELECT id, credits FROM players WHERE tg_username=$1 FOR UPDATE",
      [username]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "player_not_found" }, { status: 404 });
    }
    const playerId = pl.rows[0].id;
    const upd = await client.query(
      "UPDATE players SET credits = GREATEST(0, credits + $1) WHERE id=$2 RETURNING credits",
      [amount, playerId]
    );
    await client.query(
      "INSERT INTO credit_topups (player_id, amount, note) VALUES ($1, $2, $3)",
      [playerId, amount, note || null]
    );
    await client.query("COMMIT");

    // پورسانت دعوت‌کننده (فقط برای شارژ مثبت؛ خطایش نباید شارژ را خراب کند)
    let commission = 0;
    if (amount > 0) {
      try {
        const r = await payReferralCommission(playerId, amount);
        commission = r.paid;
      } catch {
        commission = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      username,
      newCredits: upd.rows[0].credits,
      referralCommission: commission,
    });
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
