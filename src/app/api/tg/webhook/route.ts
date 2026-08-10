import { NextResponse } from "next/server";
import {
  webhookSecretValid,
  consumeLinkCode,
  playerByTgUserId,
  grantGroupBonus,
  sendTelegram,
  answerCallback,
  type InlineButton,
} from "@/lib/telegram";

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
  callback_query?: { id: string; from: TgUser; data?: string };
};

function siteButtons(): InlineButton[][] {
  if (!SITE_URL) return [];
  return [
    [{ text: "🇮🇷 بازار ایران", url: `${SITE_URL}/iran` }],
    [
      { text: "📈 ترید", url: `${SITE_URL}/trade` },
      { text: "👛 کیف پول", url: `${SITE_URL}/wallet` },
    ],
  ];
}

type Player = { id: number; displayName: string };

/** `/start` بدون کد: کاربر شناخته‌شده یا تازه‌وارد. */
async function handleStart(chatId: number, player: Player | null) {
  if (player) {
    await sendTelegram(
      chatId,
      `<b>${player.displayName}</b> عزیز، خوش برگشتی 👋\n\n` +
        `حسابت به تلگرام وصل است. از دکمه‌های زیر وارد شو.`,
      siteButtons()
    );
    return;
  }
  await sendTelegram(
    chatId,
    `به <b>نارمون</b> خوش آمدی 👋\n\n` +
      `اینجا روی نتیجه‌ی رویدادهای واقعی پیش‌بینی ثبت می‌کنی و درستی ` +
      `پیش‌بینی‌هایت اندازه‌گیری می‌شود. امتیاز فقط از مهارت می‌آید.\n\n` +
      `هنوز حسابی به این تلگرام وصل نیست. از سایت وارد شو و در صفحه‌ی ` +
      `دعوت، تلگرامت را وصل کن.`,
    SITE_URL ? [[{ text: "ورود به نارمون", url: `${SITE_URL}/login` }]] : []
  );
}

/** `/start link_<code>` — اتصال حساب سایت به این آیدی تلگرام. */
async function handleLink(tg: TgUser, chatId: number, code: string) {
  const r = await consumeLinkCode(code, tg.id, tg.username);
  if (r.ok) {
    await sendTelegram(
      chatId,
      `✅ حساب <b>${r.displayName}</b> با موفقیت به تلگرام وصل شد.\n\n` +
        `از این به بعد نتیجه‌ی بازارها و وضعیت حسابت را همین‌جا می‌گیری.`,
      siteButtons()
    );
    return;
  }
  const reason: Record<typeof r.error, string> = {
    bad_code: "این کد معتبر نیست. از سایت یک لینک تازه بگیر.",
    expired: "این کد منقضی شده. از سایت لینک تازه بگیر (اعتبار هر کد ۱۵ دقیقه است).",
    already_used: "این کد قبلا استفاده شده. اگر حسابت وصل نیست، لینک تازه بگیر.",
    tg_taken: "این تلگرام قبلا به حساب دیگری وصل شده. هر تلگرام فقط به یک حساب وصل می‌شود.",
  };
  await sendTelegram(chatId, `⚠️ ${reason[r.error]}`);
}

/** `/bonus` — هدیه‌ی عضویت گروه. */
async function handleBonus(tg: TgUser, chatId: number, player: Player | null) {
  if (!player) {
    await sendTelegram(chatId, "اول باید حسابت را از سایت به تلگرام وصل کنی.");
    return;
  }
  const b = await grantGroupBonus(tg.id);
  await sendTelegram(
    chatId,
    b.granted
      ? `🎁 هدیه به حسابت اضافه شد. موجودی MOON: <b>${b.credits}</b>`
      : "این هدیه قبلا به حسابت اضافه شده است."
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
    await sendTelegram(chatId, "بازارهای نارمون:", siteButtons());
    return;
  }
  if (head === "/wallet") {
    await sendTelegram(
      chatId,
      "کیف پول و موجودی تتر:",
      SITE_URL ? [[{ text: "👛 کیف پول", url: `${SITE_URL}/wallet` }]] : []
    );
    return;
  }
  if (head === "/bonus") return handleBonus(tg, chatId, player);
  if (head === "/help") {
    await sendTelegram(
      chatId,
      `<b>راهنما</b>\n\n` +
        `/start — شروع و اتصال حساب\n` +
        `/app — بازارهای پیش‌بینی\n` +
        `/wallet — کیف پول\n` +
        `/bonus — هدیه‌ی عضویت گروه\n\n` +
        `نارمون سود تضمین نمی‌کند. امتیاز از مهارت می‌آید، نه شانس.`
    );
    return;
  }

  // هر چیز دیگر: بی‌سروصدا رد می‌شود. ربات نباید به هر پیام گروه جواب بدهد.
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
      "برای شرکت اول باید حساب بسازی. ربات را باز کن و Start بزن.",
      true
    );
    return;
  }

  await answerCallback(cbId, `«${label}» انتخاب شد — ادامه در چت ربات`);

  const deep = SITE_URL
    ? `https://t.me/${process.env.TG_BOT_USERNAME}/market?startapp=market_${marketId}_${side}`
    : "";
  await sendTelegram(
    tg.id,
    `طرف <b>${label}</b> را انتخاب کردی.\n\n` +
      `برای ثبت شرط، مبلغش را در اپ تأیید کن — از یک دکمه نمی‌شود مبلغ گرفت و ` +
      `نمی‌خواهیم پول با یک لمس جابه‌جا شود.`,
    deep ? [[{ text: `ثبت شرط روی ${label}`, url: deep }]] : []
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
    const msg = update.message;
    if (msg?.from && typeof msg.text === "string") {
      await handleMessage(msg.from, msg.chat.id, msg.text);
    }

    const cb = update.callback_query;
    if (cb?.data) {
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
