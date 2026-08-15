"use client";

// دسترسی امن به SDK تلگرام.
//
// هر قابلیت در نسخه‌ی متفاوتی از کلاینت اضافه شده و کاربر ایرانی معمولا
// نسخه‌ی قدیمی‌تری دارد. پس هیچ‌جا مستقیم صدا زده نمی‌شود: همه‌چیز از این
// فایل و با optional chaining می‌گذرد تا نبودِ یک قابلیت اپ را نشکند، فقط
// آن جزئیات را بی‌اثر کند.

export type TgWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton?: {
    setText: (t: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (s: "light" | "medium" | "heavy") => void;
    notificationOccurred: (t: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function webApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/** رنگ‌های نارمون را روی پوسته‌ی خود تلگرام هم می‌نشاند. */
export function applyTheme() {
  const wa = webApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  wa.setHeaderColor?.("#0a0a0c");
  wa.setBackgroundColor?.("#0a0a0c");
  // بدون این، کشیدن انگشت به پایین وسط اسکرول، اپ را می‌بندد — حس اپ را
  // خراب می‌کند و کاربر فکر می‌کند کرش کرده.
  wa.disableVerticalSwipes?.();
}

export const haptic = {
  tap: () => webApp()?.HapticFeedback?.selectionChanged(),
  press: () => webApp()?.HapticFeedback?.impactOccurred("light"),
  success: () => webApp()?.HapticFeedback?.notificationOccurred("success"),
  error: () => webApp()?.HapticFeedback?.notificationOccurred("error"),
};

/** دکمه‌ی بازگشتِ خود تلگرام. برگرداندن تابع، آن را پاک می‌کند. */
export function showBackButton(onBack: () => void): () => void {
  const b = webApp()?.BackButton;
  if (!b) return () => {};
  b.onClick(onBack);
  b.show();
  return () => {
    b.offClick(onBack);
    b.hide();
  };
}

/**
 * آیا کلاینت کاربر MainButton دارد؟ نسخه‌های قدیمی ندارند.
 *
 * خودِ کنترل دکمه در useMainButton است، نه اینجا: ثبت هندلر و به‌روزرسانی
 * ظاهر باید از هم جدا باشند وگرنه دکمه با هر کاراکترِ تایپ دوباره ساخته
 * می‌شود و روی صفحه‌کلید بالا و پایین می‌پرد.
 */
export function hasMainButton(): boolean {
  return Boolean(webApp()?.MainButton);
}

/** لینک بیرونی را در مرورگر باز می‌کند، نه داخل قاب مینی‌اپ. */
export function openExternal(url: string) {
  const wa = webApp();
  if (wa?.openLink) wa.openLink(url);
  else window.open(url, "_blank", "noopener");
}

/**
 * لینک تلگرامی (t.me) — چت مقصد را باز می‌کند **بدون بستن مینی‌اپ**.
 *
 * ⚠️ چرا `openTelegramLink` و نه یک `<a target="_blank">` ساده: تلگرام یک
 * لینک t.me معمولی را «خروج از اپ» می‌فهمد، مینی‌اپ را می‌بندد و کاربر را
 * در چت رها می‌کند. یعنی کسی که فقط می‌خواست از پشتیبانی چیزی بپرسد،
 * جایی را که در آن بود از دست می‌داد و باید از اول باز می‌کرد.
 *
 * با این تابع، چت پشتیبانی روی مینی‌اپ باز می‌شود و بستنش کاربر را به همان
 * صفحه‌ای برمی‌گرداند که بود.
 */
export function openTelegramChat(url: string) {
  const wa = webApp();
  if (wa?.openTelegramLink) wa.openTelegramLink(url);
  else openExternal(url);
}
