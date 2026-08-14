import { NextResponse } from "next/server";
import {
  webhookSecretValid,
  consumeLinkCode,
  playerByTgUserId,
  grantGroupBonus,
  clearTelegramBlocked,
  sendTelegram,
  sendScreen,
  editScreen,
  answerCallback,
  escapeHtml,
} from "@/lib/telegram";
import {
  MENU,
  mainKeyboard,
  homeScreen,
  guestScreen,
  supportScreen,
  helpScreen,
  helpTopicScreen,
  profileScreen,
  appUrl,
  backRow,
} from "@/lib/bot-menu";
import {
  WALLET,
  walletHomeScreen,
  historyScreen,
  depositScreen,
  askAmountScreen,
  askAddressScreen,
  confirmScreen,
  resultScreen,
  parseAmount,
  addressLooksValid,
  WITHDRAW_ERROR,
} from "@/lib/bot-wallet";
import { db } from "@/lib/db";
import { getFlow, setFlow, clearFlow } from "@/lib/bot-flow";
import { requestWithdrawal } from "@/lib/withdrawal";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { MIN_WITHDRAW } from "@/lib/wallet-rules";

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
  message?: {
    chat: { id: number; type?: string };
    from?: TgUser;
    text?: string;
  };
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
  // تازه‌وارد به سایت فرستاده نمی‌شود: حساب داخل خود مینی‌اپ با همین تلگرام
  // ساخته می‌شود، پس هر قدم اضافه فقط ریزش است.
  await sendScreen(chatId, player ? homeScreen(player.displayName) : guestScreen());
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

async function handleMessage(
  tg: TgUser,
  chatId: number,
  text: string,
  isPrivate: boolean
) {
  const cmd = text.trim().split(/\s+/);
  const head = (cmd[0] ?? "").toLowerCase().split("@")[0];
  const arg = cmd[1] ?? "";

  // پیام‌های غیردستوری همین‌جا رها می‌شوند. وقتی ربات در یک گروه شلوغ
  // ادمین شود، همه‌ی گپ روزمره هم به این وبهوک می‌رسد؛ بدون این شرط، هر
  // پیام گروه یک UPDATE روی جدول players می‌زد.
  //
  // استثنا: کاربری که وسط گفت‌وگوی برداشت است، جوابش عدد یا آدرس است نه
  // دستور. `isPrivate` شرط لازم است — گفت‌وگوی پولی هرگز نباید از داخل یک
  // گروه پیش برود.
  if (!head.startsWith("/")) {
    if (!isPrivate) return;
    const p = await playerByTgUserId(tg.id, tg.username);
    if (!p) return;
    await handleWithdrawInput(tg, chatId, text, p);
    return;
  }

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
    await sendScreen(chatId, await walletHomeScreen(player.id));
    return;
  }
  if (head === "/cancel") {
    await clearFlow(tg.id);
    if (player) await sendScreen(chatId, await walletHomeScreen(player.id));
    return;
  }
  if (head === "/profile") {
    if (!player) return needAccount(chatId);
    await sendScreen(chatId, await profileScreen(player.id));
    return;
  }
  if (head === "/support") {
    await sendScreen(chatId, supportScreen());
    return;
  }
  if (head === "/bonus") return handleBonus(tg, chatId, player);
  if (head === "/help") {
    await sendScreen(chatId, helpScreen());
    return;
  }

  // هر چیز دیگر: بی‌سروصدا رد می‌شود. ربات نباید به هر پیام گروه جواب بدهد.
}

/** دستوری که حساب لازم دارد، ولی کاربر هنوز وصل نیست. */
async function needAccount(chatId: number) {
  await sendScreen(chatId, guestScreen());
}

/**
 * پیام متنی وسط گفت‌وگوی برداشت.
 *
 * کارت گفت‌وگو **ویرایش** می‌شود، نه اینکه کارت تازه بیاید: کاربر یک کارت
 * می‌بیند که مرحله‌به‌مرحله جلو می‌رود. اگر ویرایش ممکن نبود (کارت پاک شده)
 * `editScreen` خودش کارت تازه می‌فرستد و شناسه‌ی جدید ذخیره می‌شود.
 *
 * `true` یعنی این پیام مصرف شد و نباید به‌عنوان دستور هم خوانده شود.
 */
async function handleWithdrawInput(
  tg: TgUser,
  chatId: number,
  text: string,
  player: Player
): Promise<boolean> {
  const flow = await getFlow(tg.id);
  if (!flow) return false;

  const show = async (s: Awaited<ReturnType<typeof walletHomeScreen>>) => {
    if (flow.messageId) await editScreen(chatId, flow.messageId, s);
    else await sendScreen(chatId, s);
  };

  if (flow.step === "amount") {
    const amount = parseAmount(text);
    const bal = await playerBalance(player.id);
    if (!Number.isFinite(amount) || amount <= 0) {
      await show(askAmountScreen(bal, "عدد معتبر نبود. فقط رقم بفرستید."));
      return true;
    }
    if (amount < MIN_WITHDRAW) {
      await show(askAmountScreen(bal, `حداقل برداشت ${MIN_WITHDRAW} تتر است.`));
      return true;
    }
    if (amount > bal) {
      await show(askAmountScreen(bal, "بیشتر از موجودی شماست."));
      return true;
    }
    await setFlow(tg.id, { step: "address", amount, address: null });
    await show(askAddressScreen(amount));
    return true;
  }

  if (flow.step === "address") {
    const address = text.trim();
    const amount = flow.amount ?? 0;
    if (!addressLooksValid(address)) {
      await show(askAddressScreen(amount, "این آدرس با شبکه نمی‌خواند."));
      return true;
    }
    await setFlow(tg.id, { step: "confirm", amount, address });
    await show(confirmScreen(amount, address));
    return true;
  }

  // مرحله‌ی تأیید: فقط دکمه. پیام متنی اینجا نباید پول جابه‌جا کند.
  await show(confirmScreen(flow.amount ?? 0, flow.address ?? ""));
  return true;
}

