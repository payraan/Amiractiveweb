import { db } from "@/lib/db";
import { escapeHtml, type InlineButton, type Screen } from "@/lib/telegram";
import { ensureIrTables } from "@/lib/iran";
import { gatewayReady, USDT_NETWORK } from "@/lib/zovix";
import { depositAddressFor } from "@/lib/deposit-address";
import { MIN_WITHDRAW, withdrawAddressShapeValid } from "@/lib/wallet-rules";
import { ledgerLabel } from "@/lib/ledger-labels";

// ═══ کیف پول داخل ربات ═══════════════════════════════════════
//
// کاربر تلگرامی نباید برای دیدن موجودی یا برداشت پولش از چت بیرون برود.
// همان دیتابیس، همان دفترکل، همان منطق برداشت — فقط رابطش چت است.
//
// ⚠️ هیچ منطق پولی اینجا نوشته نشده. برداشت از `withdrawal.ts` صدا زده
// می‌شود که سایت هم همان را می‌زند؛ این فایل فقط کارت می‌سازد و ورودی
// می‌گیرد.

const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

function media(file: string) {
  return SITE_URL ? ({ kind: "photo", url: `${SITE_URL}/tg/${file}` } as const) : null;
}

export const WALLET = {
  home: "w:home",
  deposit: "w:dep",
  history: "w:hist",
  withdrawStart: "w:wd",
  withdrawConfirm: "w:ok",
  cancel: "w:x",
} as const;

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fa = (iso: string) =>
  new Date(iso).toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
  });

type Row = { amount: number; kind: string; createdAt: string };

async function walletData(playerId: number, limit: number) {
  await ensureIrTables();
  const pool = await db();
  const [me, ledger, open] = await Promise.all([
    pool.query<{ usdt_balance: string; demo_balance: string }>(
      "SELECT usdt_balance, demo_balance FROM players WHERE id=$1",
      [playerId]
    ),
    pool.query<{ amount: string; kind: string; created_at: string }>(
      `SELECT amount::text, kind, created_at FROM wallet_ledger
        WHERE player_id=$1 ORDER BY id DESC LIMIT $2`,
      [playerId, limit]
    ),
    pool.query<{ locked: string; n: string }>(
      `SELECT COALESCE(SUM(stake),0)::text AS locked, COUNT(*)::text AS n
         FROM ir_bets WHERE player_id=$1 AND status='open'`,
      [playerId]
    ),
  ]);
  return {
    balance:
      Number(me.rows[0]?.usdt_balance ?? 0) +
      Number(me.rows[0]?.demo_balance ?? 0),
    withdrawable: Number(me.rows[0]?.usdt_balance ?? 0),
    demoBalance: Number(me.rows[0]?.demo_balance ?? 0),
    locked: Number(open.rows[0]?.locked ?? 0),
    openBets: Number(open.rows[0]?.n ?? 0),
    rows: ledger.rows.map<Row>((r) => ({
      amount: Number(r.amount),
      kind: r.kind,
      createdAt: r.created_at,
    })),
  };
}

function ledgerLines(rows: Row[]): string {
  if (!rows.length) return "هنوز تراکنشی ثبت نشده است.";
  return rows
    .map((r) => {
      const sign = r.amount >= 0 ? "🟢 +" : "🔴 −";
      const label = ledgerLabel(r.kind);
      return `${sign}$${money(Math.abs(r.amount))} · ${label} · ${fa(r.createdAt)}`;
    })
    .join("\n");
}

// ── کارت اصلی کیف پول ────────────────────────────────────────

