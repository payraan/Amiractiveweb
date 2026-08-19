import type { RevenueKind } from "@/lib/revenue-kinds";
import { log } from "@/lib/log";
import { db } from "@/lib/db";

// ═══ بازار ایران — اقتصاد پولی ═══════════════════════════════
//
// برخلاف بازارهای خارجی که امتیازی‌اند، اینجا با پول واقعی (تتر) کار
// می‌شود. دلیل تفکیک: بازارهای خارجی از پالی‌مارکت می‌آیند و تسویه‌شان
// دست ما نیست؛ بازارهای ایرانی را خودمان می‌سازیم و تسویه می‌کنیم.
//
// ── مکانیزم: استخر تجمیعی (Parimutuel) ──
// همه‌ی شرط‌ها در یک استخر جمع می‌شوند، کمیسیون کسر می‌شود، و باقی بین
// برنده‌ها به نسبت سهمشان تقسیم می‌شود. برخلاف دفتر سفارش، به نقدینگی
// اولیه نیاز ندارد و از روز اول کار می‌کند.
//
//   ضریب برد = (کل استخر × (۱ − کمیسیون)) ÷ مجموع پیش‌بینی‌های طرف برنده
//
// همان منطق صفر-انتظار بقیه‌ی پلتفرم: طرف کم‌طرفدار پاداش بزرگ‌تر.
//
// ── تله‌ای که بسته شده ──
// اگر بازار شدیدا تک‌طرفه شود (مثلا ۹۹٪ روی یک گزینه)، ضریب برد به زیر
// ۱ می‌رسد و برنده با اینکه درست حدس زده، ضرر می‌کند. این حس فریب می‌دهد.
// راه‌حل: اگر ضریب طرف برنده زیر MIN_ODDS بیفتد، بازار باطل و کل پول
// برگردانده می‌شود (کمیسیون هم برنمی‌داریم).

export const COMMISSION = 0.03; // ۳٪ — از حجم، نه از سود
// حداقل مبلغ پیش‌بینی ۱ تتر. دلیل قبلی («فی شبکه‌ی تتر») برای شرط داخلی بی‌ربط بود:
// شرط فقط یک ردیف دیتابیس است و هیچ کارمزد شبکه‌ای ندارد؛ فی شبکه فقط روی
// واریز و برداشت اثر دارد — حداقل برداشت جداست و در wallet-rules.ts تعریف
// می‌شود (آنجا چون فرم‌های کلاینت هم به آن نیاز دارند و این فایل به pg وصل است).
export const MIN_STAKE_USDT = 1;
export const MIN_ODDS = 1.05; // زیر این، بازار باطل می‌شود
export const DISPUTE_HOURS = 24; // پنجره‌ی اعتراض پس از تسویه
/** کارمزد ایجاد بازار — از کیف پول تتر. اگر بازار رد شود کامل برمی‌گردد. */
export const PROPOSE_FEE_USDT = 1;

/**
 * بوست بازار — دیده‌شدن، نه شانس بیشتر.
 *
 * ⚠️ **فقط با پول واقعی** (`realOnly`). قاعده‌ی عمومی خرج این است که اول از
 * بونوس برداشته شود، ولی اینجا عمدا برعکس است: بوست قرار است **درآمد**
 * باشد. اگر با پول هدیه خریده شود، پلتفرم دارد از جیب خودش به خودش پول
 * می‌دهد و دفترکل درآمد عددی نشان می‌دهد که وجود ندارد.
 *
 * بوست هیچ اثری بر ضریب، تسویه یا شانس برد ندارد — فقط بازار را بالاتر
 * می‌آورد و یک بار به کاربران اطلاع می‌دهد. این مرز را نگه دار: لحظه‌ای که
 * پول بتواند نتیجه را عوض کند، تز محصول شکسته است.
 */
export const BOOST_PRICE_USDT = 5;

/** چند ساعت در پنل طلایی بماند. */
export const BOOST_HOURS = 24;

export type IrMarketStatus =
  | "pending" // منتظر تأیید انسانی
  | "open" // باز برای شرط
  | "locked" // بسته، منتظر نتیجه
  | "settling" // نتیجه ثبت شده، در پنجره‌ی اعتراض
  | "settled" // تسویه‌ی نهایی و پرداخت
  | "void"; // باطل — پول برگشت

let ready: Promise<void> | null = null;

