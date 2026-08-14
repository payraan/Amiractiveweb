import { escapeHtml, type InlineButton } from "@/lib/telegram";
import { loadProfile } from "@/lib/profile";
import { LINKS } from "@/config/site";

// ═══ منوی ربات نارمون ════════════════════════════════════════
//
// ربات پنجره‌ی کامل پلتفرم است، نه تابلوی تبلیغاتیِ سایت. پس هر چیزی که
// کاربر تلگرامی لازم دارد یا همین‌جا در چت انجام می‌شود، یا با یک لمس داخل
// **مینی‌اپ** باز می‌شود — هیچ‌وقت کاربر را به مرورگر پرت نمی‌کنیم.
//
// دو نوع دکمه داریم و تفاوتشان عمدی است:
//   • `web_app` → صفحه‌ای که در مینی‌اپ بهتر است (بازار، ترید، نمودار).
//   • `callback_data` → چیزی که خواندنش در خود چت سریع‌تر است (پروفایل،
//     کیف پول، راهنما). باز کردن یک اپ کامل برای دیدن یک عدد، کند است.
//
// ناوبری با **ویرایش همان پیام** انجام می‌شود، نه پیام تازه.

const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

/** آدرس مینی‌اپ روی یک تب مشخص. */
export function appUrl(tab?: string): string {
  if (!SITE_URL) return "";
  return tab ? `${SITE_URL}/app?tab=${tab}` : `${SITE_URL}/app`;
}

/** شناسه‌های `callback_data` منو. کوتاه، چون تلگرام ۶۴ بایت سقف دارد. */
export const MENU = {
  home: "m:home",
  wallet: "m:wallet",
  profile: "m:profile",
  support: "m:support",
  help: "m:help",
} as const;

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("fa-IR");

// ── منوی اصلی ────────────────────────────────────────────────

export function mainKeyboard(): InlineButton[][] {
  const rows: InlineButton[][] = [];
  if (SITE_URL) {
    rows.push([{ text: "🚀 اپلیکیشن نارمون", web_app: { url: appUrl() } }]);
    rows.push([
      { text: "🇮🇷 بازار ایران", web_app: { url: appUrl("markets") } },
      { text: "📈 ترید", web_app: { url: appUrl("trade") } },
    ]);
    rows.push([
      { text: "📊 نبض بازار", web_app: { url: appUrl("pulse") } },
      { text: "🏆 چالش پراپ", web_app: { url: appUrl("challenge") } },
    ]);
  }
  rows.push([
    { text: "👛 کیف پول", callback_data: MENU.wallet },
    { text: "👤 پروفایل", callback_data: MENU.profile },
  ]);
  rows.push([
    { text: "🎧 پشتیبانی", callback_data: MENU.support },
    { text: "❓ راهنما", callback_data: MENU.help },
  ]);
  return rows;
}

/** دکمه‌ی بازگشت — ته هر زیرصفحه. */
export function backRow(): InlineButton[] {
  return [{ text: "‹ منوی اصلی", callback_data: MENU.home }];
}

/**
 * پیام خوش‌آمد برای حساب متصل.
 *
 * لحن رسمی است و هیچ وعده‌ی سودی ندارد — خط قرمز محصول. چیزی که فروخته
 * می‌شود «مهارت سنجیده می‌شود» است، نه «پول دربیار».
 */
export function homeText(displayName: string | null): string {
  const hi = displayName
    ? `👋 <b>${escapeHtml(displayName)}</b> عزیز، خوش آمدید.`
    : "👋 به نارمون خوش آمدید.";
  return (
    `${hi}\n\n` +
    `<b>نارمون</b> پلتفرم فارسی هوش جمعی و بازارهای پیش‌بینی است. ` +
    `اینجا روی نتیجه‌ی رویدادهای واقعی پیش‌بینی ثبت می‌کنید و کارنامه‌تان ثبت و سنجیده می‌شود.\n\n` +
    `<b>چه چیزی در دسترس شماست</b>\n` +
    `🇮🇷 <b>بازار ایران</b> — بازارهای بله/خیر با تتر واقعی. ` +
    `ضریب را جمعیت می‌سازد، نه ما.\n` +
    `📈 <b>ترید</b> — بازارهای جهانی با امتیاز، بدون ریسک پول.\n` +
    `📊 <b>نبض بازار</b> — پیش‌بینی قیمت طلا، ارز، سهام و رمزارز.\n` +
    `🏆 <b>چالش پراپ</b> — کارنامه‌ات را بساز و واجد شرایط شو.\n` +
    `👛 <b>کیف پول</b> — واریز و برداشت تتر، همین‌جا در ربات.\n\n` +
    `<b>قاعده‌ای که تغییر نمی‌کند:</b> امتیاز فقط از مهارت می‌آید. ` +
    `نه با پول خریدنی است و نه با شانس به دست می‌آید — ` +
    `پیش‌بینی تصادفی به‌طور میانگین امتیاز منفی می‌گیرد.\n\n` +
    `از منوی زیر شروع کنید 👇`
  );
}

