import { log } from "@/lib/log";
import { NextResponse } from "next/server";
import { settleDueRounds } from "@/lib/settle";
import { settlePolyDue } from "@/lib/poly";
import { settleCombosDue } from "@/lib/combos";
import { refreshMarketPosts } from "@/lib/ir-posts";
import { refreshTradePosts } from "@/lib/trade-posts";
import { reconcileWithdrawals } from "@/lib/withdrawal-sync";
import { reconcileDeposits } from "@/lib/deposit-sync";
import { settleDueIrMarkets } from "@/lib/iran";
import { remindClosingMarkets } from "@/lib/ir-close-notify";
import { runBroadcastTick } from "@/lib/broadcast";
import { translatePending } from "@/lib/translate";

export const dynamic = "force-dynamic";

// Protected settlement trigger. Call with header  x-settle-key: <SETTLE_KEY>
// (set SETTLE_KEY in Railway variables). Also runnable from a cron service.
export async function POST(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // هر سه بازی تسویه می‌شوند. قبلا فقط نبض بازار اینجا بود، پس ترید پیش‌بینی و کمبو
  // حتی با کرون هم تسویه نمی‌شدند و فقط به بازدید صفحه وابسته بودند.
  // هر بخش جدا هندل می‌شود تا خطای یکی بقیه را متوقف نکند.
  const t0 = Date.now();
  const out: Record<string, unknown> = {};
  try {
    out.pulse = await settleDueRounds();
  } catch (err) {
    out.pulseError = err instanceof Error ? err.message : "error";
  }
  try {
    out.arena = await settlePolyDue();
  } catch (err) {
    out.arenaError = err instanceof Error ? err.message : "error";
  }
  try {
    out.combos = await settleCombosDue();
  } catch (err) {
    out.combosError = err instanceof Error ? err.message : "error";
  }

  // بازار ایران — تنها بخش با پول واقعی، و تا پیش از این تنها بخشی که
  // اینجا نبود. بدون این، بازارِ نتیجه‌اعلام‌شده تا کلیک دستی ادمین در
  // وضعیت settling می‌ماند و پول کاربر قفل می‌شود.
  try {
    out.iran = await settleDueIrMarkets();
  } catch (err) {
    out.iranError = err instanceof Error ? err.message : "error";
  }

  // یادآوری پیش از بسته‌شدن. عمدا **پس از** تسویه می‌آید: اگر بازاری همین
  // تیک بسته و تسویه شد، دیگر نباید برایش «۲۴ ساعت مانده» برود.
  try {
    out.closing = await remindClosingMarkets();
  } catch (err) {
    out.closingError = err instanceof Error ? err.message : "error";
  }

  // کارت‌های منتشرشده در کانال هم روی همین کرون تازه می‌شوند — یک زمان‌بند
  // کمتر برای نگهداری، و همان بازه‌ای که تسویه دارد برای درصدها هم کافی است.
  try {
    out.posts = await refreshMarketPosts();
  } catch (err) {
    out.postsError = err instanceof Error ? err.message : "error";
  }
  try {
    out.tradePosts = await refreshTradePosts();
  } catch (err) {
    out.tradePostsError = err instanceof Error ? err.message : "error";
  }

  // آشتی برداشت‌ها با درگاه. بدون این، برداشتی که درگاه بعدا ردش کند پول
  // کاربر را برای همیشه کسرشده نگه می‌دارد — هیچ‌جای دیگری دوباره نمی‌پرسد.
  try {
    out.withdrawals = await reconcileWithdrawals();
  } catch (err) {
    out.withdrawalsError = err instanceof Error ? err.message : "error";
  }

  // آشتی واریزها. وبهوک درگاه در پلن رایگان قفل است، پس این **تنها** مسیری
  // است که پول واقعی وارد حساب کاربر می‌شود. پیش از این هیچ واریزی به هیچ
  // حسابی نمی‌نشست: پول به استخر پروژه می‌رسید و سیستم بی‌خبر می‌ماند.
  try {
    out.deposits = await reconcileDeposits();
  } catch (err) {
    out.depositsError = err instanceof Error ? err.message : "error";
  }

  // صف ترجمه‌ی عنوان بازارهای خارجی. بدون کلید بی‌هزینه رد می‌شود.
  try {
    out.translate = await translatePending(6);
  } catch (err) {
    out.translateError = err instanceof Error ? err.message : "error";
  }

  // تور ایمنی پخش سراسری. پخش خودش را زنجیر می‌کند و به این کرون وابسته
  // نیست، ولی اگر پروسه وسط زنجیره ری‌استارت شود (هر دیپلوی) زنجیره پاره
  // می‌شود. این تیک دوباره راهش می‌اندازد. اگر کاری نباشد بی‌هزینه است.
  try {
    out.broadcast = await runBroadcastTick(10_000);
  } catch (err) {
    out.broadcastError = err instanceof Error ? err.message : "error";
  }

  // ⚠️ خلاصه‌ی هر تیک لاگ می‌شود، حتی وقتی همه‌چیز صفر است. لاگِ «هیچ
  // اتفاقی نیفتاد» هم داده است: نبودنش یعنی کرون اصلا اجرا نشده، و آن
  // خرابیِ خاموشی است که تا هفته‌ها معلوم نمی‌شود.
  const errored = Object.keys(out).filter((k) => k.endsWith("Error"));
  log.info("cron.tick", {
    ms: Date.now() - t0,
    errors: errored.length ? errored : undefined,
    ...out,
  });

  try {
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
