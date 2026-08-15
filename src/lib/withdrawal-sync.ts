import { db } from "@/lib/db";
import { moveFunds } from "@/lib/iran";
import { getWithdrawal, gatewayReady } from "@/lib/zovix";
import { notifyPlayer } from "@/lib/telegram";
import { ensureWithdrawalsTable } from "@/lib/withdrawal";

// ═══ آشتی‌دادن برداشت‌ها با درگاه ════════════════════════════
//
// `requestWithdrawal` پول را *پیش از* تماس با درگاه کسر می‌کند — که درست
// است، وگرنه با درخواست هم‌زمان می‌شد بیشتر از موجودی برداشت کرد. ولی
// نتیجه‌اش این است که هر برداشتی که به نتیجه‌ی قطعی نرسد، پول کاربر را
// نگه می‌دارد. دو حالت گیرکردن وجود دارد:
//
//   • `submitted` — درگاه پذیرفته و uuid داده، ولی بعدا ممکن است شکست
//     بخورد (موجودی درگاه، آدرس بلاک‌شده، رد دستی). هیچ‌جای کد دوباره از
//     درگاه نمی‌پرسد، پس پول برای همیشه کسرشده می‌ماند.
//
//   • `requested` — پول کسر و ردیف ثبت شده، ولی پروسه پیش از رسیدن پاسخِ
//     درگاه مرده (دیپلوی، ری‌استارت، تایم‌اوت). اینجا اصلا نمی‌دانیم درگاه
//     درخواست را دیده یا نه.
//
// ⚠️ **حالت دوم عمدا خودکار برگشت داده نمی‌شود.** اگر درگاه درخواست را
// گرفته و پول را فرستاده باشد و ما هم برگردانیم، دو بار پرداخت کرده‌ایم و
// این پول واقعی است. پس فقط علامت `stuck` می‌خورد تا آدم ببیندش. تصمیم
// اشتباهِ خودکار روی پول، از تصمیم دیرِ انسانی بدتر است.

// ── وضعیت‌های درگاه ──────────────────────────────────────────
//
// این فهرست‌ها دیگر حدس نیستند: از مستندات Zovix آمده‌اند و با یک برداشت
// واقعی هم دیده شده‌اند. فهرست کامل مستندات:
//   PENDING · PENDING_ADMIN · SENT_TO_BLOCKCHAIN · PENDING_CONFIRM ·
//   SUCCESS · FAILED · CANCELLED_BY_ADMIN · CANCELLED_BY_USER ·
//   REJECTED_BY_AML

/**
 * وضعیت موفق — ولی **به‌تنهایی کافی نیست**، پایین را ببین.
 */
const DONE = new Set(["SUCCESS", "COMPLETED", "DONE", "CONFIRMED"]);

/**
 * وضعیت‌های قطعیِ شکست — پول باید برگردد.
 *
 * ⚠️ سه رشته‌ی اول تا امروز اینجا نبودند و این پول‌سوزترین حفره‌ی این فایل
 * بود: تأیید برداشت در Zovix **دستی** است، پس رد شدن به دست ادمین یک
 * سناریوی روزمره است نه استثنا. بدون این‌ها، ردیفِ ردشده هر ۱۵ دقیقه
 * «نمی‌شناسم» می‌گرفت و پول کاربر تا ابد کسرشده می‌ماند.
 */
const FAILED = new Set([
  "CANCELLED_BY_ADMIN",
  "CANCELLED_BY_USER",
  "REJECTED_BY_AML",
  "FAILED",
  "REJECTED",
  "CANCELED",
  "CANCELLED",
  "EXPIRED",
  "DECLINED",
]);

/**
 * وضعیت‌های «هنوز در راه» — نه موفق، نه شکست. فقط باید دوباره پرسید.
 *
 * جدا نگه داشتنشان برای این است که فهرست `unknown` واقعا فهرستِ ناشناخته‌ها
 * بماند. وقتی چیزی که می‌شناسیم هم آنجا می‌نشست، رشته‌ی واقعا تازه گم
 * می‌شد میان نویز.
 */
