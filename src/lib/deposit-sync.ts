import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { ensureIrTables, moveFunds } from "@/lib/iran";
import {
  listDeposits,
  playerIdFromClientId,
  USDT_CURRENCY,
  type DepositRow,
} from "@/lib/zovix";

// ═══ آشتی‌دادن واریزها ═══════════════════════════════════════
//
// ── چرا این فایل وجود دارد ──
// وبهوک درگاه در پلن رایگان قفل است. تا امروز تنها راهِ باخبر شدن از واریز،
// همان وبهوک بود — یعنی عملا هیچ واریزی به حساب هیچ کاربری نمی‌نشست. پول
// می‌رسید و در استخر پروژه می‌ماند، بی‌آنکه سیستم بداند مال کیست.
//
// راه‌حل: به‌جای انتظار برای خبر، خودمان دوره‌ای فهرست واریزهای درگاه را
// می‌خوانیم. درگاه در هر ردیف `client_id` مقصد را می‌دهد و ما آن را
// `player-<id>` گذاشته‌ایم، پس نسبت‌دادن واریز به حساب قطعی است.
//
// این از وبهوک مطمئن‌تر است: وبهوکِ گم‌شده یعنی واریزِ برای‌همیشه‌گم‌شده،
// ولی خواندن دوره‌ای خودش را جبران می‌کند.
//
// ── چرا شارژ اینجاست و نه در روت ──
// وبهوک (اگر روزی فعال شود) و این مسیر باید **دقیقا** یک کار بکنند. اگر هر
// کدام نسخه‌ی خودش را داشته باشد، دیر یا زود یکی اصلاح می‌شود و دیگری نه —
// و در مسیر پول، این یعنی دو رفتار متفاوت روی یک واریز.

export async function ensureDepositTable(): Promise<void> {
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

export type CreditResult =
  | { ok: true; credited: number; playerId: number }
  | { ok: false; reason: string };

/**
 * شارژ یک واریز — تنها نقطه‌ای که پول درگاه وارد حساب کاربر می‌شود.
 *
 * ردیفی که می‌گیرد باید **از خود درگاه** آمده باشد، نه از بدنه‌ی وبهوک:
 * وبهوک امضا ندارد، پس محتوایش قابل جعل است.
 */
export async function creditDeposit(row: DepositRow): Promise<CreditResult> {
  const txid = String(row.txid ?? "");
  if (!txid) return { ok: false, reason: "no_txid" };
  if (row.status !== "SUCCESS") return { ok: false, reason: "not_success" };
  if (row.currency?.symbol !== USDT_CURRENCY) {
    return { ok: false, reason: "unsupported_currency" };
  }

  const playerId = playerIdFromClientId(row.to_address?.client_id ?? "");
  if (!playerId) return { ok: false, reason: "unmapped_client_id" };

  // تتر شش رقم اعشار دارد و ستون هم NUMERIC(18,6) است. گرد کردن اینجا
  // انجام می‌شود تا مقداری که در دفترکل می‌نشیند دقیقا همانی باشد که در
  // موجودی می‌نشیند.
  const amount = Math.round(Number(row.amount) * 1e6) / 1e6;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "bad_amount" };
  }

  await ensureIrTables();
  await ensureDepositTable();

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ بازیکن را پیش از درج می‌سنجیم، وگرنه کلید خارجی خطا می‌دهد و این
    // مسیر «خطای سرور» می‌شود — یعنی کرون هر ۱۵ دقیقه تا ابد همان خطا را
    // تکرار می‌کند و وبهوک هم بی‌پایان دوباره می‌فرستد. یک واریز به حسابِ
    // ناموجود باید **یک بار** دیده شود و کنار گذاشته شود، نه اینکه لاگ را
    // برای همیشه پر کند.
    const pl = await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [
      playerId,
    ]);
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "player_not_found" };
    }

    // ایندکس یکتا روی txid یعنی اگر این واریز قبلا ثبت شده، هیچ سطری
    // برنمی‌گردد و شارژ تکراری غیرممکن است. این تنها چیزی است که جلوی
    // دوبار شارژ شدن را می‌گیرد، چه از وبهوک بیاید چه از خواندن دوره‌ای.
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
        row.network?.symbol ?? "",
        JSON.stringify(row),
      ]
    );
    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "duplicate" };
    }

    // قرارداد moveFunds: ردیف باید از قبل قفل شده باشد — بالاتر، در همان
    // سنجشِ وجود بازیکن، با FOR UPDATE قفل شد.
    // بدون creditDemo یعنی همه‌اش واقعی — که برای پول درگاه درست است.
    await moveFunds(client, playerId, amount, "deposit", txid);
    await client.query("UPDATE gateway_deposits SET credited=true WHERE txid=$1", [
      txid,
    ]);

    await client.query("COMMIT");
    return { ok: true, credited: amount, playerId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // خطا را نمی‌بلعیم: شمارنده‌ی بدون علت از خود مشکل بدتر است.
    const msg = err instanceof Error ? err.message : "server_error";
    log.error("deposit.credit_failed", { txid, playerId, amount, err: msg });
    return { ok: false, reason: `error:${msg}` };
  } finally {
    client.release();
  }
}