export async function walletHomeScreen(playerId: number): Promise<Screen> {
  const d = await walletData(playerId, 5);

  const buttons: InlineButton[][] = [
    [
      { text: "⬇️ واریز", callback_data: WALLET.deposit },
      { text: "⬆️ برداشت", callback_data: WALLET.withdrawStart },
    ],
    [{ text: "🧾 تاریخچه", callback_data: WALLET.history }],
    [{ text: "‹ منوی اصلی", callback_data: "m:home" }],
  ];

  return {
    media: media("wallet.jpg"),
    text:
      `👛 <b>کیف پول</b>\n\n` +
      `موجودی قابل استفاده\n<b>${money(d.balance)} تتر</b>  <i>(USDT)</i>\n` +
      // اگر بخشی هدیه است، همین‌جا گفته می‌شود نه در لحظه‌ی برداشت. کاربری
      // که عدد بزرگ می‌بیند و بعد «موجودی کافی نیست» می‌گیرد، فکر می‌کند
      // پولش را خورده‌ایم.
      (d.demoBalance > 0
        ? `شامل <b>${money(d.demoBalance)}</b> هدیه — قابل برداشت: ` +
          `<b>${money(d.withdrawable)}</b>\n`
        : "") +
      `شبکه: <b>${USDT_NETWORK}</b>\n` +
      (d.openBets > 0
        ? `\n🔒 درگیر در ${d.openBets} پیش‌بینی باز: $${money(d.locked)}\n`
        : "") +
      `\n<b>آخرین تراکنش‌ها</b>\n${ledgerLines(d.rows)}`,
    buttons,
  };
}

// ── تاریخچه ──────────────────────────────────────────────────

export async function historyScreen(playerId: number): Promise<Screen> {
  const d = await walletData(playerId, 15);
  return {
    media: media("wallet.jpg"),
    text: `🧾 <b>تاریخچه‌ی تراکنش‌ها</b>\n\n${ledgerLines(d.rows)}`,
    buttons: [[{ text: "‹ کیف پول", callback_data: WALLET.home }]],
  };
}

// ── واریز ────────────────────────────────────────────────────

export async function depositScreen(playerId: number): Promise<Screen> {
  const back: InlineButton[][] = [[{ text: "‹ کیف پول", callback_data: WALLET.home }]];

  if (!gatewayReady()) {
    return {
      media: media("wallet.jpg"),
      text: "⬇️ <b>واریز</b>\n\nدرگاه پرداخت هنوز فعال نشده است.",
      buttons: back,
    };
  }

  const r = await depositAddressFor(playerId);
  if (!r.ok) {
    return {
      media: media("wallet.jpg"),
      text:
        `⬇️ <b>واریز</b>\n\nدریافت آدرس واریز ممکن نشد. کمی بعد دوباره تلاش کنید.`,
      buttons: back,
    };
  }

  return {
    media: media("wallet.jpg"),
    text:
      `⬇️ <b>واریز تتر</b>\n\n` +
      `آدرس اختصاصی شما روی شبکه‌ی <b>${USDT_NETWORK}</b>:\n\n` +
      `<code>${escapeHtml(r.address)}</code>\n\n` +
      `<i>روی آدرس بزنید تا کپی شود.</i>\n\n` +
      `⚠️ فقط <b>تتر</b> و فقط روی <b>${USDT_NETWORK}</b> بفرستید. ` +
      `ارز دیگر یا شبکه‌ی دیگر قابل بازگشت نیست.\n\n` +
      // این بند از یک مورد واقعی آمد: انتقال «داخلی» صرافی هیچ تراکنشی روی
      // شبکه منتشر نمی‌کند، پس درگاه چیزی برای دیدن ندارد و پول هرگز
      // نمی‌رسد — در حالی که فرستنده «Completed» می‌بیند.
      `⚠️ از <b>انتقال داخلی</b> صرافی یا کیف پول استفاده نکنید؛ تراکنش باید ` +
      `روی شبکه ثبت شود، وگرنه هرگز نمی‌رسد.\n\n` +
      `این آدرس مخصوص حساب شماست و تغییر نمی‌کند. ` +
      `پس از تأیید شبکه، موجودی خودکار شارژ می‌شود.`,
    buttons: back,
  };
}

// ── برداشت ───────────────────────────────────────────────────