const IN_FLIGHT = new Set([
  "PENDING",
  "PENDING_ADMIN",
  "SENT_TO_BLOCKCHAIN",
  "PENDING_CONFIRM",
  "PROCESSING",
]);

/** پس از این مدت، ردیف `requested` بی‌سرانجام شمرده می‌شود. */
const STUCK_AFTER_MIN = 15;

export type SyncResult = {
  checked: number;
  completed: number;
  refunded: number;
  stuck: number;
  /** هنوز در راه — وضعیت شناخته‌شده ولی غیرقطعی. */
  inFlight: number;
  /**
   * هر وضعیتی که از درگاه دیدیم.
   *
   * بدون این، تنها راه فهمیدنِ رشته‌های واقعی درگاه، حدس‌زدن بود — و همین
   * حدس‌ها بودند که سه وضعیتِ «رد شد» را از فهرست شکست جا انداختند.
   */
  seen: string[];
  /** وضعیت‌هایی که در هیچ فهرستی نیستند. */
  unknown: string[];
};

export async function reconcileWithdrawals(): Promise<SyncResult> {
  const out: SyncResult = {
    checked: 0,
    completed: 0,
    refunded: 0,
    stuck: 0,
    inFlight: 0,
    seen: [],
    unknown: [],
  };
  if (!gatewayReady()) return out;

  // جدول و ستون‌هایش را همین‌جا هم تضمین می‌کنیم، نه فقط در مسیر ثبت
  // برداشت: این کرون ستون txid را می‌نویسد و اگر هنوز ساخته نشده باشد
  // هر ۱۵ دقیقه می‌ترکد. بی‌هزینه و idempotent است.
  await ensureWithdrawalsTable();
  const pool = await db();

  // ── ۱. ردیف‌های submitted: از درگاه بپرس ──────────────────
  const open = await pool.query<{
    id: string;
    player_id: number;
    amount: string;
    unique_param: string;
    gateway_uuid: string;
  }>(
    `SELECT id, player_id, amount, unique_param, gateway_uuid
       FROM withdrawals
      WHERE status='submitted' AND gateway_uuid IS NOT NULL
      ORDER BY id LIMIT 50`
  );

  for (const w of open.rows) {
    out.checked++;
    const r = await getWithdrawal(w.gateway_uuid);
    if (!r.ok) continue; // درگاه در دسترس نیست — دور بعد

    // ⚠️ ردیف باید **همان** برداشت باشد. نسخه‌ی قبلی اگر شناسه نمی‌خورد،
    // بی‌صدا به `data[0]` می‌افتاد — یعنی می‌توانست وضعیت یک برداشتِ دیگر
    // را روی این یکی بنشاند. تنها حالتی که بدون تطابق شناسه امن است، وقتی
    // است که پاسخ دقیقا یک ردیف دارد (ما با همان uuid پرسیده‌ایم).
    const rows = Array.isArray(r.data) ? r.data : [];
    const row =
      rows.find((x) => x.id === w.gateway_uuid) ??
      (rows.length === 1 ? rows[0] : null);
    if (!row) continue;

    const status = String(row.status ?? "").toUpperCase();
    const txid = String(row.txid ?? "").trim();
    if (!out.seen.includes(status)) out.seen.push(status);

    if (FAILED.has(status)) {
      if (await refundWithdrawal(w.id, `gateway:${status}`)) out.refunded++;
      continue;
    }

    // ── چرا وضعیت به‌تنهایی کافی نیست ──────────────────────
    //
    // درگاه در همان لحظه‌ی ثبت `SUCCESS` می‌دهد، در حالی که پنلش همان
    // برداشت را `PENDING` و بدون TxID نشان می‌دهد و ادمین هنوز تأییدش
    // نکرده. یعنی `SUCCESS` آنجا «درخواست ثبت شد» است، نه «پول رفت».
    //
    // اگر همان‌جا `completed` می‌زدیم، دیگر هرگز نمی‌پرسیدیم — و اگر ادمین
    // بعدا ردش می‌کرد، پول کاربر تا ابد کسرشده می‌ماند.
    //
    // پس مدرکِ ما شناسه‌ی تراکنش روی زنجیره است، نه رشته‌ی وضعیت: تا txid
    // نیامده، برداشت هنوز در راه است و دور بعد دوباره می‌پرسیم.
    if (DONE.has(status) && txid) {
      await pool.query(
        "UPDATE withdrawals SET status='completed', txid=$2 WHERE id=$1 AND status='submitted'",
        [w.id, txid]
      );
      out.completed++;
      continue;
    }

    if (DONE.has(status) || IN_FLIGHT.has(status)) {
      out.inFlight++;
      continue;
    }

    // رشته‌ای که در هیچ فهرستی نیست — نه فرض می‌کنیم موفق است نه ناموفق.
    if (!out.unknown.includes(status)) out.unknown.push(status);
  }

  // ── ۲. ردیف‌های requested که جا مانده‌اند ──────────────────
  //
  // فقط علامت می‌خورند. برگشت خودکار اینجا ممنوع است — بالا توضیح داده شد.
  const stuck = await pool.query(
    `UPDATE withdrawals
        SET status='stuck',
            error=COALESCE(error, 'no gateway response; needs manual review')
      WHERE status='requested'
        AND created_at < now() - ($1 || ' minutes')::interval
      RETURNING id`,
    [String(STUCK_AFTER_MIN)]
  );
  out.stuck = stuck.rowCount ?? 0;

  return out;
}

