import { escapeHtml, BOT_USERNAME, type InlineButton } from "@/lib/telegram";

// ── متن اعلان نتیجه ─────────────────────────────────────────
//
// هر سه بازی اینجا نوشته می‌شوند تا لحن و ساختارشان یکی بماند. سه فایل
// جدا یعنی روزی یکی «بردی 🎉» می‌گوید و دیگری «نتیجه اعلام شد».
//
// ── قاعده‌ی محتوا ──
// کاربر باید بدون باز کردن اپ بفهمد **چه پیش‌بینی‌ای کرده بود، نتیجه چه
// شد، و چقدر برد یا باخت**. دکمه برای دیدن جزئیات است، نه برای فهمیدن
// اصل ماجرا — پیامی که مجبورت کند کلیک کنی تا بفهمی چه شده، اعلان نیست.
//
// ⚠️ واژگان ممنوع محصول اینجا هم برقرار است: «باخت» و «بازنده» نداریم.
// نتیجه‌ی منفی با «این‌بار درست درنیامد» گفته می‌شود.

/** لینک عمیق مینی‌اپ روی یک مقصد مشخص. خالی یعنی ربات پیکربندی نشده. */
function deepLink(param: string): string {
  const bot = BOT_USERNAME.replace(/^@/, "");
  return bot ? `https://t.me/${bot}/market?startapp=${param}` : "";
}

function viewButton(param: string, label = "📊 مشاهده‌ی جزئیات"): InlineButton[][] {
  const url = deepLink(param);
  return url ? [[{ text: label, url }]] : [];
}

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fa = (n: number) => n.toLocaleString("fa-IR");
/** امتیاز با علامت — «+۱۲» و «−۸». */
const signed = (n: number) => (n > 0 ? `+${fa(n)}` : fa(n));

// ── بازار ایران ─────────────────────────────────────────────

export type IrOutcome = "won" | "lost" | "refunded";

/**
 * نتیجه‌ی یک پیش‌بینی تتری.
 *
 * ⚠️ `payout` کل مبلغ برگشتی است، نه سود. سود = پرداختی منهای مبلغ
 * پیش‌بینی، و هر دو نشان داده می‌شوند: کاربری که ۱۰ گذاشته و ۱۸ گرفته
 * باید هر دو عدد را ببیند، وگرنه «۱۸» را سود می‌فهمد.
 */
export function irSettledMessage(m: {
  marketId: number;
  question: string;
  side: "yes" | "no";
  outcome: IrOutcome;
  stake: number;
  payout: number;
  /** چرا باطل شد — فقط برای حالت برگشت. */
  voidReason?: string | null;
}): { text: string; buttons: InlineButton[][] } {
  const sideLabel = m.side === "yes" ? "بله" : "خیر";
  const net = m.payout - m.stake;

  let head: string;
  let body: string;

  if (m.outcome === "refunded") {
    head = "↩️ <b>بازار باطل شد</b>";
    body =
      `مبلغ پیش‌بینی‌ات کامل برگشت.\n\n` +
      `گزینه‌ی تو: <b>${sideLabel}</b>\n` +
      `برگشتی: <b>$${money(m.payout)}</b>` +
      (m.voidReason === "low_odds"
        ? `\n\n<i>چون تقریبا همه یک طرف را انتخاب کرده بودند، ضریب به زیر ` +
          `حداقل رسید و بازار باطل شد. در این حالت کارمزدی هم برداشته ` +
          `نمی‌شود.</i>`
        : m.voidReason === "no_winners"
          ? `\n\n<i>هیچ‌کس روی گزینه‌ی درست پیش‌بینی نکرده بود، پس مبلغ‌ها ` +
            `برگردانده شد.</i>`
          : "");
  } else if (m.outcome === "won") {
    head = "🎉 <b>درست پیش‌بینی کردی</b>";
    body =
      `گزینه‌ی تو: <b>${sideLabel}</b> ✅\n\n` +
      `مبلغ پیش‌بینی: $${money(m.stake)}\n` +
      `دریافتی: <b>$${money(m.payout)}</b>\n` +
      `سود خالص: <b>+$${money(net)}</b>`;
  } else {
    head = "📉 <b>این‌بار درست درنیامد</b>";
    body =
      `گزینه‌ی تو: <b>${sideLabel}</b>\n\n` +
      `مبلغ پیش‌بینی: $${money(m.stake)}\n` +
      `<i>نتیجه خلاف پیش‌بینی‌ات شد. بازار بعدی همین‌جاست.</i>`;
  }

  return {
    text: `${head}\n\n🔹 ${escapeHtml(m.question)}\n\n${body}`,
    buttons: viewButton(`market_${m.marketId}`, "📊 مشاهده‌ی بازار"),
  };
}

