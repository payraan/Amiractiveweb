import { NextResponse } from "next/server";
import {
  webhookSecretValid,
  consumeLinkCode,
  playerByTgUserId,
  grantGroupBonus,
  clearTelegramBlocked,
  sendTelegram,
  editTelegram,
  answerCallback,
  escapeHtml,
} from "@/lib/telegram";
import {
  MENU,
  mainKeyboard,
  homeText,
  guestText,
  guestKeyboard,
  supportText,
  supportKeyboard,
  helpText,
  helpKeyboard,
  helpTopic,
  helpTopicKeyboard,
  profileScreen,
  appUrl,
  backRow,
} from "@/lib/bot-menu";

export const dynamic = "force-dynamic";

// ── وبهوک ربات نارمون ────────────────────────────────────────
//
// چرا وبهوک و نه long-polling: روی Railway پروسه با هر دیپلوی ری‌استارت
// می‌شود و long-polling با آن می‌جنگد. وبهوک داخل همین اپ یعنی یک دیپلوی،
// یک pool دیتابیس، و بدون هماهنگی دو سرویس.
//
// امنیت: تنها دروازه، هدر X-Telegram-Bot-Api-Secret-Token است. آدرس این
// روت عمومی است، پس بدون آن هرکسی می‌توانست آپدیت جعلی با from.id دلخواه
// بفرستد و حساب شخص دیگری را به تلگرام خودش وصل کند.
//
// قرارداد پاسخ: به تلگرام همیشه ۲۰۰ می‌دهیم مگر اینکه احراز شکست بخورد.
// خطای ۵xx باعث می‌شود تلگرام همان آپدیت را بارها دوباره بفرستد و صف را
// عقب نگه دارد — که برای خطای منطقی ما هیچ کمکی نمی‌کند.

const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

type TgUser = { id: number; username?: string; first_name?: string };
type TgUpdate = {
  message?: { chat: { id: number }; from?: TgUser; text?: string };
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    /** برای پیام‌های خیلی قدیمی نمی‌آید؛ ناوبری منو بدون آن ممکن نیست. */
    message?: { message_id: number; chat: { id: number } };
  };
};

type Player = { id: number; displayName: string };

/** `/start` بدون کد: کاربر شناخته‌شده یا تازه‌وارد. */
async function handleStart(chatId: number, player: Player | null) {
  if (player) {
    await sendTelegram(chatId, homeText(player.displayName), mainKeyboard());
    return;
  }
  // تازه‌وارد به سایت فرستاده نمی‌شود: حساب داخل خود مینی‌اپ با همین تلگرام
  // ساخته می‌شود، پس هر قدم اضافه فقط ریزش است.
  await sendTelegram(chatId, guestText(), guestKeyboard());
}

/** `/start link_<code>` — اتصال حساب سایت به این آیدی تلگرام. */
async function handleLink(tg: TgUser, chatId: number, code: string) {
  const r = await consumeLinkCode(code, tg.id, tg.username);
  if (r.ok) {
    await sendTelegram(
      chatId,
      `✅ حساب <b>${escapeHtml(r.displayName)}</b> با موفقیت به تلگرام وصل شد.\n\n` +
        `از این پس نتیجه‌ی بازارها و وضعیت حسابتان را همین‌جا دریافت می‌کنید.`,
      mainKeyboard()
    );
    return;
  }
  const reason: Record<typeof r.error, string> = {
    bad_code: "این کد معتبر نیست. از سایت یک لینک تازه دریافت کنید.",
    expired: "این کد منقضی شده است. از سایت لینک تازه دریافت کنید (اعتبار هر کد ۱۵ دقیقه است).",
    already_used: "این کد قبلا استفاده شده است. اگر حسابتان متصل نیست، لینک تازه دریافت کنید.",
    tg_taken: "این تلگرام قبلا به حساب دیگری متصل شده است. هر تلگرام فقط به یک حساب متصل می‌شود.",
  };
  await sendTelegram(chatId, `⚠️ ${reason[r.error]}`);
}

/** `/bonus` — هدیه‌ی عضویت گروه. */
async function handleBonus(tg: TgUser, chatId: number, player: Player | null) {
  if (!player) {
    await sendTelegram(chatId, "ابتدا باید حسابتان را از سایت به تلگرام متصل کنید.");
    return;
  }
  const b = await grantGroupBonus(tg.id);
  await sendTelegram(
    chatId,
    b.granted
      ? `🎁 هدیه به حسابتان اضافه شد. موجودی MOON: <b>${b.credits}</b>`
      : "این هدیه قبلا به حسابتان اضافه شده است."
  );
}

