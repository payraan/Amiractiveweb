import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables, moveFunds } from "@/lib/iran";
import { createWithdrawal, gatewayReady, USDT_NETWORK } from "@/lib/zovix";
import { notifyPlayer } from "@/lib/telegram";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { MIN_WITHDRAW } from "@/lib/wallet-rules";
import { withdrawAddressValid } from "@/lib/withdraw-address";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;
  if (!gatewayReady()) {
    return NextResponse.json({ ok: false, error: "gateway_off" }, { status: 503 });
  }

  let body: { amount?: number; toAddress?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const toAddress = String(body.toAddress ?? "").trim();
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
    return NextResponse.json({ ok: false, error: "amount_too_low" }, { status: 400 });
  }
  // آدرس مقصد با چک‌سام شبکه سنجیده می‌شود، نه فقط طول. برداشت برگشت‌ناپذیر
  // است و آدرس غلط یعنی پول کاربر برای همیشه گم می‌شود.
  if (!withdrawAddressValid(toAddress, USDT_NETWORK)) {
    return NextResponse.json({ ok: false, error: "bad_address" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS withdrawals (
       id BIGSERIAL PRIMARY KEY,
       player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
       unique_param TEXT NOT NULL UNIQUE,
       amount NUMERIC(18,6) NOT NULL,
       to_address TEXT NOT NULL,
       network TEXT NOT NULL,
       gateway_uuid TEXT,
       status TEXT NOT NULL DEFAULT 'requested',
       error TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  const uniqueParam = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // پول *پیش از* تماس با درگاه کسر می‌شود تا کاربر نتواند با درخواست
    // همزمان بیشتر از موجودی‌اش برداشت کند.
    const pl = await client.query(
      "SELECT usdt_balance FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!pl.rowCount || Number(pl.rows[0].usdt_balance) < amount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_funds" },
        { status: 402 }
      );
    }

    await moveFunds(client, playerId, -amount, "withdraw_hold", uniqueParam);
    await client.query(
      `INSERT INTO withdrawals (player_id, unique_param, amount, to_address, network)
       VALUES ($1,$2,$3,$4,$5)`,
      [playerId, uniqueParam, amount, toAddress, USDT_NETWORK]
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  // تماس با درگاه *بیرون* از ترنزاکشن، تا قفل دیتابیس منتظر شبکه نماند.
  const r = await createWithdrawal({
    amount: amount.toFixed(6),
    toAddress,
    uniqueParam,
  });

  if (!r.ok) {
    // درگاه نپذیرفت — پول را برمی‌گردانیم.
    const c2 = await pool.connect();
    try {
      await c2.query("BEGIN");
      await c2.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [playerId]);
      await moveFunds(c2, playerId, amount, "withdraw_refund", uniqueParam);
      await c2.query(
        "UPDATE withdrawals SET status='failed', error=$2 WHERE unique_param=$1",
        [uniqueParam, r.error]
      );
      await c2.query("COMMIT");
    } catch {
      await c2.query("ROLLBACK").catch(() => {});
    } finally {
      c2.release();
    }
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }

  await pool.query(
    "UPDATE withdrawals SET status='submitted', gateway_uuid=$2 WHERE unique_param=$1",
    [uniqueParam, r.data.uuid]
  );

  // اعلان تلگرام — تنها لایه‌ی هشدار روی برداشت.
  //
  // برداشت تنها عملی است که پول را از پلتفرم بیرون می‌برد و برگشت‌ناپذیر
  // است، و هیچ تأیید دومی ندارد. این پیام جلوی سوءاستفاده را نمی‌گیرد، ولی
  // به صاحب حساب فرصت می‌دهد بلافاصله بفهمد و خبر بدهد. خطایش عمدا بلعیده
  // می‌شود: نرسیدن پیام نباید برداشتی را که در درگاه ثبت شده خراب کند.
  notifyPlayer(
    playerId,
    `🔔 درخواست برداشت <b>${amount}</b> تتر از حساب نارمون ثبت شد.\n\n` +
      `مقصد: <code>${toAddress.slice(0, 6)}…${toAddress.slice(-6)}</code>\n\n` +
      `اگر این کار را تو نکرده‌ای، همین حالا به پشتیبانی خبر بده.`
  ).catch(() => {});

  return NextResponse.json({ ok: true, uuid: r.data.uuid, amount });
}
