import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { ensureIrTables } from "@/lib/iran";
import { getDepositAddress, gatewayReady, USDT_NETWORK } from "@/lib/zovix";

export const dynamic = "force-dynamic";

/** موجودی، آدرس واریز و تاریخچه‌ی دفترکل */
export async function GET() {
  const jar = await cookies();
  const playerId = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();

  const [bal, ledger] = await Promise.all([
    pool.query("SELECT usdt_balance FROM players WHERE id=$1", [playerId]),
    pool.query(
      `SELECT amount, kind, ref, balance_after, created_at
         FROM wallet_ledger WHERE player_id=$1
        ORDER BY created_at DESC LIMIT 50`,
      [playerId]
    ),
  ]);

  // آدرس واریز فقط وقتی درگاه پیکربندی شده باشد.
  let address: string | null = null;
  let addressError: string | null = null;
  if (gatewayReady()) {
    const r = await getDepositAddress(playerId);
    if (r.ok) address = r.data.address;
    else addressError = r.error;
  }

  return NextResponse.json({
    ok: true,
    balance: Number(bal.rows[0]?.usdt_balance ?? 0),
    network: USDT_NETWORK,
    address,
    addressError,
    gatewayReady: gatewayReady(),
    ledger: ledger.rows.map((r) => ({
      amount: Number(r.amount),
      kind: r.kind,
      ref: r.ref,
      balanceAfter: Number(r.balance_after),
      at: r.created_at,
    })),
  });
}