async function handleMessage(tg: TgUser, chatId: number, text: string) {
  const cmd = text.trim().split(/\s+/);
  const head = (cmd[0] ?? "").toLowerCase().split("@")[0];
  const arg = cmd[1] ?? "";

  // پیام‌های غیردستوری همین‌جا رها می‌شوند. وقتی ربات در یک گروه شلوغ
  // ادمین شود، همه‌ی گپ روزمره هم به این وبهوک می‌رسد؛ بدون این شرط، هر
  // پیام گروه یک UPDATE روی جدول players می‌زد.
  if (!head.startsWith("/")) return;

  // هندل را یک‌بار و به‌صورت مرکزی تازه می‌کنیم، نه داخل تک‌تک هندلرها.
  // اول این کار داخل هندلرها بود و نتیجه‌اش این شد که مثلا /app هندل را
  // به‌روز نمی‌کرد و مقدار قدیمی می‌ماند — دقیقا همان بیات‌شدنی که این ستون
  // برای حلش ساخته شد.
  const player = await playerByTgUserId(tg.id, tg.username);

  if (head === "/start") {
    if (arg.startsWith("link_")) return handleLink(tg, chatId, arg.slice(5));
    return handleStart(chatId, player);
  }
  if (head === "/app") {
    await sendTelegram(
      chatId,
      "🚀 <b>اپلیکیشن نارمون</b>\n\nهمه‌ی بازارها، کیف پول و کارنامه‌تان — داخل تلگرام.",
      SITE_URL
        ? [
            [{ text: "باز کردن اپلیکیشن", web_app: { url: appUrl() } }],
            backRow(),
          ]
        : [backRow()]
    );
    return;
  }
  if (head === "/wallet") {
    if (!player) return needAccount(chatId);
    await sendTelegram(
      chatId,
      "کیف پول و موجودی تتر:",
      SITE_URL ? [[{ text: "👛 کیف پول", web_app: { url: appUrl("wallet") } }]] : []
    );
    return;
  }
  if (head === "/profile") {
    if (!player) return needAccount(chatId);
    const s = await profileScreen(player.id);
    await sendTelegram(chatId, s.text, s.buttons);
    return;
  }
  if (head === "/support") {
    await sendTelegram(chatId, supportText(), supportKeyboard());
    return;
  }
  if (head === "/bonus") return handleBonus(tg, chatId, player);
  if (head === "/help") {
    await sendTelegram(chatId, helpText(), helpKeyboard());
    return;
  }

  // هر چیز دیگر: بی‌سروصدا رد می‌شود. ربات نباید به هر پیام گروه جواب بدهد.
}

/** دستوری که حساب لازم دارد، ولی کاربر هنوز وصل نیست. */
async function needAccount(chatId: number) {
  await sendTelegram(chatId, guestText(), guestKeyboard());
}

/**
 * لمس دکمه‌های منو.
 *
 * همان پیام ویرایش می‌شود تا چت کاربر بعد از ده کلیک پر از کارت مرده نشود.
 * `answerCallback` همیشه و زودتر از هر کار سنگینی زده می‌شود، وگرنه تلگرام
 * تا ۳۰ ثانیه ساعت شنی روی دکمه نگه می‌دارد و کاربر فکر می‌کند گیر کرده.
 */
async function handleMenu(
  cbId: string,
  tg: TgUser,
  chatId: number,
  messageId: number,
  action: string
) {
  await answerCallback(cbId, "");

  // موضوع‌های راهنما: `h:<key>`. حساب لازم ندارند — کسی که هنوز ثبت‌نام
  // نکرده هم باید بتواند بخواند که اینجا چه خبر است.
  if (action.startsWith("h:")) {
    const body = helpTopic(action.slice(2));
    if (body) await editTelegram(chatId, messageId, body, helpTopicKeyboard());
    return;
  }

  if (action === MENU.support) {
    await editTelegram(chatId, messageId, supportText(), supportKeyboard());
    return;
  }
  if (action === MENU.help) {
    await editTelegram(chatId, messageId, helpText(), helpKeyboard());
    return;
  }

  const player = await playerByTgUserId(tg.id, tg.username);
  if (!player) {
    await editTelegram(chatId, messageId, guestText(), guestKeyboard());
    return;
  }

  if (action === MENU.home) {
    await editTelegram(chatId, messageId, homeText(player.displayName), mainKeyboard());
    return;
  }
  if (action === MENU.profile) {
    const s = await profileScreen(player.id);
    await editTelegram(chatId, messageId, s.text, s.buttons);
    return;
  }
  if (action === MENU.wallet) {
    await editTelegram(
      chatId,
      messageId,
      "کیف پول و موجودی تتر:",
      SITE_URL
        ? [[{ text: "👛 باز کردن کیف پول", web_app: { url: appUrl("wallet") } }], backRow()]
        : [backRow()]
    );
    return;
  }
}