/**
 * برگرداندن پول یک برداشتِ ناموفق. `true` یعنی همین فراخوانی پول را برگرداند.
 *
 * صادرشده است چون علامت `stuck` بدون راهِ اقدام بی‌فایده است: کسی که پس از
 * بررسی با درگاه مطمئن شد پول نرفته، باید بتواند برگردش بزند.
 *
 * ⚠️ **ادعای مالکیت و تغییر وضعیت، خودِ UPDATE است** نه یک چک جدا. اگر دو
 * اجرای هم‌زمان (دو تیک کرون، یا کرون و ادمین) به یک ردیف برسند، فقط یکی
 * سطری می‌گیرد و دومی هیچ — پس پول هرگز دوبار برنمی‌گردد. با «اول بخوان،
 * بعد بنویس» این تضمین وجود نداشت.
 */
export async function refundWithdrawal(
  withdrawalId: string | number,
  reason: string
): Promise<boolean> {
  const pool = await db();
  const client = await pool.connect();
  let refunded: { player_id: number; amount: string } | null = null;

  try {
    await client.query("BEGIN");

    const claim = await client.query<{
      player_id: number;
      amount: string;
      unique_param: string;
    }>(
      `UPDATE withdrawals SET status='failed', error=$2
        WHERE id=$1 AND status IN ('submitted','stuck')
        RETURNING player_id, amount, unique_param`,
      [withdrawalId, reason]
    );
    if (!claim.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    const w = claim.rows[0];

    await client.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [w.player_id]);
    await moveFunds(
      client,
      w.player_id,
      Number(w.amount),
      "withdraw_refund",
      w.unique_param
    );
    await client.query("COMMIT");
    refunded = { player_id: w.player_id, amount: w.amount };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return false;
  } finally {
    client.release();
  }

  // خطایش بلعیده می‌شود: نرسیدن پیام نباید برگشت پولی را که انجام شده
  // خراب کند. همان قاعده‌ای که خودِ requestWithdrawal دارد.
  notifyPlayer(
    refunded.player_id,
    `↩️ درخواست برداشت <b>${Number(refunded.amount)}</b> تتر انجام نشد و مبلغ ` +
      `به موجودی شما برگشت.\n\nمی‌توانید دوباره تلاش کنید.`
  ).catch(() => {});

  return true;
}
