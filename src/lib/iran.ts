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
// واریز و برداشت اثر دارد (حداقل برداشت جدا و ۱۰ تتر است).
export const MIN_STAKE_USDT = 1;
export const MIN_ODDS = 1.05; // زیر این، بازار باطل می‌شود
export const DISPUTE_HOURS = 24; // پنجره‌ی اعتراض پس از تسویه
/** کارمزد ایجاد بازار — از کیف پول تتر. اگر بازار رد شود کامل برمی‌گردد. */
export const PROPOSE_FEE_USDT = 1;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function moveFunds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  playerId: number,
  amount: number,
  kind: string,
  ref?: string
): Promise<number> {
  const res = await client.query(
    `UPDATE players SET usdt_balance = usdt_balance + $1
      WHERE id = $2 RETURNING usdt_balance`,
    [amount, playerId]
  );
  const after = Number(res.rows[0].usdt_balance);
  if (after < 0) throw new Error("insufficient_funds");
  await client.query(
    `INSERT INTO wallet_ledger (player_id, amount, kind, ref, balance_after)
     VALUES ($1,$2,$3,$4,$5)`,
    [playerId, amount, kind, ref ?? null, after]
  );
  return after;
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
  opts: { marketId?: number; playerId?: number; note?: string } = {}
): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) return;
  // is_demo از روی خودِ حساب پرداخت‌کننده خوانده می‌شود، نه پارامتر ورودی —
  // تا هیچ مسیری نتواند فراموش کند علامت بزند. اگر بازیکن مشخص نیست (مثل
  // کمیسیون تسویه که چند نفر در آن سهیم‌اند)، از سازنده‌ی بازار حساب می‌شود.
  await client.query(
    `INSERT INTO platform_revenue (kind, amount, market_id, player_id, note, is_demo)
     VALUES ($1,$2,$3,$4,$5,
       COALESCE(
         (SELECT is_demo FROM players WHERE id = $4),
         (SELECT p.is_demo FROM ir_markets m JOIN players p ON p.id = m.creator_id WHERE m.id = $3),
         false
       ))`,
    [
      kind,
      Math.round(amount * 1e6) / 1e6,
      opts.marketId ?? null,
      opts.playerId ?? null,
      opts.note ?? null,
    ]
  );
}

export type RevenueKind =
  | "ir_propose_fee" // کارمزد ایجاد بازار
  | "ir_propose_refund" // برگشت هزینه‌ی ساخت (بازار رد شد) — منفی
  | "ir_commission" // کمیسیون تسویه‌ی عادی
  | "ir_commission_void" // کمیسیون بازار بدون برنده
  | "credit_sale"; // فروش MOON از موجودی کیف پول

export const REVENUE_LABEL: Record<RevenueKind, string> = {
  ir_propose_fee: "کارمزد ایجاد بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  ir_commission: "کمیسیون تسویه",
  ir_commission_void: "کمیسیون بازار بدون برنده",
  credit_sale: "فروش MOON",
};

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
      `SELECT id, player_id, side, stake FROM ir_bets
        WHERE market_id = $1 AND status = 'open'`,
      [marketId]
    );

    // مسیر باطل: برگشت کامل بدون کمیسیون
    if (!outcome || outcome === "void" || wouldBeVoid(yes, no, outcome)) {
      for (const b of bets.rows) {
        await moveFunds(client, b.player_id, Number(b.stake), "ir_refund", `m${marketId}`);
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
      for (const b of bets.rows) {
        const back = Number(b.stake) * (1 - COMMISSION);
        kept += Number(b.stake) - back;
        await moveFunds(client, b.player_id, back, "ir_refund", `m${marketId}`);
        await client.query(
          "UPDATE ir_bets SET status='refunded', payout=$1 WHERE id=$2",
          [back, b.id]
        );
      }
      await recordRevenue(client, "ir_commission_void", kept, {
        marketId,
        note: `استخر ${(yes + no).toFixed(2)}؛ هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرد`,
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
    for (const b of bets.rows) {
      const won = b.side === outcome;
      const amt = won ? Number(b.stake) * odds : 0;
      if (won) {
        await moveFunds(client, b.player_id, amt, "ir_payout", `m${marketId}`);
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
      note: `استخر ${(yes + no).toFixed(2)}؛ پرداختی ${paid.toFixed(2)}`,
    });
    await client.query("UPDATE ir_markets SET status='settled' WHERE id=$1", [
      marketId,
    ]);
    await client.query("COMMIT");
    return { ok: true, paid };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : "error" };
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
  settled: number;
  voided: number;
  paid: number;
  errors: { id: number; error: string }[];
}> {
  await ensureIrTables();
  const pool = await db();
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

  return { checked: due.rows.length, settled, voided, paid, errors };
}
