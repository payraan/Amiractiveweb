"use client";

import AuthPanel from "@/components/predict/AuthPanel";

/**
 * قاب تمام‌عرضِ «حساب بساز» برای حالت مهمان.
 *
 * قبلا هر صفحه AuthPanel را در یک ظرف max-w-md می‌گذاشت و کارت نسبت به بقیه‌ی
 * بخش‌های سایت کوچک و پرت به‌نظر می‌رسید. این کامپوننت همان فرم را در یک قاب
 * هم‌اندازه‌ی بقیه‌ی بخش‌ها می‌نشاند و فضای خالی کنارش را با دلیل‌های ثبت‌نام پر
 * می‌کند. روی موبایل دو ستون زیر هم می‌شوند.
 */
export default function AuthCallout({
  onAuthed,
  benefits,
}: {
  onAuthed: () => void;
  /** اگر ندهی، فهرست پیش‌فرض استفاده می‌شود. */
  benefits?: string[];
}) {
  const items = benefits ?? [
    "هر روز پیش‌بینی رایگان روی بازارهای واقعی",
    "امتیاز از دقت شما می‌آید، نه از شانس یا پول",
    "رقابت در لیدربورد و ورود به چلنج پراپ",
    "۱۰ MOON هدیه‌ی خوش‌آمد",
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-8">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <span className="font-mono text-[11px] tracking-[0.25em] text-gold-deep">
            START FREE
          </span>
          <h3 className="mt-3 font-display text-2xl font-black leading-snug md:text-3xl">
            برای شروع، <span className="text-gold">حساب بساز</span>
          </h3>
          <p className="mt-3 text-[13px] leading-7 text-muted">
            ثبت‌نام رایگان است و فقط چند ثانیه طول می‌کشد. برای شروع هیچ پرداختی
            لازم نیست.
          </p>

          <ul className="mt-5 flex flex-col gap-3">
            {items.map((t) => (
              <li
                key={t}
                className="flex items-start gap-2.5 text-[13px] leading-6 text-cream"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-raised/30 p-5 md:p-6">
          <AuthPanel bare onAuthed={onAuthed} />
        </div>
      </div>
    </div>
  );
}