export async function ensureIrTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      // کیف پول: موجودی تتر هر کاربر
      await pool.query(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS usdt_balance NUMERIC(18,6) NOT NULL DEFAULT 0"
      );

      // دفترکل تغییرناپذیر — هر تغییر موجودی یک سطر.
      // موجودی همیشه باید با جمع دفترکل بخواند؛ مبنای حسابرسی.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS wallet_ledger (
           id BIGSERIAL PRIMARY KEY,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           amount NUMERIC(18,6) NOT NULL,
           kind TEXT NOT NULL,
           ref TEXT,
           balance_after NUMERIC(18,6) NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS wl_player_idx ON wallet_ledger(player_id, created_at DESC)"
      );

      // ── پول دمو ──────────────────────────────────────────
      //
      // موجودی جداگانه، نه یک برچسب روی حساب. برچسبِ `is_demo` روی *حساب*
      // بود و همین باعث می‌شد کمیسیون یک بازارِ کاملا دمو «واقعی» ثبت شود:
      // پرداخت‌کننده‌ی مشخصی نداشت و از روی سازنده‌ی بازار حساب می‌شد.
      // با ستون جدا، رد خودِ پول گرفته می‌شود نه رد صاحبش.
      //
      // قاعده: خرج همیشه اول از دمو برداشته می‌شود؛ برگشتِ اصلِ پول به دمو
      // برمی‌گردد و هر چه بالاتر از آن بود سود است و واقعی می‌شود. برداشت
      // فقط به `usdt_balance` دست می‌زند، پس دمو ذاتا برداشت‌ناپذیر است.
      await pool.query(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS demo_balance NUMERIC(18,6) NOT NULL DEFAULT 0"
      );
      // سهم دمو از همین سطر، و موجودی دموی پس از آن — تا دفترکل به‌تنهایی
      // قابل حسابرسی بماند و لازم نباشد از جای دیگری بازسازی شود.
      await pool.query(
        "ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS demo NUMERIC(18,6) NOT NULL DEFAULT 0"
      );
      await pool.query(
        "ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS demo_after NUMERIC(18,6) NOT NULL DEFAULT 0"
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_markets (
           id SERIAL PRIMARY KEY,
           creator_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
           question TEXT NOT NULL,
           category TEXT NOT NULL DEFAULT 'other',
           source_note TEXT NOT NULL,
           closes_at TIMESTAMPTZ NOT NULL,
           status TEXT NOT NULL DEFAULT 'pending',
           outcome TEXT,
           yes_total NUMERIC(18,6) NOT NULL DEFAULT 0,
           no_total NUMERIC(18,6) NOT NULL DEFAULT 0,
           bettors INTEGER NOT NULL DEFAULT 0,
           settled_at TIMESTAMPTZ,
           void_reason TEXT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS irm_status_idx ON ir_markets(status, closes_at)"
      );
      // هزینه‌ی پرداختی سازنده (تتر) — برای برگشت دقیق هنگام رد شدن.
      // بازارهای قدیمی که با MOON ساخته شده‌اند صفر می‌مانند و برگشتی ندارند.
      await pool.query(
        "ALTER TABLE ir_markets ADD COLUMN IF NOT EXISTS fee_usdt NUMERIC(18,6) NOT NULL DEFAULT 0"
      );
      // ── بوست ──────────────────────────────────────────────
      // `boosted_until` تاریخ انقضاست نه یک پرچم: پرچم لازم دارد کسی
      // خاموشش کند، و آن «کسی» روزی اجرا نمی‌شود. تاریخ خودش منقضی می‌شود.
      await pool.query(
        "ALTER TABLE ir_markets ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ"
      );
      await pool.query(
        "ALTER TABLE ir_markets ADD COLUMN IF NOT EXISTS boost_paid NUMERIC(18,6) NOT NULL DEFAULT 0"
      );
      // کاور ۱۶:۹ — `file_id` تلگرام، نه آدرس. تلگرام فایلِ خودش را بدون
      // آپلود دوباره می‌فرستد، پس پخش سراسری هیچ باری روی سرور ما نمی‌گذارد.
      await pool.query(
        "ALTER TABLE ir_markets ADD COLUMN IF NOT EXISTS cover_file_id TEXT"
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS ir_markets_boosted
           ON ir_markets (boosted_until DESC) WHERE boosted_until IS NOT NULL`
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_bets (
           id BIGSERIAL PRIMARY KEY,
           market_id INTEGER NOT NULL REFERENCES ir_markets(id) ON DELETE CASCADE,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           side TEXT NOT NULL,
           stake NUMERIC(18,6) NOT NULL,
           payout NUMERIC(18,6),
           status TEXT NOT NULL DEFAULT 'open',
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS irb_market_idx ON ir_bets(market_id, player_id)"
      );

      // سهم دمو از اصلِ همین شرط. تسویه از روی همین تصمیم می‌گیرد چقدر از
      // پرداختی به دمو برگردد و چقدرش سودِ واقعی است.
      await pool.query(
        "ALTER TABLE ir_bets ADD COLUMN IF NOT EXISTS demo_stake NUMERIC(18,6) NOT NULL DEFAULT 0"
      );

      // ── مهاجرت یک‌باره ────────────────────────────────────
      //
      // تا امروز هیچ پول واقعی‌ای وارد سیستم نشده (هیچ ردیف واریزِ درگاه
      // وجود ندارد)، پس هر موجودی‌ای که هست دمو است. این را یک بار به ستون
      // تازه منتقل می‌کنیم، وگرنه پول دموی موجود «واقعی» می‌ماند و قابل
      // برداشت.
      //
      // شرطِ «هیچ واریزی ثبت نشده» عمدی است: اگر روزی این کد روی دیتابیسی
      // اجرا شود که پول واقعی دارد، هیچ کاری نمی‌کند. مهاجرتی که بتواند دو
      // بار اجرا شود و بار دوم خراب کند، از نبودش بدتر است.
      // ⚠️ `gateway_deposits` را وبهوک درگاه می‌سازد، نه این بلوک — پس ممکن
      // است هنوز وجود نداشته باشد و ارجاع مستقیم، کل اسکیما را می‌شکست.
      // نبودنِ جدول یعنی قطعا هیچ واریزی نبوده، که همان شرط ماست.
      //
      // ⚠️ دو کوئری جدا، نه یک CASE. Postgres کل دستور را **پیش از اجرا**
      // تجزیه می‌کند و ارجاع به جدولِ ناموجود همان‌جا خطا می‌دهد — حتی اگر
      // شاخه‌ی CASE هرگز اجرا نشود. `to_regclass` در زمان اجراست، خیلی دیر.
      // نسخه‌ی اول همین را داشت و روی دیتابیسی که هنوز واریزی ندیده بود کل
      // اسکیما را می‌شکست.
      const tbl = await pool.query<{ t: string | null }>(
        "SELECT to_regclass('public.gateway_deposits')::text AS t"
      );
      let noReal = true;
      if (tbl.rows[0]?.t) {
        const r = await pool.query<{ ok: boolean }>(
          "SELECT NOT EXISTS (SELECT 1 FROM gateway_deposits WHERE credited) AS ok"
        );
        noReal = Boolean(r.rows[0]?.ok);
      }
      if (noReal) {
        await pool.query(
          `UPDATE players SET demo_balance = usdt_balance, usdt_balance = 0
            WHERE usdt_balance > 0 AND demo_balance = 0`
        );
        // ردیف‌های قدیمی دفترکل سهم دمو ندارند. بدون این، جمع ستون `demo`
        // با `demo_balance` نمی‌خواند و دفترکل — که تنها مبنای حسابرسی
        // است — از همان روز اول قابل اتکا نیست.
        await pool.query(
          "UPDATE wallet_ledger SET demo = amount, demo_after = balance_after WHERE demo = 0"
        );
        // شرط‌های موجود پیش از وجود این ستون ثبت شده‌اند و همه صفر گرفتند.
        // بدون این، نمای «پول واقعی» کل پول قفل‌شده در بازارهای باز را
        // واقعی نشان می‌دهد — دقیقا همان ۸۰۶۹ دلاری که در پنل دیده می‌شد،
        // در حالی که یک تتر واقعی هم در آن نبود.
        await pool.query(
          "UPDATE ir_bets SET demo_stake = stake WHERE demo_stake = 0"
        );
        // و همین برای درآمدهای ثبت‌شده: همه‌شان کمیسیون بازارهای دمو بودند.
        await pool.query(
          "UPDATE platform_revenue SET demo_amount = amount, is_demo = true WHERE demo_amount = 0"
        );
      }

      // ── اعتراض به نتیجه ──────────────────────────────────
      // تا امروز «پنجره‌ی اعتراض» فقط یک تایمر بود که جلوی تسویه را می‌گرفت و
      // کاربر هیچ راهی برای اعتراض نداشت. این جدول همان وعده را واقعی می‌کند:
      // شرکت‌کننده‌های همان بازار می‌توانند در پنجره اعتراض ثبت کنند و تا وقتی
      // اعتراضِ باز وجود دارد، تسویه‌ی نهایی انجام نمی‌شود.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_disputes (
           id BIGSERIAL PRIMARY KEY,
           market_id INTEGER NOT NULL REFERENCES ir_markets(id) ON DELETE CASCADE,
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           reason TEXT NOT NULL,
           status TEXT NOT NULL DEFAULT 'open',
           admin_note TEXT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           resolved_at TIMESTAMPTZ,
           UNIQUE (market_id, player_id)
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ird_open_idx ON ir_disputes(status, created_at DESC)"
      );

      // پول دمو از پول واقعی جدا می‌ماند.
      //
      // قاعده‌ی تشخیص ساده و قطعی است: پول واقعی *فقط* از وبهوک درگاه وارد
      // می‌شود. هر شارژ دستیِ ادمین یعنی حساب تستی. پس حسابی که دستی شارژ
      // شده «دمو» علامت می‌خورد و آمار و درآمدش از اعداد واقعی جدا می‌شود.
      await pool.query(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false"
      );

      // نشان‌های منتخبی که کاربر انتخاب کرده روی پروفایلش بنشینند
      await pool.query(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS showcase TEXT NOT NULL DEFAULT ''"
      );

      // ── دفترکل درآمد پلتفرم ──────────────────────────────
      // پیش از این، کمیسیون و کارمزد ایجاد بازار هیچ‌جا ثبت نمی‌شد: فقط از
      // موجودی کاربر کم می‌شد و ناپدید می‌شد. درآمد واقعی را فقط با تفریق
      // «تتر واقعی در درگاه منهای مجموع موجودی کاربران» می‌شد حدس زد، که نه
      // قابل تفکیک بود و نه قابل حسابرسی. هر برداشت پلتفرم اینجا یک سطر است.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS platform_revenue (
           id BIGSERIAL PRIMARY KEY,
           kind TEXT NOT NULL,
           amount NUMERIC(18,6) NOT NULL,
           market_id INTEGER REFERENCES ir_markets(id) ON DELETE SET NULL,
           player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
           note TEXT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        "ALTER TABLE platform_revenue ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false"
      );
      // سهم دموی همین درآمد.
      //
      // بولین کافی نبود: کمیسیون یک بازار می‌تواند هم‌زمان از پول واقعی و
      // پول دمو بیاید، چون در استخر parimutuel پول همه با هم مخلوط می‌شود.
      // «واقعی یا دمو» برای چنین ردیفی پرسش غلطی است؛ پرسش درست «چقدرش» است.
      await pool.query(
        "ALTER TABLE platform_revenue ADD COLUMN IF NOT EXISTS demo_amount NUMERIC(18,6) NOT NULL DEFAULT 0"
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS prv_kind_idx ON platform_revenue(kind, created_at DESC)"
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS prv_created_idx ON platform_revenue(created_at DESC)"
      );

      // ── پست‌های کانال ────────────────────────────────────
      // برای اینکه کرون بتواند درصدهای یک کارت منتشرشده را به‌روز کند، باید
      // بداند آن کارت کجا و با کدام شناسه‌ی پیام نشسته. ربات فقط پیامی را
      // می‌تواند ویرایش کند که خودش فرستاده و شناسه‌اش را دارد؛ نسخه‌ی
      // فوروارد‌شده پیام مستقلی است و از دسترس بیرون.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_market_posts (
           id BIGSERIAL PRIMARY KEY,
           market_id INTEGER NOT NULL REFERENCES ir_markets(id) ON DELETE CASCADE,
           chat_id TEXT NOT NULL,
           message_id BIGINT NOT NULL,
           last_yes_pct NUMERIC(5,1),
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           UNIQUE (chat_id, message_id)
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS imp_market_idx ON ir_market_posts(market_id)"
      );
    });
  }
  return ready;
}

/** ضریب برد هر ۱ تتر برای یک طرف. صفر یعنی آن طرف شرطی ندارد. */
export function oddsFor(
  yesTotal: number,
  noTotal: number,
  side: "yes" | "no"
): number {
  const winners = side === "yes" ? yesTotal : noTotal;
  if (winners <= 0) return 0;
  return ((yesTotal + noTotal) * (1 - COMMISSION)) / winners;
}

/** احتمال ضمنی بازار — همان چیزی که به کاربر نشان می‌دهیم. */
export function impliedPct(yesTotal: number, noTotal: number): number {
  const t = yesTotal + noTotal;
  if (t <= 0) return 50;
  return Math.round((yesTotal / t) * 1000) / 10;
}

/** آیا این نتیجه ضریب سالمی می‌سازد یا باید باطل شود؟ */
export function wouldBeVoid(
  yesTotal: number,
  noTotal: number,
  outcome: "yes" | "no"
): boolean {
  const o = oddsFor(yesTotal, noTotal, outcome);
  return o > 0 && o < MIN_ODDS;
}

/**
 * تغییر موجودی کیف پول با ثبت در دفترکل.
 * حتما داخل ترنزاکشنی صدا زده شود که ردیف بازیکن را با FOR UPDATE قفل کرده.
 */
export type FundsResult = {
  /** موجودی واقعی پس از تغییر — همان چیزی که قابل برداشت است. */
  real: number;
  /** موجودی دمو پس از تغییر. */
  demo: number;
  /**
   * سهم دمو از همین جابه‌جایی. برای بدهی مثبت است (چقدر دمو خرج شد) و
   * برای بستانکاری هم مثبت (چقدر از اعتبار، دمو بود).
   */
  demoPart: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function moveFunds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  playerId: number,
  amount: number,
  kind: string,
  ref?: string,
  opts: {
    /**
     * فقط برای بستانکاری: چه مقدار از این پول دمو است.
     *
     * پیش‌فرضش صفر (همه واقعی) است و نه «به نسبت». حدس‌زدنِ سهم دمو یعنی
     * جایی که فراخوان یادش برود، پول دمو بی‌سروصدا واقعی می‌شود — و پول
     * واقعیِ بی‌پشتوانه چیزی است که در برداشت خودش را نشان می‌دهد.
     */
    creditDemo?: number;
    /**
     * فقط برای بدهی: از دمو برندار، حتی اگر موجودی دمو داشته باشد.
     *
     * ⚠️ تنها مصرفش برداشت است و همان‌جا حیاتی است. بدون این، `moveFunds`
     * چون همیشه اول از دمو کم می‌کند، بونوس را از سیستم بیرون می‌فرستاد —
     * دقیقا همان چیزی که این ستون برای جلوگیری‌اش ساخته شد.
     */
    realOnly?: boolean;
  } = {}
): Promise<FundsResult> {
  // ⚠️ ردیف باید از قبل با FOR UPDATE قفل شده باشد (قرارداد این تابع)، پس
  // خواندن و بعد نوشتن اینجا امن است و مسابقه نمی‌سازد.
  const cur = await client.query(
    "SELECT usdt_balance, demo_balance FROM players WHERE id=$1",
    [playerId]
  );
  if (!cur.rowCount) throw new Error("player_not_found");
  const realBefore = Number(cur.rows[0].usdt_balance);
  const demoBefore = Number(cur.rows[0].demo_balance);

  let dReal: number;
  let dDemo: number;

  if (amount < 0) {
    const spend = -amount;
    if (opts.realOnly) {
      // برداشت: دمو اصلا لمس نمی‌شود.
      if (spend > realBefore + 1e-9) throw new Error("insufficient_funds");
      dDemo = 0;
      dReal = -spend;
    } else {
      // خرج عادی: اول از دمو، تا بونوس واقعا مصرف شود.
      if (spend > demoBefore + realBefore + 1e-9) {
        throw new Error("insufficient_funds");
      }
      dDemo = -Math.min(spend, demoBefore);
      dReal = -(spend + dDemo); // dDemo منفی است، پس این باقی‌مانده است
    }
  } else {
    // اعتبار: سهم دمو از بیرون می‌آید و هرگز از خودِ مبلغ بیشتر نمی‌شود.
    dDemo = Math.max(0, Math.min(opts.creditDemo ?? 0, amount));
    dReal = amount - dDemo;
  }

  const realAfter = round6(realBefore + dReal);
  const demoAfter = round6(demoBefore + dDemo);
  if (realAfter < 0 || demoAfter < 0) throw new Error("insufficient_funds");

  await client.query(
    "UPDATE players SET usdt_balance=$2, demo_balance=$3 WHERE id=$1",
    [playerId, realAfter, demoAfter]
  );
  await client.query(
    `INSERT INTO wallet_ledger (player_id, amount, kind, ref, balance_after, demo, demo_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [playerId, amount, kind, ref ?? null, realAfter, round6(dDemo), demoAfter]
  );

  return { real: realAfter, demo: demoAfter, demoPart: Math.abs(round6(dDemo)) };
}

/** گرد کردن به شش رقم — همان دقتی که ستون‌های NUMERIC(18,6) دارند. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * ثبت یک سطر درآمد پلتفرم.
 *
 * برخلاف moveFunds، اینجا هیچ موجودی‌ای جابه‌جا نمی‌شود — پول واقعی همیشه در
 * کیف پول تجمیعی درگاه است. این جدول فقط می‌گوید «از این مبلغ، این‌قدرش سهم
 * پلتفرم است و بابت چه». مبلغ منفی یعنی برگشت (مثلاً رد شدن بازار).
 *
 * حتما داخل همان ترنزاکشنی صدا زده شود که پول را جابه‌جا می‌کند، وگرنه ممکن
 * است پول برداشته شود ولی ثبت نشود.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordRevenue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  kind: RevenueKind,
  amount: number,
  opts: {
    marketId?: number;
    playerId?: number;
    note?: string;
    /** چه مقدار از این درآمد از پول دمو آمده. پیش‌فرض صفر یعنی همه‌اش واقعی. */
    demoAmount?: number;
  } = {}
): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) return;

  // ⚠️ سهم دمو از **خودِ پول** می‌آید، نه از برچسبِ حساب.
  //
  // نسخه‌ی قبلی `is_demo` بازیکن یا سازنده‌ی بازار را می‌خواند. نتیجه‌اش این
  // شد که کمیسیون یک بازارِ کاملا دمو «واقعی» ثبت شد — چون کمیسیون تسویه
  // پرداخت‌کننده‌ی مشخصی ندارد و به سازنده‌ی بازار سقوط می‌کرد، و سازنده
  // اتفاقا حساب دمو علامت نخورده بود. برچسبِ حساب هرگز نمی‌تواند بگوید
  // «این پول از کجا آمده».
  const demo = Math.min(Math.abs(opts.demoAmount ?? 0), Math.abs(amount));
  const signedDemo = amount < 0 ? -demo : demo;

  await client.query(
    `INSERT INTO platform_revenue (kind, amount, market_id, player_id, note, demo_amount, is_demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      kind,
      round6(amount),
      opts.marketId ?? null,
      opts.playerId ?? null,
      opts.note ?? null,
      round6(signedDemo),
      // برای گزارش‌های قدیمی که هنوز بولین می‌خوانند: «کاملا دمو» یعنی هیچ
      // بخشی از این درآمد پول واقعی نبوده.
      Math.abs(demo) >= Math.abs(amount) - 1e-9,
    ]
  );
}

// خانه‌ی این دو، `revenue-kinds.ts` است (بدون ایمپورت، تا پنل ادمین هم
// بتواند بخواندش). اینجا فقط دوباره صادر می‌شوند تا مصرف‌کننده‌های سمت
// سرور مجبور به ایمپورت دوم نباشند.
export { REVENUE_LABEL } from "@/lib/revenue-kinds";
export type { RevenueKind } from "@/lib/revenue-kinds";

/**
 * تسویه‌ی یک بازار پس از پایان پنجره‌ی اعتراض.
 *
 * دو مسیر:
 *  ۱. اگر ضریب سالم است → برنده‌ها به نسبت سهم پرداخت می‌گیرند، کمیسیون
 *     برای پلتفرم می‌ماند.
 *  ۲. اگر ضریب زیر حد است یا نتیجه void اعلام شده → کل شرط‌ها بدون کسر
 *     کمیسیون برگردانده می‌شود.
 */
export async function settleIrMarket(
  marketId: number
): Promise<{ ok: boolean; paid?: number; voided?: boolean; error?: string }> {
  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const m = await client.query(
      `SELECT id, status, outcome, yes_total, no_total, settled_at
         FROM ir_markets WHERE id = $1 FOR UPDATE`,
      [marketId]
    );
    if (!m.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }
    const row = m.rows[0];
    if (row.status !== "settling") {
      await client.query("ROLLBACK");
      return { ok: false, error: "bad_status" };
    }

    // پنجره‌ی اعتراض باید تمام شده باشد
    const since = row.settled_at ? Date.now() - new Date(row.settled_at).getTime() : 0;
    if (since < DISPUTE_HOURS * 3600_000) {
      await client.query("ROLLBACK");
      return { ok: false, error: "dispute_window_open" };
    }

    // اعتراضِ رسیدگی‌نشده یعنی هنوز معلوم نیست نتیجه درست است؛ پرداخت
    // برگشت‌ناپذیر است، پس تا تعیین تکلیف اعتراض‌ها تسویه نمی‌کنیم.
    const openDisputes = await client.query(
      "SELECT count(*)::int AS n FROM ir_disputes WHERE market_id=$1 AND status='open'",
      [marketId]
    );
    if (openDisputes.rows[0].n > 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "disputes_pending" };
    }

    const yes = Number(row.yes_total);
    const no = Number(row.no_total);
    const outcome = row.outcome as "yes" | "no" | "void" | null;

    const bets = await client.query(
      `SELECT id, player_id, side, stake, demo_stake FROM ir_bets
        WHERE market_id = $1 AND status = 'open'`,
      [marketId]
    );

    // ⚠️ **قفل همه‌ی برنده‌ها، پیش از هر پرداختی.**
    //
    // `moveFunds` مقدار **مطلق** می‌نویسد، نه دلتا: می‌خواند، حساب می‌کند،
    // می‌نویسد. قراردادش این است که ردیف از قبل قفل شده باشد. اینجا نبود و
    // فقط ردیف بازار قفل می‌شد.
    //
    // سناریوی گم‌شدن پول: بازیکنی با موجودی ۱۰۰ در دو بازار برنده است و
    // هر دو هم‌زمان تسویه می‌شوند (کرونِ هم‌پوشان، یا ادمین هم‌زمان با کرون،
    // یا دو نمونه‌ی سرور). هر دو ۱۰۰ را می‌خوانند؛ یکی ۱۵۰ می‌نویسد و دیگری
    // ۱۳۰. نتیجه ۱۳۰ به‌جای ۱۸۰ — و دفترکل هر دو سطر را دارد، پس کوئری
    // سلامت بلافاصله ناصفر می‌شود.
    //
    // بدتر: مسیر شرط خودش قفل می‌زند ولی این محافظت نمی‌شد. شرطِ هم‌زمان با
    // تسویه یعنی نوشتنِ کهنه‌ی تسویه، کسر شرط را پاک می‌کرد.
    //
    // `ORDER BY id` اجباری است: بدون ترتیب ثابت، دو تسویه با مجموعه‌ی
    // مشترکِ برنده‌ها می‌توانند هم را قفل کنند.
    const playerIds = [...new Set(bets.rows.map((b) => b.player_id))].sort(
      (a, b) => a - b
    );
    if (playerIds.length) {
      await client.query(
        "SELECT id FROM players WHERE id = ANY($1) ORDER BY id FOR UPDATE",
        [playerIds]
      );
    }

    // مسیر باطل: برگشت کامل بدون کمیسیون
    if (!outcome || outcome === "void" || wouldBeVoid(yes, no, outcome)) {
      for (const b of bets.rows) {
        // برگشت کامل یعنی دقیقا همان چیزی که رفت برمی‌گردد: سهم دمو دمو
        // می‌ماند و سهم واقعی واقعی. اینجا سودی در کار نیست.
        await moveFunds(
          client,
          b.player_id,
          Number(b.stake),
          "ir_refund",
          `m${marketId}`,
          { creditDemo: Number(b.demo_stake) }
        );
        await client.query(
          "UPDATE ir_bets SET status='refunded', payout=$1 WHERE id=$2",
          [Number(b.stake), b.id]
        );
      }
      await client.query(
        "UPDATE ir_markets SET status='void', void_reason=COALESCE(void_reason,'low_odds') WHERE id=$1",
        [marketId]
      );
      await client.query("COMMIT");
      log.warn("ir.settled", {
        marketId,
        result: "void_low_odds",
        pool: yes + no,
        bets: bets.rowCount,
      });
      return { ok: true, voided: true };
    }

    // ── بازار یک‌طرفه: طرف برنده هیچ شرطی ندارد ──
    // اگر همه یک طرف بسته باشند و طرف مقابل درست دربیاید، «برنده‌ای» وجود
    // ندارد که استخر را بگیرد. بدون این شاخه، کل استخر بی‌سروصدا نصیب
    // پلتفرم می‌شد. تصمیم مالک (۲۰۲۶/۰۸/۰۸): کمیسیون کسر و باقی به همه
    // برگردانده می‌شود.
    const winnerTotal = outcome === "yes" ? yes : no;
    if (winnerTotal <= 0) {
      let kept = 0;
      let keptDemo = 0;
      for (const b of bets.rows) {
        const back = Number(b.stake) * (1 - COMMISSION);
        // کمتر از اصل برمی‌گردد، پس سودی نیست؛ سهم دمو هم به همان نسبت کم
        // می‌شود، وگرنه کمیسیون فقط از پول واقعی کسر می‌شد.
        const backDemo = Number(b.demo_stake) * (1 - COMMISSION);
        kept += Number(b.stake) - back;
        keptDemo += Number(b.demo_stake) - backDemo;
        await moveFunds(
          client,
          b.player_id,
          back,
          "ir_refund",
          `m${marketId}`,
          { creditDemo: backDemo }
        );
        await client.query(
          "UPDATE ir_bets SET status='refunded', payout=$1 WHERE id=$2",
          [back, b.id]
        );
      }
      await recordRevenue(client, "ir_commission_void", kept, {
        marketId,
        demoAmount: keptDemo,
        note: `استخر ${(yes + no).toFixed(2)}؛ هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرد`,
      });
      log.warn("ir.settled", {
        marketId,
        result: "void_no_winners",
        pool: yes + no,
        kept,
        bets: bets.rowCount,
      });
      await client.query(
        "UPDATE ir_markets SET status='void', void_reason='no_winners' WHERE id=$1",
        [marketId]
      );
      await client.query("COMMIT");
      return { ok: true, voided: true };
    }

    // مسیر عادی
    const odds = oddsFor(yes, no, outcome);
    let paid = 0;
    // دموی واردشده به استخر، و دمویی که با پرداختی‌ها بیرون رفت. تفاضلشان
    // همان بخشی از کمیسیون است که از پول دمو آمده — یعنی درآمدِ کاغذی، نه
    // پول واقعی. جمع‌کردنشان با درآمد واقعی، دفترکل را دروغ می‌کند.
    let demoIn = 0;
    let demoOut = 0;
    for (const b of bets.rows) {
      const won = b.side === outcome;
      const amt = won ? Number(b.stake) * odds : 0;
      demoIn += Number(b.demo_stake);
      if (won) {
        // ⚠️ قاعده‌ی مصوب مالک: **اصلِ پول به دمو برمی‌گردد، سود واقعی
        // می‌شود.** کاربری که با بونوس بُرد، سودش را می‌تواند برداشت کند
        // ولی خودِ بونوس هرگز از سیستم بیرون نمی‌رود.
        //
        // `min` لازم است چون ضریب می‌تواند زیر ۱ باشد (کمیسیون روی بازارِ
        // خیلی نامتوازن)؛ آن‌وقت پرداختی از اصل کمتر است و همه‌اش دمو
        // می‌ماند.
        const demoBack = Math.min(Number(b.demo_stake), amt);
        demoOut += demoBack;
        await moveFunds(
          client,
          b.player_id,
          amt,
          "ir_payout",
          `m${marketId}`,
          { creditDemo: demoBack }
        );
        paid += amt;
      }
      await client.query(
        "UPDATE ir_bets SET status=$1, payout=$2 WHERE id=$3",
        [won ? "won" : "lost", amt, b.id]
      );
    }
    // کمیسیون = آنچه از استخر به برنده‌ها نرسید. از روی همان عددی که واقعا
    // پرداخت شد حساب می‌شود، نه فرمول جدا، تا هرگز از پرداخت واقعی جدا نیفتد.
    await recordRevenue(client, "ir_commission", yes + no - paid, {
      marketId,
      demoAmount: demoIn - demoOut,
      note: `استخر ${(yes + no).toFixed(2)}؛ پرداختی ${paid.toFixed(2)}`,
    });
    await client.query("UPDATE ir_markets SET status='settled' WHERE id=$1", [
      marketId,
    ]);
    await client.query("COMMIT");
    // ⚠️ برگشت‌ناپذیرترین رویداد پلتفرم: پول واقعی از استخر بیرون رفت.
    // `commission` از روی همان پرداخت واقعی حساب می‌شود، پس این خط تنها
    // جایی است که می‌شود درآمد هر بازار را بدون کوئری دیتابیس دید.
    log.warn("ir.settled", {
      marketId,
      result: "paid",
      outcome,
      pool: yes + no,
      paid,
      commission: yes + no - paid,
      demoIn,
      demoOut,
      bets: bets.rowCount,
    });
    return { ok: true, paid };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "error";
    // ⚠️ شکستِ تسویه یعنی پول کاربران در وضعیت `settling` قفل مانده. این
    // بدترین حالت ممکن است و باید فورا دیده شود.
    log.error("ir.settle_failed", { marketId, err: msg });
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

/**
 * تسویه‌ی خودکار همه‌ی بازارهایی که آماده‌اند.
 *
 * چرا لازم است: تا پیش از این، `settleIrMarket` تنها از پنل ادمین و بازار به
 * بازار صدا زده می‌شد. یعنی تنها بخشی از پلتفرم که پول واقعی دارد، تنها بخشی
 * بود که ماشه‌ی خودکار نداشت و پول کاربر تا وقتی ادمین یادش نمی‌افتاد در
 * وضعیت settling می‌ماند.
 *
 * تعیین نتیجه (`resolve`) عمدا دستی می‌ماند — آن قضاوت انسانی است. این تابع
 * فقط بازاری را برمی‌دارد که نتیجه‌اش قبلا اعلام شده، پنجره‌ی اعتراضش تمام
 * شده، و اعتراض رسیدگی‌نشده ندارد.
 *
 * انتخاب اولیه فقط یک فیلتر ارزان است؛ تصمیم واقعی داخل `settleIrMarket` پشت
 * قفل ردیف دوباره گرفته می‌شود، پس اجرای همزمان دو کرون پرداخت دوباره نمی‌سازد.
 */
export async function settleDueIrMarkets(limit = 50): Promise<{
  checked: number;
  /** بازارهایی که مهلتشان گذشته بود و همین اجرا قفلشان کرد. */
  locked: number;
  settled: number;
  voided: number;
  paid: number;
  errors: { id: number; error: string }[];
}> {
  await ensureIrTables();
  const pool = await db();

  // ── قفل خودکار بازارهایی که مهلتشان گذشته ──────────────────
  //
  // تا امروز تنها راه `open → locked` کلیک دستی ادمین بود. نتیجه‌اش این شد
  // که بازارهایی با مهلتِ گذشته روزها `open` ماندند و پول شرکت‌کننده‌ها
  // بی‌سروصدا قفل ماند، چون تسویه هرگز شروع نمی‌شود مگر از `settling` — و
  // به `settling` هم فقط از `locked` می‌شود رسید.
  //
  // شرط‌بندی از قبل با مقایسه‌ی `closes_at` مسدود است، پس این قفل هیچ درِ
  // بازی را نمی‌بندد؛ فقط وضعیت را با واقعیت هم‌خوان می‌کند. هیچ پولی هم
  // جابه‌جا نمی‌شود — نتیجه را همچنان انسان ثبت می‌کند.
  const locked = await pool.query(
    `UPDATE ir_markets SET status='locked'
      WHERE status='open' AND closes_at < now()
      RETURNING id`
  );

  const due = await pool.query<{ id: number }>(
    `SELECT m.id FROM ir_markets m
      WHERE m.status = 'settling'
        AND m.settled_at IS NOT NULL
        AND m.settled_at < now() - ($1 || ' hours')::interval
        AND NOT EXISTS (
          SELECT 1 FROM ir_disputes d
           WHERE d.market_id = m.id AND d.status = 'open'
        )
      ORDER BY m.settled_at
      LIMIT $2`,
    [String(DISPUTE_HOURS), limit]
  );

  let settled = 0;
  let voided = 0;
  let paid = 0;
  const errors: { id: number; error: string }[] = [];

  for (const row of due.rows) {
    // هر بازار جدا؛ خطای یکی نباید بقیه را متوقف کند.
    const r = await settleIrMarket(row.id);
    if (!r.ok) {
      errors.push({ id: row.id, error: r.error ?? "error" });
      continue;
    }
    if (r.voided) voided++;
    else {
      settled++;
      paid += r.paid ?? 0;
    }
  }

  return {
    checked: due.rows.length,
    locked: locked.rowCount ?? 0,
    settled,
    voided,
    paid,
    errors,
  };
}
