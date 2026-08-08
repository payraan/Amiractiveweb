"use client";

import { useState } from "react";

/**
 * دکمه‌های اشتراک‌گذاری بازار.
 *
 * navigator.share روی موبایل شیت بومی سیستم را باز می‌کند (تلگرام، واتساپ…)
 * و روی دسکتاپ معمولا وجود ندارد، پس همان‌جا به کپی‌کردن لینک برمی‌گردیم.
 */
export default function ShareLink({
  id,
  question,
  yesPct,
}: {
  id: number;
  question: string;
  yesPct: number;
}) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/iran/m/${id}`
      : `/iran/m/${id}`;
  const text = `${question}\n\nاجماع بازار نارمون: بله ${yesPct}٪ — نظر تو چیست؟`;

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: question, text, url });
        return;
      } catch {
        /* کاربر لغو کرد یا مرورگر اجازه نداد — می‌افتیم روی کپی */
      }
    }
    copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={share}
        className="no-zoom flex-1 rounded-xl border border-gold/40 py-2.5 text-center text-[12px] font-bold text-gold transition hover:bg-gold hover:text-ink"
      >
        {copied ? "لینک کپی شد ✓" : "اشتراک‌گذاری"}
      </button>
      <a
        href={tg}
        target="_blank"
        rel="noopener noreferrer"
        className="no-zoom flex-1 rounded-xl border border-line py-2.5 text-center text-[12px] font-bold text-cream transition hover:border-gold hover:text-gold"
      >
        ارسال در تلگرام
      </a>
    </div>
  );
}