// ── ترید (پالی‌مارکت) ───────────────────────────────────────

export function tradeSettledMessage(m: {
  marketId: string;
  question: string;
  side: "yes" | "no";
  won: boolean;
  points: number;
  /** احتمال قفل‌شده در لحظه‌ی ثبت، درصد. */
  probPct: number;
}): { text: string; buttons: InlineButton[][] } {
  const sideLabel = m.side === "yes" ? "بله" : "خیر";
  const head = m.won
    ? "🎉 <b>درست پیش‌بینی کردی</b>"
    : "📉 <b>این‌بار درست درنیامد</b>";

  const text =
    `${head}\n\n` +
    `🔹 ${escapeHtml(m.question)}\n\n` +
    `گزینه‌ی تو: <b>${sideLabel}</b> ${m.won ? "✅" : ""}\n` +
    `احتمال در لحظه‌ی ثبت: ${fa(Math.round(m.probPct))}٪\n\n` +
    `امتیاز این پیش‌بینی: <b>${signed(Math.round(m.points))}</b>\n\n` +
    // ⚠️ توضیح فرمول با عددِ همین بازار، نه به‌شکل کلی: کاربر باید بفهمد
    // چرا این عدد این‌قدر شد، وگرنه امتیاز دلبخواه به نظر می‌رسد.
    `<i>${
      m.won
        ? `هرچه گزینه‌ات کم‌طرفدارتر باشد، امتیاز برد بیشتر است.`
        : `امتیاز از دست‌رفته برابر احتمالی است که در لحظه‌ی ثبت قفل شد.`
    }</i>`;

  return { text, buttons: viewButton(`trade_${m.marketId}`, "📈 مشاهده‌ی بازار") };
}

// ── نبض بازار ───────────────────────────────────────────────

export function pulseSettledMessage(m: {
  asset: string;
  assetLabel: string;
  timeframeLabel: string;
  guess: number;
  settlePrice: number;
  errorPct: number;
  points: number;
}): { text: string; buttons: InlineButton[][] } {
  const good = m.points > 0;
  const head = good
    ? "🎯 <b>پیش‌بینی دقیقی داشتی</b>"
    : "📉 <b>این‌بار فاصله زیاد بود</b>";

  // قیمت‌ها ltr می‌مانند: عدد لاتین داخل ظرف rtl، جای اجزایش عوض می‌شود.
  const num = (n: number) =>
    n >= 1000
      ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : n.toLocaleString("en-US", { maximumFractionDigits: 4 });

  const text =
    `${head}\n\n` +
    `🔹 <b>${escapeHtml(m.assetLabel)}</b> · ${escapeHtml(m.timeframeLabel)}\n\n` +
    `حدس تو: <code>${num(m.guess)}</code>\n` +
    `قیمت واقعی: <code>${num(m.settlePrice)}</code>\n` +
    `فاصله: <b>${m.errorPct.toFixed(2)}٪</b>\n\n` +
    `امتیاز این پیش‌بینی: <b>${signed(Math.round(m.points))}</b>\n\n` +
    `<i>امتیاز نبض بازار با دقتِ حدس حساب می‌شود و آستانه‌اش با نوسان همان ` +
    `دارایی مقیاس می‌خورد — پس حدس روی دارایی پرنوسان، سخت‌گیرانه‌تر ` +
    `سنجیده نمی‌شود.</i>`;

  return {
    text,
    buttons: viewButton(`pulse_${m.asset}`, "📊 مشاهده‌ی دارایی"),
  };
}
