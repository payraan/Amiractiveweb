import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { hasLinkedTelegram } from "@/lib/telegram";
import { ensureIrTables } from "@/lib/iran";
import { gatewayReady, USDT_NETWORK } from "@/lib/zovix";
import { depositAddressFor } from "@/lib/deposit-address";

export const dynamic = "force-dynamic";

/** موجودی، آدرس واریز و تاریخچه‌ی دفترکل */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();

  const [bal, ledger] = await Promise.all([
    pool.query("SELECT usdt_balance, demo_balance FROM players WHERE id=$1", [playerId]),
    pool.query(
      `SELECT amount, kind, ref, balance_after, created_at
         FROM wallet_ledger WHERE player_id=$1
        ORDER BY created_at DESC LIMIT 50`,
      [playerId]
    ),
  ]);

  // آدرس واریز فقط وقتی درگاه پیکربندی شده *و* حساب به تلگرام وصل باشد.
  //
  // خودِ صفحه‌ی کیف پول قفل نمی‌شود — موجودی و تاریخچه همیشه دیده می‌شوند.
  // فقط آدرس واریز داده نمی‌شود، چون همان‌جاست که پول *وارد* می‌شود و مرز
  // مصوب روی ورود پول است.
  const linked = await hasLinkedTelegram(playerId);
  let address: string | null = null;
  let addressError: string | null = null;
  if (gatewayReady() && linked) {
    // از دیتابیس، و فقط بار اول از درگاه — دلیلش در deposit-address.ts
    const r = await depositAddressFor(playerId);
    if (r.ok) address = r.address;
    else addressError = r.error;
  }

  return NextResponse.json({
    ok: true,
    // `balance` مجموع قابل خرج است (واقعی + دمو) — همان چیزی که کاربر
    // به‌عنوان «موجودی» می‌شناسد و می‌تواند با آن پیش‌بینی کند.
    // `withdrawable` فقط پول واقعی است؛ فرم برداشت باید از این استفاده کند،
    // نه از balance، وگرنه کاربر مبلغی را می‌زند که سرور ردش می‌کند.
    balance:
      Number(bal.rows[0]?.usdt_balance ?? 0) +
      Number(bal.rows[0]?.demo_balance ?? 0),
    withdrawable: Number(bal.rows[0]?.usdt_balance ?? 0),
    demoBalance: Number(bal.rows[0]?.demo_balance ?? 0),
    network: USDT_NETWORK,
    address,
    addressError,
    gatewayReady: gatewayReady(),
    telegramLinked: linked,
    ledger: ledger.rows.map((r) => ({
      amount: Number(r.amount),
      kind: r.kind,
      ref: r.ref,
      balanceAfter: Number(r.balance_after),
      at: r.created_at,
    })),
  });
}