export type ReconcileSummary = {
  ok: boolean;
  pagesRead: number;
  seen: number;
  credited: number;
  creditedAmount: number;
  /** چرا هر ردیف رد شد — بدون این، دفعه‌ی بعد هم کور می‌مانیم */
  skipped: Record<string, number>;
  error?: string;
};

/**
 * خواندن فهرست واریزهای درگاه و شارژ هر واریزِ تازه.
 *
 * ⚠️ سقف نرخ درگاه تنگ است، پس `maxPages` عمدا کوچک است. فهرست از
 * تازه‌ترین مرتب شده و به‌محض رسیدن به صفحه‌ای که همه‌ی ردیف‌هایش را از قبل
 * می‌شناسیم می‌ایستیم — در حالت عادی یعنی همیشه فقط یک درخواست.
 */
export async function reconcileDeposits(maxPages = 3): Promise<ReconcileSummary> {
  const sum: ReconcileSummary = {
    ok: true,
    pagesRead: 0,
    seen: 0,
    credited: 0,
    creditedAmount: 0,
    skipped: {},
  };
  const skip = (reason: string) => {
    sum.skipped[reason] = (sum.skipped[reason] ?? 0) + 1;
  };

  for (let page = 1; page <= maxPages; page++) {
    const res = await listDeposits(page);
    if (!res.ok) {
      sum.ok = false;
      sum.error = res.error;
      log.error("deposit.list_failed", { page, err: res.error });
      break;
    }
    sum.pagesRead++;

    const rows = Array.isArray(res.data) ? res.data : [];
    if (!rows.length) break;
    sum.seen += rows.length;

    let newOnThisPage = 0;
    for (const row of rows) {
      const r = await creditDeposit(row);
      if (r.ok) {
        newOnThisPage++;
        sum.credited++;
        sum.creditedAmount = Math.round((sum.creditedAmount + r.credited) * 1e6) / 1e6;
        log.info("deposit.credited", {
          playerId: r.playerId,
          amount: r.credited,
          txid: row.txid,
          network: row.network?.symbol,
        });
      } else {
        skip(r.reason);
        // «تکراری» حالت عادی است و لاگ نمی‌خواهد؛ بقیه یعنی پولی رسیده که
        // نتوانستیم نسبت بدهیم — همان چیزی که باید دیده شود.
        if (r.reason !== "duplicate") {
          log.warn("deposit.skipped", { txid: row.txid, reason: r.reason });
          newOnThisPage++;
        }
      }
    }

    // همه‌ی ردیف‌های این صفحه را از قبل می‌شناختیم، پس صفحه‌های قدیمی‌تر هم
    // قطعا قدیمی‌ترند. ادامه دادن فقط سقف نرخ را می‌سوزاند.
    if (newOnThisPage === 0) break;
  }

  return sum;
}
