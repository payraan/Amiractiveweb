import { cookies, headers } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { verifyTgSession, TG_AUTH_HEADER } from "@/lib/tg-auth";

/**
 * شناسه‌ی بازیکن جاری، از هر کدام از دو سطح که آمده باشد.
 *
 * پلتفرم دو رابط دارد و باید یک حساب داشته باشد:
 *   • سایت    → کوکی امضاشده‌ی amir_session
 *   • مینی‌اپ → توکن کوتاه‌عمر در هدر x-tg-auth
 *
 * هدف این تابع همان اصل غیرقابل‌مذاکره‌ی سند است: «یک دیتابیس، یک حساب، یک
 * کیف پول». بدون آن، مینی‌اپ ناچار بود روت‌های موازی برای شرط و کیف پول
 * داشته باشد — یعنی منطق پولی دوم، که دقیقا همان چیزی است که نباید ساخته
 * شود.
 *
 * هدر اول سنجیده می‌شود: اگر درخواستی صریحا توکن مینی‌اپ آورده، همان هویت
 * مقصود است، حتی اگر کوکی سایتِ حساب دیگری هم روی همان مرورگر نشسته باشد.
 *
 * ⚠️ پذیرفتن هدر هیچ سطح CSRF جدیدی باز نمی‌کند: حمله‌ی CSRF بر پایه‌ی این
 * است که مرورگر کوکی را خودکار می‌فرستد. هدر سفارشی را مهاجم نمی‌تواند از
 * سایت دیگری تحمیل کند، چون باید مقدار توکن را بداند.
 */
export async function currentPlayerId(): Promise<number | null> {
  const h = await headers();
  const fromMiniApp = verifyTgSession(h.get(TG_AUTH_HEADER));
  if (fromMiniApp) return fromMiniApp;

  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * کدام سطح این درخواست را فرستاده — سایت یا مینی‌اپ.
 *
 * ⚠️ چرا لازم شد: روت‌های شرط و پیش‌بینی **مشترک‌اند** (همان اصل «هیچ روت
 * اختصاصی مینی‌اپی وجود ندارد»). پس ثبت رفتار نمی‌تواند سطح را سخت‌کد کند؛
 * نسخه‌ی اولِ ابزارگذاری همین کار را کرده بود و هر پیش‌بینیِ سایت را «app»
 * می‌شمرد — یعنی دقیقا مقایسه‌ی «سایت بهتر می‌گیرد یا مینی‌اپ» را که یکی از
 * دلایل ساختن این جدول بود، غیرممکن می‌کرد.
 *
 * تشخیص با همان قاعده‌ی currentPlayerId است: هدر توکن مینی‌اپ یعنی مینی‌اپ.
 */
export async function currentSurface(): Promise<"site" | "app"> {
  const h = await headers();
  return h.get(TG_AUTH_HEADER) ? "app" : "site";
}