const cancelRow: InlineButton[] = [{ text: "✖️ انصراف", callback_data: WALLET.cancel }];

export function askAmountScreen(balance: number, error?: string): Screen {
  return {
    media: media("wallet.jpg"),
    text:
      `⬆️ <b>برداشت تتر</b>  <i>(۱ از ۳)</i>\n\n` +
      (error ? `⚠️ ${error}\n\n` : "") +
      `موجودی قابل برداشت: <b>$${money(balance)}</b>\n` +
      `حداقل برداشت: <b>${MIN_WITHDRAW} تتر</b>\n\n` +
      `<b>مبلغ را بفرستید.</b> فقط عدد، مثلا <code>25</code>`,
    buttons: [cancelRow],
  };
}

export function askAddressScreen(amount: number, error?: string): Screen {
  return {
    media: media("wallet.jpg"),
    text:
      `⬆️ <b>برداشت تتر</b>  <i>(۲ از ۳)</i>\n\n` +
      (error ? `⚠️ ${error}\n\n` : "") +
      `مبلغ: <b>$${money(amount)}</b>\n\n` +
      `<b>آدرس مقصد را بفرستید.</b>\n` +
      `آدرس تتر روی شبکه‌ی ${USDT_NETWORK} با «T» شروع می‌شود و ۳۴ کاراکتر است.\n\n` +
      `⚠️ آدرس را کپی کنید، دستی تایپ نکنید. انتقال روی بلاکچین ` +
      `برگشت‌ناپذیر است و آدرس اشتباه یعنی پول رفته.`,
    buttons: [cancelRow],
  };
}

export function confirmScreen(amount: number, address: string): Screen {
  return {
    media: media("wallet.jpg"),
    text:
      `⬆️ <b>تأیید نهایی</b>  <i>(۳ از ۳)</i>\n\n` +
      `مبلغ: <b>$${money(amount)}</b>\n` +
      `شبکه: <b>${USDT_NETWORK}</b>\n` +
      `مقصد:\n<code>${escapeHtml(address)}</code>\n\n` +
      `آدرس را یک بار دیگر با دقت بررسی کنید. ` +
      `<b>پس از تأیید، این انتقال برگشت‌ناپذیر است.</b>`,
    buttons: [
      [{ text: "✅ تأیید و ارسال", callback_data: WALLET.withdrawConfirm }],
      cancelRow,
    ],
  };
}

/** پیام فارسی هر کد خطای برداشت. */
export const WITHDRAW_ERROR: Record<string, string> = {
  gateway_off: "درگاه پرداخت فعال نیست. کمی بعد دوباره تلاش کنید.",
  amount_too_low: `حداقل برداشت ${MIN_WITHDRAW} تتر است.`,
  bad_address: "آدرس مقصد با شبکه نمی‌خواند.",
  insufficient_funds: "موجودی کافی نیست.",
  rate_limited: "درخواست‌های برداشت پیاپی زیاد بود. کمی صبر کنید.",
  server_error: "خطای سرور. کمی بعد دوباره تلاش کنید.",
  telegram_required: "برای عملیات مالی باید حساب تلگرامتان وصل باشد.",
};

export function resultScreen(ok: boolean, body: string): Screen {
  return {
    media: media("wallet.jpg"),
    text: `${ok ? "✅" : "⚠️"} <b>برداشت</b>\n\n${body}`,
    buttons: [[{ text: "‹ کیف پول", callback_data: WALLET.home }]],
  };
}

/** ورودی مبلغ کاربر — ارقام فارسی و عربی هم پذیرفته می‌شوند. */
export function parseAmount(raw: string): number {
  const fixed = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");
  return Number(fixed);
}

/** چک شکلی آدرس، پیش از رسیدن به مرحله‌ی تأیید. */
export function addressLooksValid(raw: string): boolean {
  return withdrawAddressShapeValid(raw, USDT_NETWORK);
}