/**
 * لمس «بله/خیر» روی کارتی که ربات مستقیم در کانال پست کرده.
 *
 * ⚠️ اینجا هیچ پولی جابه‌جا نمی‌شود و عمدا نمی‌شود: شرط تتری مبلغ لازم دارد و
 * یک دکمه مبلغ ندارد. اگر مبلغ ثابتی فرض می‌کردیم، یک لمس اشتباه در کانال
 * پول واقعی خرج می‌کرد، بدون هیچ تأییدی. پس لمس فقط «قصد» را ثبت می‌کند و
 * تأیید مبلغ به چت خصوصی می‌رود.
 */
async function handleVote(
  cbId: string,
  tg: TgUser,
  side: "yes" | "no",
  marketId: number
) {
  const label = side === "yes" ? "بله" : "خیر";
  const player = await playerByTgUserId(tg.id, tg.username);

  if (!player) {
    await answerCallback(
      cbId,
      "برای شرکت ابتدا باید حساب بسازید. ربات را باز کنید و Start را بزنید.",
      true
    );
    return;
  }

  await answerCallback(cbId, `«${label}» انتخاب شد؛ ادامه در چت ربات`);

  const deep = SITE_URL
    ? `https://t.me/${process.env.TG_BOT_USERNAME}/market?startapp=market_${marketId}_${side}`
    : "";
  await sendTelegram(
    tg.id,
    `گزینه‌ی <b>${label}</b> را انتخاب کردید.\n\n` +
      `برای ثبت پیش‌بینی، مبلغ آن را در اپ تأیید کنید؛ از یک دکمه نمی‌شود مبلغ گرفت و ` +
      `نمی‌خواهیم پول با یک لمس جابه‌جا شود.`,
    deep ? [[{ text: `ثبت پیش‌بینی روی ${label}`, url: deep }]] : []
  );
}

export async function POST(req: Request) {
  if (!webhookSecretValid(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad_json" });
  }

  try {
    // هر آپدیتی از یک کاربر یعنی چت با ربات باز است، پس اگر قبلا «بلاک»
    // علامت خورده بود همین‌جا برداشته می‌شود. مسیر اصلی بازگشت همین است و
    // هیچ تماسی با تلگرام لازم ندارد.
    const who = update.message?.from ?? update.callback_query?.from;
    if (who) await clearTelegramBlocked(who.id);

    const msg = update.message;
    if (msg?.from && typeof msg.text === "string") {
      await handleMessage(msg.from, msg.chat.id, msg.text);
    }

    const cb = update.callback_query;
    if (cb?.data) {
      if ((cb.data.startsWith("m:") || cb.data.startsWith("h:")) && cb.message) {
        await handleMenu(cb.id, cb.from, cb.message.chat.id, cb.message.message_id, cb.data);
        return NextResponse.json({ ok: true });
      }
      const m = /^v:([yn]):(\d+)$/.exec(cb.data);
      if (m) {
        await handleVote(
          cb.id,
          cb.from,
          m[1] === "y" ? "yes" : "no",
          Number(m[2])
        );
      } else {
        // دکمه‌ی ناشناخته را هم باید جواب داد، وگرنه تلگرام تا ۳۰ ثانیه
        // ساعت شنی روی دکمه نگه می‌دارد و کاربر فکر می‌کند گیر کرده.
        await answerCallback(cb.id, "");
      }
    }
  } catch {
    // خطای ما نباید باعث شود تلگرام همان آپدیت را بی‌پایان دوباره بفرستد.
  }

  return NextResponse.json({ ok: true });
}
