"use client";

import { useEffect, useRef } from "react";
import { webApp } from "@/components/tg/telegram";

/**
 * دکمه‌ی اصلی تلگرام، بدون پرش هنگام تایپ.
 *
 * نسخه‌ی قبلی یک افکت واحد بود که به onClick وابسته بود، و onClick با هر
 * کاراکترِ فرم عوض می‌شد. نتیجه: با هر کلید، دکمه hide و دوباره show می‌شد و
 * روی صفحه‌کلید بالا و پایین می‌پرید.
 *
 * حالا سه چیز از هم جدا شده‌اند:
 *   • ثبت onClick فقط یک بار، با یک wrapper ثابت که آخرین تابع را از ref
 *     می‌خواند — پس تغییر onClick هیچ‌وقت دکمه را دوباره نمی‌سازد.
 *   • show/hide فقط وقتی visible عوض شود.
 *   • متن و فعال/غیرفعال در افکت جدا، که فقط همان‌ها را به‌روز می‌کند.
 */
export function useMainButton(opts: {
  visible: boolean;
  text: string;
  enabled: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  const { visible, text, enabled, busy = false, onClick } = opts;

  // نوشتن روی ref در بدنه‌ی رندر مجاز نیست؛ در افکت به‌روز می‌شود. مقدار
  // اولیه از useRef می‌آید، پس در همان اولین رندر هم تابع درست را دارد.
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  }, [onClick]);

  // ثبت یک‌باره‌ی هندلر و نمایش/پنهان‌سازی
  useEffect(() => {
    const b = webApp()?.MainButton;
    if (!b || !visible) return;
    const handler = () => latest.current();
    b.onClick(handler);
    b.show();
    return () => {
      b.offClick(handler);
      b.hide();
      b.hideProgress();
    };
  }, [visible]);

  // به‌روزرسانی ظاهر — بدون دست‌زدن به ثبت هندلر
  useEffect(() => {
    const b = webApp()?.MainButton;
    if (!b || !visible) return;
    b.setText(text);
    if (enabled) b.enable();
    else b.disable();
    if (busy) b.showProgress(true);
    else b.hideProgress();
  }, [visible, text, enabled, busy]);
}
