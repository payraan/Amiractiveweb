import { NextResponse } from "next/server";
import {
  webhookSecretValid,
  consumeLinkCode,
  playerByTgUserId,
  grantGroupBonus,
  clearTelegramBlocked,
  sendTelegram,
  notifyPlayer,
  sendScreen,
  editScreen,
  editTelegram,
  answerCallback,
  escapeHtml,
  tgCall,
  type InlineButton,
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
  inviteScreen,
  channelsScreen,
  channelAskScreen,
  appUrl,
  backRow,
  keyboardCommand,
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
import { LINKS } from "@/config/site";
import { log } from "@/lib/log";
import { approveMarket, rejectMarket, lockMarket } from "@/lib/ir-moderation";
import { notifyAdminsNewChannel } from "@/lib/ir-review-notify";
import {
  isTgAdmin,
  createJob,
  startJob,
  cancelJob,
  jobStats,
  progressText,
  jobKeyboard,
  attachCard,
  kickBroadcastChain,
} from "@/lib/broadcast";
import {
  getFlow,
  setFlow,
  clearFlow,
  claimConfirmedFlow,
  setCoverFlow,
  claimCoverFlow,
  setChannelFlow,
  claimChannelFlow,
} from "@/lib/bot-flow";
import { registerChannel, reviewChannel } from "@/lib/ir-channels";
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
    /** کپشن عکس — ادمین می‌تواند دستور را همراه خود عکس بفرستد. */
    caption?: string;
    photo?: { file_id: string; file_size?: number }[];
    reply_to_message?: { photo?: { file_id: string; file_size?: number }[] };
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

// ── کاور بازار ───────────────────────────────────────────────
//
// چرا از راه ربات و نه آپلود در سایت: تلگرام فایلِ خودش را با `file_id`
// می‌شناسد و ارسال دوباره‌اش هیچ آپلودی ندارد. یعنی پخش سراسری با کاور،
// روی سرور ما صفر بار می‌گذارد. با آپلود در سایت، هم باید جایی ذخیره‌اش
// کنیم و هم تلگرام باید ده‌ها هزار بار از ما بگیردش.

/** `/start cover_<id>` — سازنده می‌خواهد کاور بگذارد. */
async function handleCoverStart(
  tg: TgUser,
  chatId: number,
  marketId: number,
  player: Player | null
) {
  if (!player || !Number.isInteger(marketId) || marketId <= 0) {
    await sendTelegram(chatId, "این لینک معتبر نیست.");
    return;
  }
  const pool = await db();
  const r = await pool.query<{ creator_id: number | null; status: string }>(
    "SELECT creator_id, status FROM ir_markets WHERE id=$1",
    [marketId]
  );
  if (!r.rowCount) {
    await sendTelegram(chatId, "این بازار پیدا نشد.");
    return;
  }
  // فقط سازنده. بدون این، هر کسی با ساختن لینک می‌توانست روی بازار دیگری
  // تصویر بگذارد.
  if (r.rows[0].creator_id !== player.id) {
    await sendTelegram(chatId, "این بازار مال شما نیست.");
    return;
  }
  // ⚠️ و فقط ادمین. کاور بدون بازبینی به پیام همگانی می‌رود؛ تا وقتی
  // بازبینی تصویر نداریم این در بسته است. همان شرطِ روت مینی‌اپ.
  if (!isTgAdmin(tg.id)) {
    await sendTelegram(
      chatId,
      "فعلا فقط تیم نارمون می‌تواند برای بازارها کاور بگذارد. بازار شما بدون کاور و کامل ارسال می‌شود."
    );
    return;
  }

  await setCoverFlow(tg.id, marketId);
  await sendTelegram(
    chatId,
    `🖼 <b>کاور بازار</b>\n\n` +
      `حالا تصویر کاور را همین‌جا بفرستید.\n\n` +
      `• نسبت <b>۱۶:۹</b> بهترین نتیجه را می‌دهد (مثلا ۱۲۸۰×۷۲۰)\n` +
      `• تصویر را به‌صورت <b>عکس</b> بفرستید، نه فایل\n` +
      `• کاور اجباری نیست، ولی بازارِ کاوردار بیشتر دیده می‌شود\n\n` +
      `<i>اگر منصرف شدید، هر دستوری بفرستید تا لغو شود.</i>`
  );
}

/**
 * عکسی که رسیده، کاور است؟ اگر بله ذخیره می‌کند و `true` می‌دهد.
 *
 * ⚠️ `claimCoverFlow` گفت‌وگو را در همان دستورِ خواندن پاک می‌کند، پس دو
 * عکسِ پشت‌سرهم دو بار روی یک بازار نمی‌نشینند.
 */
async function handleCoverPhoto(
  tg: TgUser,
  chatId: number,
  photo: { file_id: string; file_size?: number }[],
  player: Player
): Promise<boolean> {
  const marketId = await claimCoverFlow(tg.id);
  if (!marketId) return false;

  // لایه‌ی سوم. دو در بالادست بسته‌اند، ولی این آخرین جایی است که تصویر
  // واقعا روی بازار می‌نشیند — و تنها جایی که اگر روزی مسیر تازه‌ای اضافه
  // شود، باز هم از آن رد نمی‌شود.
  if (!isTgAdmin(tg.id)) {
    await sendTelegram(chatId, "فعلا فقط تیم نارمون می‌تواند کاور بگذارد.");
    return true;
  }

  // بزرگ‌ترین اندازه‌ای که تلگرام داده — آخرین عضو آرایه.
  const fileId = photo[photo.length - 1].file_id;

  const pool = await db();
  const r = await pool.query(
    "UPDATE ir_markets SET cover_file_id=$2 WHERE id=$1 AND creator_id=$3 RETURNING id",
    [marketId, fileId, player.id]
  );
  if (!r.rowCount) {
    await sendTelegram(chatId, "این بازار دیگر در دسترس نیست.");
    return true;
  }

  await sendTelegram(
    chatId,
    `✅ <b>کاور ثبت شد.</b>\n\n` +
      `⚠️ اگر این بازار را <b>قبلا</b> بوست کرده‌ای، پیامی که رفته عوض ` +
      `نمی‌شود. برای اینکه کاور در پیام همگانی دیده شود، یک بار دیگر ` +
      `بوستش کن.`
  );
  return true;
}

/**
 * لمس «تأیید» یا «رد» روی کارت بازارِ در انتظار.
 *
 * ⚠️ منطق از `lib/ir-moderation.ts` می‌آید — همان چیزی که پنل ادمین صدا
 * می‌زند. رد کردن پول برمی‌گرداند و دو پیاده‌سازی موازی روی مسیر پول یعنی
 * روزی یکی‌شان یک بررسی کمتر دارد.
 *
 * ⚠️ هر دو عمل داخل خودشان شرط `status='pending'` دارند، پس دو لمس
 * هم‌زمان (یا دو ادمین با هم) فقط یک بار اثر می‌گذارد.
 */
async function handleReviewButton(
  cbId: string,
  tg: TgUser,
  chatId: number,
  messageId: number,
  data: string
) {
  if (!isTgAdmin(tg.id)) {
    await answerCallback(cbId, "این دکمه برای شما نیست.");
    return;
  }
  // ⚠️ «بستن» پیش از تأیید/رد سنجیده می‌شود چون معنایش کاملا فرق دارد:
  // آن دو روی بازارِ **در انتظار** کار می‌کنند، این یکی روی بازارِ **باز**.
  // یک هندلر مشترک برای هر سه، دیر یا زود شرط‌ها را قاطی می‌کرد.
  const ch = /^ch:(ok|no):(\d+)$/.exec(data);
  if (ch) {
    const id = Number(ch[2]);
    const approve = ch[1] === "ok";
    await answerCallback(cbId, approve ? "در حال تأیید…" : "در حال رد کردن…");
    const r = await reviewChannel(id, approve);
    await editTelegram(
      chatId,
      messageId,
      r.ok
        ? approve
          ? `✅ <b>${escapeHtml(r.title || "کانال")} تأیید شد.</b>\n\nساخت بازار برای این حساب رایگان شد.`
          : `❌ <b>${escapeHtml(r.title || "کانال")} رد شد.</b>`
        : `⚠️ این کانال دیگر در انتظار نیست — احتمالا قبلا تعیین تکلیف شده.`
    );
    // نتیجه باید به خودِ ادمین کانال هم برسد، وگرنه منتظر می‌ماند و
    // نمی‌داند رد شده یا هنوز در صف است.
    if (r.ok) {
      await notifyPlayer(
        r.ownerId,
        approve
          ? `✅ کانال <b>${escapeHtml(r.title || "")}</b> تأیید شد.\n\n` +
              `از این پس ساخت بازار برایت <b>رایگان</b> است.`
          : `❌ ثبت کانال <b>${escapeHtml(r.title || "")}</b> تأیید نشد.`
      );
    }
    return;
  }

  const lk = /^ir:lk:(\d+)$/.exec(data);
  if (lk) {
    const id = Number(lk[1]);
    await answerCallback(cbId, "در حال بستن…");
    const r = await lockMarket(id);
    // متن پیام کامل بازنویسی نمی‌شود؛ فقط یک خط وضعیت به آن اضافه می‌شود و
    // دکمه برداشته می‌شود تا ادمین نداند «زدم یا نزدم».
    await editTelegram(
      chatId,
      messageId,
      r.ok
        ? `🔒 <b>بازار بسته شد.</b>\n\nاز این لحظه کسی پیش‌بینی تازه ثبت ` +
            `نمی‌کند. نتیجه را در پنل ادمین ثبت کن.`
        : `⚠️ این بازار دیگر باز نیست — احتمالا خودش بسته شده یا قبلا بستیش.`
    );
    return;
  }

  const m = /^ir:(ok|no):(\d+)$/.exec(data);
  if (!m) {
    await answerCallback(cbId, "");
    return;
  }
  const marketId = Number(m[2]);
  const approve = m[1] === "ok";

  await answerCallback(cbId, approve ? "در حال انتشار…" : "در حال رد کردن…");

  const r = approve
    ? await approveMarket(marketId)
    : await rejectMarket(marketId, `bot:${tg.id}`);

  const outcome = r.ok
    ? approve
      ? `✅ <b>تأیید و منتشر شد.</b>`
      : `❌ <b>رد شد.</b> کارمزد ساخت به سازنده برگشت.`
    : r.error === "not_pending"
      ? `⚠️ این بازار دیگر در انتظار نیست — احتمالا قبلا تعیین تکلیف شده.`
      : `⚠️ خطای سرور. از پنل ادمین امتحان کن.`;

  // کارت را در جا به‌روز می‌کنیم تا ادمین نداند «زدم یا نزدم».
  await editTelegram(chatId, messageId, outcome);
}

/** `/start` بدون کد: کاربر شناخته‌شده یا تازه‌وارد. */
async function handleStart(chatId: number, player: Player | null) {
  // ⚠️ صفحه‌کلید ثابت دیگر نصب نمی‌شود. تلگرام آن را فقط سوار یک پیام
  // نصب می‌کند و با پاک‌شدن آن پیام خودش هم می‌رود — پس یا یک پیام خدماتی
  // باید برای همیشه بالای چت می‌ماند، یا منو ناپدید می‌شد. آزمون روی خود
  // تلگرام همین را نشان داد.
  //
  // حالا تنها منو، همان دکمه‌های شیشه‌ای کارت خوش‌آمد است.
  //
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

/**
 * `/bonus` — هدیه‌ی عضویت گروه.
 *
 * ⚠️ عضویت **واقعا** از تلگرام پرسیده می‌شود. تا پیش از این هیچ بررسی‌ای
 * نبود و هر کسی با زدن این دستور بیست MOON می‌گرفت، حتی اگر هرگز عضو
 * نشده بود — و MOON ارز ورودی چالش است که جایزه‌اش حساب واقعی است.
 *
 * هر شاخه پیام خودش را دارد: کاربر باید بداند چرا نگرفت و چه کار کند،
 * وگرنه فقط فکر می‌کند خراب است.
 */
async function handleBonus(tg: TgUser, chatId: number, player: Player | null) {
  if (!player) {
    await sendScreen(chatId, guestScreen());
    return;
  }

  const joinRow: InlineButton[][] = [
    [{ text: "📣 عضویت در کانال", url: LINKS.telegramChannel }],
    [{ text: "🎁 گرفتن هدیه", callback_data: MENU.bonus }],
  ];

  const b = await grantGroupBonus(tg.id);
  if (b.ok) {
    await sendTelegram(
      chatId,
      `🎁 <b>${b.granted} MOON</b> به حسابت اضافه شد.\n\n` +
        `موجودی MOON: <b>${b.credits}</b>`
    );
    return;
  }

  if (b.reason === "already") {
    await sendTelegram(chatId, "این هدیه قبلا به حسابت اضافه شده است.");
    return;
  }
  if (b.reason === "not_member") {
    await sendTelegram(
      chatId,
      `📣 <b>هنوز عضو کانال نیستی.</b>\n\n` +
        `اول عضو شو، بعد همین‌جا دکمه‌ی «گرفتن هدیه» را بزن.\n\n` +
        `<i>اگر همین الان عضو شدی و باز این پیام را دیدی، چند ثانیه صبر کن ` +
        `و دوباره امتحان کن.</i>`,
      joinRow
    );
    return;
  }
  if (b.reason === "not_configured") {
    await sendTelegram(chatId, "این هدیه فعلا در دسترس نیست. کمی بعد دوباره امتحان کن.");
    return;
  }
  // unknown — تلگرام جواب روشنی نداد. عمدا هدیه نمی‌دهیم، ولی کاربر را هم
  // متهم نمی‌کنیم: ممکن است واقعا عضو باشد و مشکل از سمت ما باشد.
  await sendTelegram(
    chatId,
    "الان نتوانستم عضویتت را بررسی کنم. چند لحظه بعد دوباره امتحان کن.",
    joinRow
  );
}

async function handleMessage(
  tg: TgUser,
  chatId: number,
  text: string,
  isPrivate: boolean,
  /** عکس پیام — هم برای پخش ادمین و هم برای کاور بازار. */
  photo?: { file_id: string; file_size?: number }[]
) {
  // لمس دکمه‌ی صفحه‌کلید ثابت، یک پیام متنی معمولی است. اینجا به همان دستور
  // ترجمه می‌شود و از آن به بعد مسیرش دقیقا مسیر دستور است — نه یک شاخه‌ی
  // موازی که روزی یک بررسی کمتر داشته باشد.
  const keyed = keyboardCommand(text);
  const raw = keyed ?? text;

  const cmd = raw.trim().split(/\s+/);
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
    // عکس، پیش از ورودی برداشت سنجیده می‌شود: کاربری که منتظر کاور است
    // عدد نمی‌فرستد، عکس می‌فرستد.
    if (photo?.length && (await handleCoverPhoto(tg, chatId, photo, p))) return;
    // آدرس کانال، پیش از ورودی برداشت: کسی که منتظر ثبت کانال است عدد
    // نمی‌فرستد، یک @username می‌فرستد.
    if (text.trim() && (await handleChannelInput(tg, chatId, text, p))) return;
    // عکسی که کاور نبود، ورودی برداشت هم نیست. بدون این، کاربری که یک عکس
    // بی‌ربط می‌فرستد «مبلغ نامعتبر» می‌گیرد.
    if (!text.trim()) return;
    await handleWithdrawInput(tg, chatId, text, p);
    return;
  }

  // هندل را یک‌بار و به‌صورت مرکزی تازه می‌کنیم، نه داخل تک‌تک هندلرها.
  // اول این کار داخل هندلرها بود و نتیجه‌اش این شد که مثلا /app هندل را
  // به‌روز نمی‌کرد و مقدار قدیمی می‌ماند — دقیقا همان بیات‌شدنی که این ستون
  // برای حلش ساخته شد.
  const player = await playerByTgUserId(tg.id, tg.username);

  // هر دستوری یعنی کاربر از گفت‌وگوی نیمه‌کاره بیرون آمده.
  //
  // ⚠️ بدون این، کسی که برداشت را شروع می‌کرد و رهایش می‌کرد، تا ۱۵ دقیقه
  // یک گفت‌وگوی باز داشت؛ بعد اولین پیام بی‌ربطش — مثلا یک عدد — به‌عنوان
  // مبلغ برداشت خوانده می‌شد و او را وسط مرحله‌ی آدرس می‌انداخت.
  if (isPrivate) await clearFlow(tg.id);

  if (head === "/start") {
    if (arg.startsWith("link_")) return handleLink(tg, chatId, arg.slice(5));
    if (arg.startsWith("cover_")) {
      return handleCoverStart(tg, chatId, Number(arg.slice(6)), player);
    }
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
  // ⚠️ کیف پول و پروفایل **موجودی تتر** را نشان می‌دهند. اجرای این دستورها
  // در گروه یعنی موجودی کاربر جلوی همه. همان نگهبانی که روی دکمه‌ها هست،
  // اینجا هم لازم است — وگرنه فقط یکی از دو در بسته می‌شود.
  if ((head === "/wallet" || head === "/profile") && !isPrivate) {
    await sendTelegram(chatId, "کیف پول و پروفایل فقط در چت خصوصی با ربات باز می‌شوند.");
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
  if (head === "/broadcast") {
    await handleBroadcast(tg, chatId, text, photo);
    return;
  }
  if (head === "/invite") {
    if (!player) return needAccount(chatId);
    await sendScreen(chatId, await inviteScreen(player.id));
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
 * پیام متنی وقتی کاربر منتظرِ فرستادن آدرس کانال است.
 *
 * `true` یعنی این پیام مصرف شد و نباید به‌عنوان ورودی برداشت هم خوانده
 * شود.
 */
async function handleChannelInput(
  tg: TgUser,
  chatId: number,
  text: string,
  player: Player
): Promise<boolean> {
  if (!(await claimChannelFlow(tg.id))) return false;

  const r = await registerChannel(player.id, tg.id, text);
  if (r.ok) {
    await sendTelegram(
      chatId,
      `✅ <b>${escapeHtml(r.title || "کانال")}</b> ثبت شد.\n\n` +
        `👥 ${r.members} عضو\n\n` +
        `پس از بررسی ما، ساخت بازار برایت رایگان می‌شود. نتیجه را همین‌جا ` +
        `اطلاع می‌دهیم.`
    );
    await notifyAdminsNewChannel(r.id);
    return true;
  }

  // هر علت پیام خودش را دارد — «خطا» به کاربر نمی‌گوید چه کار کند.
  const why: Record<string, string> = {
    bad_input: "این آدرس درست نیست. چیزی مثل <code>@MyChannel</code> بفرست.",
    not_found: "چنین کانالی پیدا نشد. آدرس را دوباره بررسی کن.",
    not_a_channel: "این یک کانال یا گروه نیست.",
    not_owner: "تو در این کانال ادمین نیستی. فقط سازنده یا ادمین می‌تواند ثبتش کند.",
    bot_not_member:
      `ربات هنوز در آن کانال ادمین نیست. اول اضافه‌اش کن، بعد دوباره امتحان کن.`,
    already_registered: "این کانال قبلا ثبت شده است.",
    server_error: "خطای سرور. کمی بعد دوباره امتحان کن.",
  };
  await sendTelegram(chatId, `⚠️ ${why[r.error] ?? "ثبت انجام نشد."}`);
  return true;
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

/**
 * موجودی **قابل برداشت**، نه کل موجودی.
 *
 * عمدا `demo_balance` را جمع نمی‌کند: این عدد فقط در گفت‌وگوی برداشت به کار
 * می‌رود و اگر پول دمو را هم می‌شمرد، کاربر مبلغی می‌زد که سرور ردش می‌کند
 * و دلیلش را هم نمی‌فهمید.
 */
async function playerBalance(playerId: number): Promise<number> {
  const pool = await db();
  const r = await pool.query<{ usdt_balance: string }>(
    "SELECT usdt_balance FROM players WHERE id=$1",
    [playerId]
  );
  return Number(r.rows[0]?.usdt_balance ?? 0);
}

/**
 * `/broadcast <متن>` — فقط برای آیدی‌های داخل TG_ADMIN_IDS.
 *
 * دو راه برای عکس: دستور را کپشن خود عکس بگذار، یا روی عکسی که قبلا
 * فرستاده‌ای ریپلای کن. هر دو به یک `file_id` می‌رسند.
 *
 * ⚠️ هیچ چیز فورا فرستاده نمی‌شود. اول پیش‌نویس ساخته می‌شود و ادمین
 * دقیقا همان چیزی را که کاربران می‌بینند به‌علاوه‌ی تعداد مخاطب می‌بیند، و
 * ارسال با یک دکمه‌ی جدا شروع می‌شود. پخش به ده‌ها هزار نفر برگشت‌ناپذیر
 * است؛ یک تأیید اضافه ارزان‌ترین محافظ ممکن است.
 */
async function handleBroadcast(
  tg: TgUser,
  chatId: number,
  text: string,
  photo: { file_id: string; file_size?: number }[] | undefined
) {
  if (!isTgAdmin(tg.id)) return; // بی‌صدا — وجود دستور لو نرود

  const body = text.replace(/^\/broadcast(@\S+)?\s*/i, "").trim();
  if (!body) {
    await sendTelegram(
      chatId,
      `📣 <b>پخش سراسری</b>\n\n` +
        `متن پیام را همراه دستور بنویسید:\n` +
        `<code>/broadcast سلام، خبر تازه…</code>\n\n` +
        `<b>برای پیام همراه عکس</b>، عکس را بفرستید و همین دستور را در ` +
        `کپشنش بنویسید، یا روی عکس ریپلای کنید و دستور را بزنید.\n\n` +
        `متن با HTML ساده کار می‌کند: <code>&lt;b&gt;پررنگ&lt;/b&gt;</code>`
    );
    return;
  }

  // بزرگ‌ترین نسخه‌ی عکس؛ تلگرام آرایه را از کوچک به بزرگ می‌دهد.
  const photoId = photo?.length ? photo[photo.length - 1].file_id : null;

  const s = await createJob(tg.id, body, photoId);
  if (s.total === 0) {
    await sendTelegram(chatId, "هیچ کاربر متصلی برای ارسال وجود ندارد.");
    return;
  }

  // پیش‌نمایش دقیقا همان چیزی که کاربر می‌گیرد.
  if (photoId) {
    await tgCall("sendPhoto", {
      chat_id: chatId,
      photo: photoId,
      caption: body,
      parse_mode: "HTML",
    });
  } else {
    await sendTelegram(chatId, body);
  }
  // کارت پیشرفت را نگه می‌داریم تا تیک‌ها خودشان به‌روزش کنند.
  const card = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: progressText(s),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: jobKeyboard(s) },
  });
  if (card.ok && card.result?.message_id) {
    await attachCard(s.id, chatId, card.result.message_id);
  }
}

/** دکمه‌های پخش: `b:<go|no|st>:<id>` */
async function handleBroadcastButton(
  cbId: string,
  tg: TgUser,
  chatId: number,
  messageId: number,
  data: string
) {
  if (!isTgAdmin(tg.id)) {
    await answerCallback(cbId, "");
    return;
  }
  const [, op, idRaw] = data.split(":");
  const jobId = Number(idRaw);
  if (!Number.isInteger(jobId)) {
    await answerCallback(cbId, "");
    return;
  }

  if (op === "go") {
    await answerCallback(cbId, "ارسال شروع شد");
    await startJob(jobId);
    // زنجیره را همین‌جا راه می‌اندازیم تا ادمین منتظر کرون بعدی نماند.
    kickBroadcastChain();
  } else if (op === "no") {
    await answerCallback(cbId, "متوقف شد");
    await cancelJob(jobId);
  } else {
    await answerCallback(cbId, "");
  }

  const s = await jobStats(jobId);
  if (s) await editTelegram(chatId, messageId, progressText(s), jobKeyboard(s));
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
    // ⚠️ **ادعای اتمیک، نه «بخوان بعد پاک کن».**
    //
    // دو لمس پشت‌سرهم روی «تأیید و ارسال» — یا دو callback که تلگرام تقریبا
    // هم‌زمان می‌فرستد — هر دو گفت‌وگو را در وضعیت confirm می‌دیدند و هر دو
    // برداشت می‌ساختند. با موجودی کافی، پول دو بار بیرون می‌رفت.
    //
    // `claimConfirmedFlow` با DELETE … RETURNING فقط به یکی سطر می‌دهد؛
    // دومی `null` می‌گیرد و همان پیام «منقضی شده» را می‌بیند.
    const flow = await claimConfirmedFlow(tg.id);
    if (!flow) {
      await answerCallback(cbId, "");
      await clearFlow(tg.id);
      await editScreen(
        chatId,
        messageId,
        resultScreen(false, "این درخواست منقضی شده. از کیف پول دوباره شروع کن.")
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

  // ⚠️ هدیه پیام تازه می‌فرستد و کارت را ویرایش نمی‌کند: کاربر اینجا از
  // کانال برگشته و باید نتیجه را ببیند، نه اینکه کارتِ بالای چت بی‌صدا
  // عوض شود و او نفهمد چیزی اتفاق افتاده.
  if (action === MENU.bonus) {
    await handleBonus(tg, chatId, player);
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
  if (action === MENU.invite) {
    await editScreen(chatId, messageId, await inviteScreen(player.id));
    return;
  }
  if (action === MENU.channels) {
    await editScreen(chatId, messageId, await channelsScreen(player.id));
    return;
  }
  if (action === MENU.channelAdd) {
    await setChannelFlow(tg.id);
    await editScreen(chatId, messageId, channelAskScreen());
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
  kind: "ir" | "trade",
  marketId: string
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

  const slug = kind === "trade" ? "trade" : "market";
  const deep = SITE_URL
    ? `https://t.me/${process.env.TG_BOT_USERNAME}/market?startapp=${slug}_${marketId}_${side}`
    : "";

  // دلیلِ «چرا همین‌جا ثبت نمی‌شود» در دو اقتصاد فرق دارد و متن هم باید فرق
  // کند: در بازار ایران پای پول است، در ترید پای سهمیه‌ی روزانه و MOON.
  const why =
    kind === "ir"
      ? `برای ثبت پیش‌بینی، مبلغ آن را در اپ تأیید کنید؛ از یک دکمه نمی‌شود مبلغ گرفت و ` +
        `نمی‌خواهیم پول با یک لمس جابه‌جا شود.`
      : `پیش‌بینی را در اپ نهایی کنید. هر ثبت از سهمیه‌ی رایگان روزانه کم می‌کند، ` +
        `پس نباید با یک لمس اتفاقی خرج شود.`;

  await sendTelegram(
    tg.id,
    `گزینه‌ی <b>${label}</b> را انتخاب کردید.\n\n${why}`,
    deep ? [[{ text: `ثبت پیش‌بینی روی ${label}`, url: deep }]] : []
  );
}

export async function POST(req: Request) {
  if (!webhookSecretValid(req.headers.get("x-telegram-bot-api-secret-token"))) {
    // ⚠️ آدرس این روت عمومی است. تلاش با رمز غلط یعنی یا کسی دارد
    // می‌سنجدش، یا رمز ما و رمز تلگرام از هم جدا شده‌اند (مثلا بعد از
    // تغییر SITE_URL و ثبت نشدن دوباره‌ی وبهوک) — و آن یعنی **همه‌ی**
    // پیام‌های کاربران بی‌صدا دور ریخته می‌شوند.
    log.warn("tg.webhook_unauthorized", {
      headerPresent: Boolean(req.headers.get("x-telegram-bot-api-secret-token")),
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    log.warn("tg.webhook_bad_json", {});
    return NextResponse.json({ ok: true, ignored: "bad_json" });
  }

  const t0 = Date.now();
  // ⚠️ شناسه‌ی آپدیت را نگه می‌داریم تا اگر تلگرام یکی را دوباره فرستاد
  // (که موقع تایم‌اوت می‌فرستد) بشود در لاگ تشخیصش داد.
  const who = update.message?.from ?? update.callback_query?.from;
  const kind = update.message ? "message" : update.callback_query ? "callback" : "other";
  // ⚠️ متنِ پیام لاگ نمی‌شود — آدرس کیف پول و مبلغ برداشت از همین‌جا
  // می‌گذرند. فقط **نوعِ** کنش ثبت می‌شود: دستور یا پیشوند دکمه.
  const action = update.message?.text?.startsWith("/")
    ? update.message.text.trim().split(/\s+/)[0].toLowerCase().split("@")[0]
    : update.callback_query?.data?.split(":").slice(0, 2).join(":");

  // ⚠️ **همه‌ی مسیرها باید از یک نقطه خارج شوند.**
  //
  // مسیرهای دکمه‌ای (بازبینی بازار، پخش، کیف پول، منو) هرکدام زودتر
  // برمی‌گشتند و از لاگ خلاصه رد می‌شدند — یعنی دقیقا پرترافیک‌ترین بخش
  // ربات در مانیتورینگ نامرئی بود. حالا هر خروجی از همین‌جا می‌گذرد.
  const done = (handled = true) => {
    log.info("tg.update", {
      kind,
      action,
      handled,
      tgUserId: who?.id,
      chatType: update.message?.chat.type,
      ms: Date.now() - t0,
    });
    return NextResponse.json({ ok: true });
  };

  try {
    // هر آپدیتی از یک کاربر یعنی چت با ربات باز است، پس اگر قبلا «بلاک»
    // علامت خورده بود همین‌جا برداشته می‌شود. مسیر اصلی بازگشت همین است و
    // هیچ تماسی با تلگرام لازم ندارد.
    if (who) await clearTelegramBlocked(who.id);

    const msg = update.message;
    // دستور می‌تواند در متن پیام باشد یا در کپشن یک عکس (پخش سراسری).
    //
    // ⚠️ عکسِ **بدون** متن و کپشن هم باید برسد. تا امروز شرط فقط
    // `typeof body === "string"` بود، پس عکس تنها اصلا وارد هندلر نمی‌شد —
    // و کاور بازار، که دقیقا یک عکس بدون کپشن است، بی‌صدا دور ریخته می‌شد.
    const body = typeof msg?.text === "string" ? msg.text : msg?.caption;
    const photos = msg?.photo ?? msg?.reply_to_message?.photo;
    if (msg?.from && (typeof body === "string" || photos?.length)) {
      await handleMessage(
        msg.from,
        msg.chat.id,
        body ?? "",
        (msg.chat.type ?? "private") === "private",
        photos
      );
    }

    const cb = update.callback_query;
    if (cb?.data) {
      // بازبینی بازار — فقط ادمین‌ها. پیش از هر مسیر دیگری، چون این
      // دکمه‌ها فقط در چت خصوصیِ ادمین می‌نشینند.
      if ((cb.data.startsWith("ir:") || cb.data.startsWith("ch:")) && cb.message) {
        await handleReviewButton(
          cb.id,
          cb.from,
          cb.message.chat.id,
          cb.message.message_id,
          cb.data
        );
        return done();
      }
      if (cb.data.startsWith("b:") && cb.message) {
        await handleBroadcastButton(
          cb.id,
          cb.from,
          cb.message.chat.id,
          cb.message.message_id,
          cb.data
        );
        return done();
      }
      // ⚠️ **کیف پول و پروفایل فقط در چت خصوصی.**
      //
      // `callback_query.message.chat` فیلد `type` ندارد، پس این مسیر هرگز
      // نمی‌فهمید در گروه است. شناسه‌ی گروه و سوپرگروه در تلگرام همیشه منفی
      // است و همین تنها نشانه‌ی در دسترس است.
      //
      // دو دلیل: گفت‌وگوی برداشت نباید از گروه شروع شود، و مهم‌تر —
      // پروفایل و کیف پول **موجودی تتر** را نشان می‌دهند. یک لمس در گروه
      // یعنی موجودی کاربر جلوی همه.
      const inGroup = Boolean(cb.message && cb.message.chat.id < 0);

      const privateOnly =
        cb.data.startsWith("w:") ||
        cb.data === MENU.wallet ||
        cb.data === MENU.profile;

      if (privateOnly && inGroup) {
        await answerCallback(
          cb.id,
          "این بخش فقط در چت خصوصی با ربات باز می‌شود.",
          true
        );
        return done();
      }

      if (cb.data.startsWith("w:") && cb.message) {
        await handleWallet(
          cb.id,
          cb.from,
          cb.message.chat.id,
          cb.message.message_id,
          cb.data
        );
        return done();
      }
      if ((cb.data.startsWith("m:") || cb.data.startsWith("h:")) && cb.message) {
        await handleMenu(cb.id, cb.from, cb.message.chat.id, cb.message.message_id, cb.data);
        return done();
      }
      // `v:` بازار ایران (شناسه‌ی عددی) · `t:` بازار ترید (شناسه‌ی رشته‌ای).
      // جدا بودنشان لازم است: شناسه‌ی ۴۲ در دو اقتصاد دو بازار متفاوت است.
      const m = /^([vt]):([yn]):([A-Za-z0-9-]{1,48})$/.exec(cb.data);
      if (m && (m[1] === "t" || /^\d+$/.test(m[3]))) {
        await handleVote(
          cb.id,
          cb.from,
          m[2] === "y" ? "yes" : "no",
          m[1] === "t" ? "trade" : "ir",
          m[3]
        );
      } else {
        // دکمه‌ی ناشناخته را هم باید جواب داد، وگرنه تلگرام تا ۳۰ ثانیه
        // ساعت شنی روی دکمه نگه می‌دارد و کاربر فکر می‌کند گیر کرده.
        await answerCallback(cb.id, "");
      }
    }
  } catch (err) {
    // ⚠️ **این `catch` تا امروز کاملا خالی بود.**
    //
    // به تلگرام همچنان ۲۰۰ می‌دهیم — خطای ۵xx فقط باعث می‌شود همان آپدیت
    // بی‌پایان دوباره بیاید. ولی «نبلعیدنِ خطا» یعنی خودمان باید ببینیمش:
    // پیش از این، هر شکستی در کل لایه‌ی ربات بی‌صدا ناپدید می‌شد و تنها
    // نشانه‌اش این بود که کاربر می‌گفت «کار نکرد».
    log.error("tg.update_failed", {
      kind,
      action,
      tgUserId: who?.id,
      ms: Date.now() - t0,
      err: err instanceof Error ? err.message : "error",
    });
    return NextResponse.json({ ok: true, handled: false });
  }

  // خلاصه‌ی هر آپدیت. با `@evt:tg.update` کل ترافیک ربات دیده می‌شود و با
  // `@action:/bonus` یا `@action:w:` مسیر یک قابلیت خاص.
  return done();
}
