import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureIrTables, moveFunds } from "@/lib/iran";
import {
  webhookTokenValid,
  verifyDeposit,
  playerIdFromClientId,
  USDT_CURRENCY,
} from "@/lib/zovix";

export const dynamic = "force-dynamic";

// ── وبهوک درگاه ──────────────────────────────────────────────
//
// سه لایه‌ی محافظت، چون درگاه امضای وبهوک ندارد:
//
//  ۱. توکن مخفی در مسیر (?t=...) — آدرس وبهوک حدس‌زدنی نیست.
//  ۲. تأیید متقابل — پیش از هر واریز، خودمان از API درگاه می‌پرسیم که
//     این txid واقعا وجود دارد، SUCCESS است و مبلغش چقدر است. مبلغِ
//     معتبر همان است که API می‌گوید، نه آنچه در بدنه‌ی وبهوک آمده.
//  ۳. یکتاسازی روی txid — جدول واریزها ایندکس یکتا دارد، پس ارسال
//     دوباره‌ی همان وبهوک هرگز دوبار شارژ نمی‌کند.
//
// طبق مستندات، ابتدا DEPOSIT_INITIAL با وضعیت PENDING_CONFIRM می‌آید و
// بعد DEPOSIT_DONE با SUCCESS. فقط دومی شارژ می‌کند.

async function ensureDepositTable() {
  const pool = await db();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gateway_deposits (
       id BIGSERIAL PRIMARY KEY,
       txid TEXT NOT NULL,
       player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
       amount NUMERIC(18,6) NOT NULL,
       currency TEXT NOT NULL,
       network TEXT,
       status TEXT NOT NULL,
       credited BOOLEAN NOT NULL DEFAULT false,
       raw JSONB,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS gd_txid_uniq ON gateway_deposits(txid)"
  );
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!webhookTokenValid(searchParams.get("t"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = String(body.type ?? "");
  const status = String(body.status ?? "");
  const txid = String(body.txid ?? "");

  // همیشه 200 برمی‌گردانیم تا درگاه تلاش دوباره نکند، مگر خطای واقعی.
  if (type !== "DEPOSIT" || !txid) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  // مرحله‌ی اول فقط اعلان است، شارژ نمی‌کند.
  if (status !== "SUCCESS") {
    return NextResponse.json({ ok: true, pending: true });
  }

  // ── تأیید متقابل: منبع حقیقت، API درگاه است نه بدنه‌ی وبهوک ──
  const check = await verifyDeposit(txid);
  if (!check.ok) {
    // نتوانستیم تأیید کنیم — عمدا شارژ نمی‌کنیم و ۵۰۰ می‌دهیم تا درگاه
    // دوباره بفرستد.
    return NextResponse.json(
      { ok: false, error: "verify_failed" },
      { status: 500 }
    );
  }
  const row = check.data.find((d) => d.txid === txid);
  if (!row || row.status !== "SUCCESS") {
    return NextResponse.json({ ok: true, ignored: "not_confirmed" });
  }
  if (row.currency?.symbol !== USDT_CURRENCY) {
    return NextResponse.json({ ok: true, ignored: "unsupported_currency" });
  }

  const playerId = playerIdFromClientId(row.to_address?.client_id ?? "");
  const amount = Number(row.amount);
  if (!playerId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: true, ignored: "unmapped" });
  }

  await ensureIrTables();
  await ensureDepositTable();

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ایندکس یکتا روی txid یعنی اگر این واریز قبلا ثبت شده، اینجا هیچ
    // سطری برنمی‌گردد و شارژ تکراری انجام نمی‌شود.
    const ins = await client.query(
      `INSERT INTO gateway_deposits (txid, player_id, amount, currency, network, status, raw)
       VALUES ($1,$2,$3,$4,$5,'SUCCESS',$6)
       ON CONFLICT (txid) DO NOTHING
       RETURNING id`,
      [
        txid,
        playerId,
        amount,
        USDT_CURRENCY,
        String(body.network ?? ""),
        JSON.stringify(body),
      ]
    );
    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [playerId]);
    await moveFunds(client, playerId, amount, "deposit", txid);
    await client.query("UPDATE gateway_deposits SET credited=true WHERE txid=$1", [
      txid,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, credited: amount });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
