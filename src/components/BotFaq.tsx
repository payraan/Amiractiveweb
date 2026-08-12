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
    a: "یک برنامه‌ی خودکار برای متاتریدر ۵ که روی طلا و یورودلار معامله می‌کند. به‌جای اینکه خودت پشت نمودار بنشینی، ربات طبق قواعد از پیش تعریف‌شده و بدون احساسات وارد و خارج می‌شود. همه‌ی عملکردش روی حساب واقعی و در Myfxbook قابل بررسی است.",
  },
  {
    q: "سودش تضمینی است؟",
    a: "نه. هیچ سیستم معاملاتی سود تضمینی ندارد و هرکس چنین ادعایی کند صادق نیست. ما به‌جای وعده، کارنامه‌ی زنده و مستقل نشان می‌دهیم، با ماه‌های منفی‌اش. معامله در بازارهای مالی می‌تواند به از دست رفتن کل سرمایه منجر شود.",
  },
  {
    q: "باید چیزی از معامله‌گری بدانم؟",
    a: "نه. راهنمای نصب قدم‌به‌قدم دریافت می‌کنید و پشتیبانی تلگرام تا راه‌اندازی کامل همراه شماست. فقط به یک حساب متاتریدر ۵ نیاز دارید.",
  },
  {
    q: "قبل از خرید می‌توانم تستش کنم؟",
    a: "بله. یک هفته رایگان روی حساب دمو، بدون هیچ ریسکی، خودت عملکردش را می‌سنجی. برای فعال‌سازی به پشتیبانی تلگرام پیام بده.",
  },
  {
    q: "با چقدر سرمایه شروع کنم؟",
    a: "به پلن و میزان ریسک‌پذیری‌ات بستگی دارد. پشتیبانی بر اساس سرمایه و هدفت، تنظیمات و نوع حساب مناسب را پیشنهاد می‌دهد.",
  },
  {
    q: "می‌توانم تنظیماتش را عوض کنم؟",
    a: "بله. حجم معامله، سطح ریسک، حد ضرر و حد سود و ساعات معامله دست خودت است. تنظیمات پیشنهادی ما همان چیزی است که روی حساب زنده استفاده می‌شود.",
  },
  {
    q: "روی چه بروکری کار می‌کند؟",
    a: "روی هر بروکر متاتریدر ۵. بروکرهایی با اسپرد کم و اجرای سریع نتیجه‌ی بهتری می‌دهند. اگر از طریق بروکر معرفی ما ثبت‌نام کنی، اشتراک ماهانه ارزان‌تر تمام می‌شود.",
  },
  {
    q: "چطور بخرم و فعالش کنم؟",
    a: "پرداخت با تتر انجام می‌شود؛ بعد پشتیبانی تلگرام لایسنست را فعال می‌کند و در نصب همراهت است. معمولاً همان روز کامل می‌شود.",
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