async function playerBalance(playerId: number): Promise<number> {
  const pool = await db();
  const r = await pool.query<{ usdt_balance: string }>(
    "SELECT usdt_balance FROM players WHERE id=$1",
    [playerId]
  );
  return Number(r.rows[0]?.usdt_balance ?? 0);
}

/** دکمه‌های کیف پول: `w:*` */
async function handleWallet(
  cbId: string,
  tg: TgUser,
  chatId: number,
  messageId: number,
  action: string
) {
  const player = await playerByTgUserId(tg.id, tg.username);
  if (!player) {
    await answerCallback(cbId, "");
    await editScreen(chatId, messageId, guestScreen());
    return;
  }

  if (action === WALLET.home || action === WALLET.cancel) {
    await answerCallback(cbId, action === WALLET.cancel ? "لغو شد" : "");
    await clearFlow(tg.id);
    await editScreen(chatId, messageId, await walletHomeScreen(player.id));
    return;
  }
  if (action === WALLET.history) {
    await answerCallback(cbId, "");
    await editScreen(chatId, messageId, await historyScreen(player.id));
    return;
  }
  if (action === WALLET.deposit) {
    // گرفتن آدرس از درگاه چند ثانیه طول می‌کشد؛ اول ساعت شنی دکمه برداشته
    // می‌شود وگرنه کاربر فکر می‌کند گیر کرده.
    await answerCallback(cbId, "در حال دریافت آدرس…");
    await editScreen(chatId, messageId, await depositScreen(player.id));
    return;
  }
  if (action === WALLET.withdrawStart) {
    await answerCallback(cbId, "");
    await setFlow(tg.id, { step: "amount", amount: null, address: null, messageId });
    await editScreen(chatId, messageId, askAmountScreen(await playerBalance(player.id)));
    return;
  }

  if (action === WALLET.withdrawConfirm) {
    const flow = await getFlow(tg.id);
    if (!flow || flow.step !== "confirm" || !flow.amount || !flow.address) {
      await answerCallback(cbId, "");
      await clearFlow(tg.id);
      await editScreen(
        chatId,
        messageId,
        resultScreen(false, "این درخواست منقضی شده. از کیف پول دوباره شروع کنید.")
      );
      return;
    }

    // ⚠️ همان نگهبانی که روت سایت دارد. بلاک‌بودن ربات برداشت را نمی‌بندد،
    // ولی حساب بدون تلگرامِ متصل اصلا نباید به اینجا برسد.
    const linked = await requireLinkedTelegram(player.id, { evenIfBlocked: true });
    if (!linked.ok) {
      await answerCallback(cbId, "");
      await clearFlow(tg.id);
      await editScreen(
        chatId,
        messageId,
        resultScreen(false, WITHDRAW_ERROR.telegram_required)
      );
      return;
    }

    await answerCallback(cbId, "در حال ثبت…");
    await clearFlow(tg.id);
    const r = await requestWithdrawal(player.id, flow.amount, flow.address);
    await editScreen(
      chatId,
      messageId,
      r.ok
        ? resultScreen(
            true,
            `درخواست برداشت <b>$${r.amount}</b> ثبت شد.\n\n` +
              `پس از تأیید شبکه به آدرس شما واریز می‌شود. ` +
              `وضعیتش را در تاریخچه‌ی کیف پول می‌بینید.`
          )
        : resultScreen(
            false,
            WITHDRAW_ERROR[r.error] ?? `درخواست ثبت نشد: ${escapeHtml(r.error)}`
          )
    );
    return;
  }
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
    const s = helpTopicScreen(action.slice(2));
    if (s) await editScreen(chatId, messageId, s);
    return;
  }

  if (action === MENU.support) {
    await editScreen(chatId, messageId, supportScreen());
    return;
  }
  if (action === MENU.help) {
    await editScreen(chatId, messageId, helpScreen());
    return;
  }

  const player = await playerByTgUserId(tg.id, tg.username);
  if (!player) {
    await editScreen(chatId, messageId, guestScreen());
    return;
  }

  if (action === MENU.home) {
    await editScreen(chatId, messageId, homeScreen(player.displayName));
    return;
  }
  if (action === MENU.profile) {
    await editScreen(chatId, messageId, await profileScreen(player.id));
    return;
  }
  if (action === MENU.wallet) {
    await editScreen(chatId, messageId, await walletHomeScreen(player.id));
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
      await handleMessage(
        msg.from,
        msg.chat.id,
        msg.text,
        (msg.chat.type ?? "private") === "private"
      );
    }

    const cb = update.callback_query;
    if (cb?.data) {
      if (cb.data.startsWith("w:") && cb.message) {
        await handleWallet(
          cb.id,
          cb.from,
          cb.message.chat.id,
          cb.message.message_id,
          cb.data
        );
        return NextResponse.json({ ok: true });
      }
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
