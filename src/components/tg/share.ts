"use client";

import { webApp } from "@/components/tg/telegram";

// اشتراک‌گذاری از داخل مینی‌اپ.
//
// از t.me/share/url استفاده می‌شود و با openTelegramLink باز می‌شود، نه
// window.open: داخل تلگرام، لینک t.me باید توسط خود کلاینت باز شود تا
// انتخابگر مخاطب بومی بیاید. اگر با مرورگر باز شود، کاربر از اپ بیرون
// می‌افتد و به نسخه‌ی وب تلگرام می‌رسد.
//
// بیرون از تلگرام (یا کلاینت قدیمی) به Web Share API و بعد به کپی در
// کلیپ‌بورد عقب‌نشینی می‌کند، تا دکمه هیچ‌وقت بی‌اثر نباشد.

export function shareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    url
  )}&text=${encodeURIComponent(text)}`;
}

export async function shareText(text: string, url: string): Promise<void> {
  const wa = webApp();
  const link = shareUrl(url, text);

  if (wa?.openTelegramLink) {
    wa.openTelegramLink(link);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch {
      /* کاربر لغو کرد یا پشتیبانی نشد — می‌رویم سراغ کپی */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  } catch {
    window.open(link, "_blank", "noopener");
  }
}