/** پیام خوش‌آمد برای کسی که هنوز حسابی وصل نکرده. */
export function guestText(): string {
  return (
    `🔹 <b>نارمون</b> — پلتفرم فارسی هوش جمعی و بازارهای پیش‌بینی\n\n` +
    `روی نتیجه‌ی رویدادهای واقعی پیش‌بینی ثبت کنید، بازار بسازید، ` +
    `و مهارت تحلیلی‌تان را بسنجید.\n\n` +
    `<b>امتیاز در نارمون خریدنی نیست.</b> نه با پول به دست می‌آید و نه با شانس؛ ` +
    `پیش‌بینی تصادفی به‌طور میانگین امتیاز منفی می‌گیرد.\n\n` +
    `برای شروع، اپلیکیشن را باز کنید — حسابتان همان‌جا با همین تلگرام ساخته می‌شود.`
  );
}

export function guestKeyboard(): InlineButton[][] {
  const rows: InlineButton[][] = [];
  if (SITE_URL) {
    rows.push([{ text: "🚀 باز کردن اپلیکیشن نارمون", web_app: { url: appUrl() } }]);
  }
  rows.push([{ text: "🎧 پشتیبانی", callback_data: MENU.support }]);
  return rows;
}

// ── پشتیبانی ─────────────────────────────────────────────────

export function supportText(): string {
  return (
    `🎧 <b>پشتیبانی نارمون</b>\n\n` +
    `تیم پشتیبانی هر روز پاسخگوی شماست. برای گزارش مشکل، پیگیری واریز و ` +
    `برداشت، یا هر پرسشی درباره‌ی بازارها، مستقیم پیام بدهید.\n\n` +
    `<b>پیش از پیام دادن، این‌ها را آماده داشته باشید:</b>\n` +
    `• اگر مشکل مالی است: مبلغ، تاریخ، و شناسه‌ی تراکنش\n` +
    `• اگر درباره‌ی یک بازار است: نام یا شناسه‌ی بازار\n\n` +
    `این کار پاسخ را چند برابر سریع‌تر می‌کند.`
  );
}

export function supportKeyboard(): InlineButton[][] {
  return [
    [{ text: "💬 گفت‌وگو با پشتیبانی", url: LINKS.telegramSupport }],
    [{ text: "📣 کانال نارمون", url: LINKS.telegramChannel }],
    backRow(),
  ];
}

// ── راهنما ───────────────────────────────────────────────────

export function helpText(): string {
  return (
    `❓ <b>راهنمای ربات نارمون</b>\n\n` +
    `<b>دستورها</b>\n` +
    `/start · منوی اصلی\n` +
    `/app · باز کردن اپلیکیشن\n` +
    `/wallet · کیف پول و موجودی\n` +
    `/profile · کارنامه و آمار شما\n` +
    `/support · پشتیبانی\n` +
    `/bonus · هدیه‌ی عضویت کانال\n\n` +
    `<b>پرسش‌های پرتکرار</b>\n\n` +
    `<b>امتیاز چطور محاسبه می‌شود؟</b>\n` +
    `هر پیش‌بینی به احتمالِ لحظه‌ی ثبت وزن می‌گیرد: انتخاب کم‌طرفدار پاداش ` +
    `بزرگ‌تر و خطای بزرگ‌تر دارد. میانگین حدس تصادفی منفی است.\n\n` +
    `<b>تفاوت تتر و MOON چیست؟</b>\n` +
    `تتر پول واقعی است و فقط در بازار ایران استفاده می‌شود. MOON واحد داخلی ` +
    `است و فقط قابلیت باز می‌کند؛ <b>هرگز امتیاز یا رتبه نمی‌خرد.</b>\n\n` +
    `<b>چرا باید ربات را نگه دارم؟</b>\n` +
    `هشدارهای امنیتی حساب — از جمله اعلان برداشت — فقط از همین ربات می‌آید.\n\n` +
    `<b>نارمون سود تضمین نمی‌کند</b> و هیچ‌وقت نخواهد کرد.`
  );
}

