"use client";

import { useState } from "react";

/**
 * پرسش‌های ربات اسکلپر.
 *
 * قبلا داخل پرسش‌های متداول صفحه‌ی اصلی بود، ولی آنجا جایش نبود: صفحه‌ی اصلی
 * درباره‌ی پیش‌بینی است و ربات محصول جانبی است. اینجا کنار خود محصول نشسته.
 */
const ITEMS: { q: string; a: string }[] = [
  {
    q: "این ربات دقیقاً چه کار می‌کند؟",
    a: "یک اکسپرت (برنامه خودکار) برای متاتریدر ۵ است که روی نمادهای طلا و یورو/دلار معامله می‌کند. به‌جای اینکه ساعت‌ها پای چارت بنشینید، ربات بر اساس الگوریتم‌های دقیق و بدون دخالت احساسات، وارد بازار شده و خارج می‌شود. تمامی عملکرد آن در Myfxbook قابل بررسی است.",
  },
  {
    q: "آیا سود آن تضمینی است؟",
    a: "خیر. در بازارهای مالی هیچ سیستم معاملاتی با سود تضمین‌شده وجود ندارد. ما به‌جای وعده‌های غیرواقعی، کارنامه زنده ربات (شامل ماه‌های سودده و ضررده) را با شفافیت کامل نمایش می‌دهیم. معامله‌گری همیشه با ریسک همراه است.",
  },
  {
    q: "آیا باید دانش معامله‌گری داشته باشم؟",
    a: "برای اجرای ربات نیازی به دانش تحلیل تکنیکال ندارید. یک راهنمای نصب گام‌به‌گام به شما داده می‌شود و تیم پشتیبانی تا راه‌اندازی کامل سیستم در کنار شما خواهد بود.",
  },
  {
    q: "آیا می‌توانم پیش از خرید آن را تست کنم؟",
    a: "بله. ما یک هفته اشتراک رایگان برای استفاده روی حساب دمو ارائه می‌دهیم تا بدون هیچ‌گونه ریسک مالی، عملکرد الگوریتم را از نزدیک بررسی کنید.",
  },
  {
    q: "سرمایه اولیه چقدر باید باشد؟",
    a: "این موضوع کاملاً به میزان ریسک‌پذیری شما بستگی دارد. پس از تهیه اشتراک، پشتیبانی ما بر اساس بالانس حساب شما، بهترین تنظیمات مدیریت ریسک را پیشنهاد خواهد داد.",
  },
  {
    q: "آیا می‌توانم تنظیمات ربات را تغییر دهم؟",
    a: "بله. شما کنترل کامل بر روی حجم معاملات (Lot)، حد سود، حد ضرر و ساعات کاری ربات دارید. البته ما تنظیمات بهینه (Preset) خودمان را نیز در اختیار شما قرار می‌دهیم.",
  },
  {
    q: "ربات روی چه بروکری کار می‌کند؟",
    a: "روی تمامی بروکرهایی که از پلتفرم متاتریدر ۵ پشتیبانی می‌کنند قابل اجراست. پیشنهاد می‌شود از حساب‌های با اسپرد بسیار پایین (مثل حساب‌های ECN یا Raw Spread) استفاده کنید. در صورت استفاده از بروکر همکارِ ما، هزینه اشتراک ماهانه شما کاهش می‌یابد.",
  },
  {
    q: "چگونه خرید و فعال‌سازی کنم؟",
    a: "پرداخت از طریق تتر (USDT) انجام می‌شود. پس از واریز، کافی است به پشتیبانی تلگرام پیام دهید تا لایسنس شما صادر شده و فایل‌ها در اختیارتان قرار گیرد.",
  },
];

export default function BotFaq() {
  const [open, setOpen] = useState<string | null>(null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ITEMS.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };

  return (
    <section className="mx-auto mt-16 max-w-4xl px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="font-display text-2xl font-black md:text-3xl">
        پرسش‌های <span className="text-gold">متداول</span> ربات
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {ITEMS.map((it) => {
          const isOpen = open === it.q;
          return (
            <button
              key={it.q}
              type="button"
              onClick={() => setOpen(isOpen ? null : it.q)}
              className={`no-zoom no-lift rounded-2xl border p-5 text-start transition ${
                isOpen ? "border-gold/50 bg-surface/60" : "border-line bg-surface/30"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-bold text-cream">{it.q}</span>
                <span className="mt-0.5 shrink-0 font-mono text-gold">
                  {isOpen ? "−" : "+"}
                </span>
              </span>
              {isOpen && (
                <span className="mt-3 block text-[12px] leading-7 text-muted">
                  {it.a}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
