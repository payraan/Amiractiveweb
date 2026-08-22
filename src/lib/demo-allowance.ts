import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { moveFunds } from "@/lib/iran";
import { DEMO_ALLOWANCE, isDemo } from "@/lib/platform-mode";

// سهمیه‌ی ماهانه‌ی پول مجازی.
//
// ── دو قاعده که رفتار این تابع را تعیین می‌کنند ──
//
// ۱. **بالا می‌برد، پایین نمی‌آورد.** اگر کاربر ۱۵۰ تتر مجازی دارد چون
//    خوب پیش‌بینی کرده، سهمیه‌ی ماه بعد آن را به ۱۰۰ برنمی‌گرداند. مهارت
//    نباید جریمه شود.
//
// ۲. **منتقل نمی‌شود.** کسی که ماه پیش دست نزده، ماه بعد ۲۰۰ نمی‌گیرد —
//    تا سقف سهمیه پر می‌شود، نه بیشتر. انباشت یعنی کمیابی از بین می‌رود، و
//    کمیابی همان چیزی است که پیش‌بینی را جدی می‌کند.
//
// ⚠️ **موجودی مستقیم دستکاری نمی‌شود.** یک `UPDATE players SET demo_balance`
// ساده کارِ همین تابع را می‌کرد و **چک سلامت شماره‌ی ۲ را می‌شکست**
// (`demo_balance = جمع ستون demo دفترکل`). هر تغییر موجودی باید از
// `moveFunds` بگذرد تا دفترکل — که تنها مبنای حسابرسی است — دروغ نگوید.

/** ماهِ جاری به وقت تهران، به شکل `YYYY-MM`. مبنای «یک بار در ماه». */
function tehranMonth(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}`;
}

export type AllowanceResult =
  | { granted: false; reason: "live_mode" | "already_this_month" | "at_cap" }
  | { granted: true; amount: number; month: string };

/**
 * اگر لازم بود، سهمیه‌ی این ماه را می‌دهد.
 *
 * بی‌خطر برای صدا زدن پیاپی: کلید یکتاسازیِ دفترکل (`kind` + `ref`) ماهِ
 * جاری است، پس دو فراخوانی هم‌زمان دو سهمیه نمی‌سازند.
 */
export async function grantMonthlyDemo(
  playerId: number
): Promise<AllowanceResult> {
  if (!isDemo()) return { granted: false, reason: "live_mode" };

  const month = tehranMonth();
  const pool = await db();

  // ── مسیر سریع ──
  // این تابع از مسیرهای پرترافیک صدا زده می‌شود (هر بار باز شدن مینی‌اپ).
  // در حالت عادی سهمیه‌ی این ماه از قبل داده شده، پس نباید بابتش ترنزاکشن
  // باز شود. یک خواندنِ ایندکس‌خور کافی است.
  //
  // ⚠️ این جای قفل را نمی‌گیرد: اگر اینجا چیزی پیدا نشد، تصمیم واقعی
  // همچنان داخل ترنزاکشن و پشت `FOR UPDATE` گرفته می‌شود. مسابقه‌ی دو
  // درخواست هم‌زمان آنجا حل می‌شود، نه اینجا.
  const quick = await pool.query(
    "SELECT 1 FROM wallet_ledger WHERE player_id=$1 AND kind='demo_allowance' AND ref=$2 LIMIT 1",
    [playerId, month]
  );
  if (quick.rowCount) return { granted: false, reason: "already_this_month" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ قفل ردیف پیش از خواندن موجودی — قرارداد `moveFunds` و همان چیزی
    // که جلوی دو سهمیه در دو درخواست هم‌زمان را می‌گیرد.
    const me = await client.query<{ demo_balance: string }>(
      "SELECT demo_balance FROM players WHERE id=$1 FOR UPDATE",
      [playerId]
    );
    if (!me.rowCount) {
      await client.query("ROLLBACK");
      return { granted: false, reason: "already_this_month" };
    }

    // آیا این ماه قبلا داده شده؟ منبع حقیقت خودِ دفترکل است، نه یک ستون
    // جدا — یک ستون یعنی دو جا که می‌توانند با هم نخوانند.
    const had = await client.query(
      "SELECT 1 FROM wallet_ledger WHERE player_id=$1 AND kind='demo_allowance' AND ref=$2 LIMIT 1",
      [playerId, month]
    );
    if (had.rowCount) {
      await client.query("ROLLBACK");
      return { granted: false, reason: "already_this_month" };
    }

    const have = Number(me.rows[0].demo_balance);
    const topUp = Math.round(Math.max(0, DEMO_ALLOWANCE - have) * 1e6) / 1e6;
    if (topUp <= 0) {
      // بالای سقف است — سهمیه نمی‌گیرد، ولی ماه هم **مصرف‌شده حساب
      // نمی‌شود**: اگر بعدا خرج کرد و زیر سقف رفت، همین ماه سهمیه‌اش را
      // می‌گیرد. وگرنه کسی که ماه را با موجودی زیاد شروع کند، کل ماه
      // محروم می‌ماند.
      await client.query("ROLLBACK");
      return { granted: false, reason: "at_cap" };
    }

    await moveFunds(client, playerId, topUp, "demo_allowance", month, {
      creditDemo: topUp,
    });

    await client.query("COMMIT");
    log.info("demo.allowance_granted", { playerId, month, topUp, had: have });
    return { granted: true, amount: topUp, month };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // ⚠️ بلعیده نمی‌شود. سهمیه‌ای که بی‌صدا نرسد یعنی کاربر با موجودی صفر
    // می‌ماند و فکر می‌کند پلتفرم خراب است.
    log.error("demo.allowance_failed", {
      playerId,
      month,
      err: err instanceof Error ? err.message : String(err),
    });
    return { granted: false, reason: "already_this_month" };
  } finally {
    client.release();
  }
}