export function helpKeyboard(): InlineButton[][] {
  return [[{ text: "🎧 پشتیبانی", callback_data: MENU.support }], backRow()];
}

// ── پروفایل ──────────────────────────────────────────────────

/**
 * کارنامه‌ی کاربر در قالب چت.
 *
 * از همان `loadProfile` سایت و مینی‌اپ می‌خواند، پس اعداد هر سه سطح همیشه
 * یکی‌اند. نشان‌ها و کارنامه‌ی قابل اشتراک اینجا نمی‌آیند — آن‌ها تصویری‌اند
 * و جایشان مینی‌اپ است؛ دکمه‌اش پایین همین کارت هست.
 */
export async function profileScreen(
  playerId: number
): Promise<{ text: string; buttons: InlineButton[][] }> {
  const p = await loadProfile(playerId);
  if (!p) {
    return {
      text: "پروفایل پیدا نشد. لطفاً /start را بزنید.",
      buttons: [backRow()],
    };
  }

  const irNet = p.iran.net;
  const netTone = irNet > 0 ? "🟢 +" : irNet < 0 ? "🔴 " : "";
  const acc = p.skill.accuracy;

  const text =
    `👤 <b>${escapeHtml(p.player.displayName ?? "کاربر نارمون")}</b>\n` +
    (p.player.username ? `<code>@${escapeHtml(p.player.username)}</code>\n` : "") +
    `\n<b>دارایی</b>\n` +
    `💵 تتر: <b>$${money(p.wallet.balance)}</b>\n` +
    `🌙 MOON: <b>${num(p.player.credits)}</b>\n` +
    (p.wallet.openBets > 0
      ? `🔒 درگیر در ${num(p.wallet.openBets)} پیش‌بینی باز: $${money(p.wallet.lockedInMarkets)}\n`
      : "") +
    `\n<b>جایگاه</b>\n` +
    `⭐ امتیاز: <b>${num(p.player.totalPoints)}</b>\n` +
    `📊 بالاتر از <b>${num(p.rank.percentile)}٪</b> کاربران ` +
    `(از ${num(p.rank.totalPlayers)} نفر)\n` +
    `🔥 روزهای متوالی: <b>${num(p.player.streak)}</b>\n` +
    `\n<b>کارنامه‌ی مهارتی</b>\n` +
    `🎯 پیش‌بینی ثبت‌شده: <b>${num(p.badgeStats.totalPreds)}</b>\n` +
    (acc !== null ? `✅ دقت: <b>${num(acc)}٪</b>\n` : "") +
    `📅 روزهای فعال: <b>${num(p.skill.activeDays)}</b>\n` +
    `\n<b>بازار ایران (تتر واقعی)</b>\n` +
    `🧾 تسویه‌شده: <b>${num(p.iran.settledBets)}</b>` +
    (p.iran.winRate !== null ? ` · برد <b>${num(p.iran.winRate)}٪</b>` : "") +
    `\n💰 سود خالص: <b>${netTone}$${money(Math.abs(irNet))}</b>\n` +
    `\n<b>گردش کیف پول</b>\n` +
    `⬇️ کل واریز: $${money(p.wallet.deposited)}\n` +
    `⬆️ کل برداشت: $${money(p.wallet.withdrawn)}`;

  const buttons: InlineButton[][] = [];
  if (SITE_URL) {
    buttons.push([
      { text: "🏅 نشان‌ها و کارنامه‌ی کامل", web_app: { url: appUrl("profile") } },
    ]);
  }
  buttons.push([{ text: "👛 کیف پول", callback_data: MENU.wallet }]);
  buttons.push(backRow());
  return { text, buttons };
}
