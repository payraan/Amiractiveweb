"use client";

import { useState } from "react";

const SUPPORT = "https://t.me/Amiractive_support";

const TERMS: { title: string; body: string }[] = [
  {
    title: "ماهیت مهارتی بازی‌ها",
    body: "آرنای پیش‌بینی و نبض بازار، رقابت‌های مهارتی‌اند، نه شرط‌بندی. امتیاز با پول خرید و فروش نمی‌شود، هیچ بازپرداخت نقدی به ازای امتیاز وجود ندارد و جوایز صرفاً بر اساس رتبه و عملکرد مهارتی، پس از بررسی انسانی پشتیبانی اعطا می‌شوند.",
  },
  {
    title: "کردیت",
    body: "کردیت تنها قابلیت‌های بازی (تایم‌فریم کوتاه‌تر، پیش‌بینی بیشتر، ورود به چلنج) را باز می‌کند و هیچ تأثیری بر امتیاز، رتبه یا نتیجه ندارد. کردیت مصرف‌شده قابل استرداد نیست. شارژ کردیت به‌صورت دستی و پس از تأیید پرداخت انجام می‌شود.",
  },
  {
    title: "قوانین حساب کاربری",
    body: "هر شخص فقط مجاز به داشتن یک حساب است. ساخت چند حساب، پیش‌بینی‌های آینه‌ای یا هماهنگ‌شده، سوءاستفاده از خطاهای فنی یا هر رفتاری که سلامت رقابت را خدشه‌دار کند، به حذف حساب، ابطال چلنج‌ها و مصادره‌ی ورودی‌ها بدون بازگشت وجه منجر می‌شود.",
  },
  {
    title: "چلنج پراپ",
    body: "قوانین هر چلنج (هدف، حد افت، سقف ضرر روزانه، حداقل پیش‌بینی و مهلت) در لحظه‌ی فعال‌سازی ثابت است و در طول چلنج تغییر نمی‌کند. جوایز پس از پاس‌شدن و احراز یکتایی حساب، از طریق پشتیبانی تحویل می‌شوند. مجموعه حق بررسی هر حساب را پیش از اعطای جایزه محفوظ می‌دارد.",
  },
  {
    title: "افشای ریسک",
    body: "معامله در بازارهای مالی (فارکس، طلا، کریپتو) دارای ریسک بالاست و می‌تواند به از دست رفتن کل سرمایه منجر شود. عملکرد گذشته‌ی ربات یا هر استراتژی، تضمینی برای نتایج آینده نیست. هیچ‌یک از محتوای این وب‌سایت توصیه‌ی سرمایه‌گذاری نیست و مسئولیت تصمیم‌های مالی تماماً با کاربر است.",
  },
  {
    title: "داده‌ها و حریم خصوصی",
    body: "آیدی تلگرام کاربران فقط برای احراز حساب استفاده می‌شود و هرگز به‌صورت عمومی نمایش داده نمی‌شود. داده‌های بازارهای پیش‌بینی از منابع عمومی (از جمله پالی‌مارکت) دریافت می‌شوند و مجموعه مسئولیتی در قبال صحت یا در دسترس‌بودن دائمی منابع ثالث ندارد.",
  },
  {
    title: "محدودیت مسئولیت",
    body: "خدمات این وب‌سایت «همان‌گونه که هست» ارائه می‌شود. مجموعه در قبال خسارات غیرمستقیم، از دست رفتن سود یا اختلالات فنی خارج از کنترل خود مسئولیتی ندارد و حداکثر مسئولیت آن در هر مورد، معادل مبلغ پرداختی همان کاربر در ۳ ماه اخیر است.",
  },
  {
    title: "تغییرات",
    body: "مجموعه می‌تواند این قوانین را برای دوره‌های آینده به‌روزرسانی کند؛ چلنج‌ها و خریدهای فعال، تابع قوانین لحظه‌ی فعال‌سازی خود باقی می‌مانند. ادامه‌ی استفاده از سایت به معنای پذیرش نسخه‌ی جاری قوانین است.",
  },
];

export default function Legal() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="terms" className="relative mx-auto max-w-5xl scroll-mt-20 px-6 py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            TERMS · RISK · PRIVACY
          </span>
          <h2 className="mt-4 font-display text-2xl font-black md:text-3xl">
            قوانین، افشای <span className="text-gold">ریسک</span> و سلب مسئولیت
          </h2>
        </div>
        <p className="max-w-xs text-[11px] leading-6 text-muted">
          روی هر بند بزنید تا متن کامل آن باز شود.
        </p>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {TERMS.map((t, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`h-fit overflow-hidden rounded-2xl border bg-surface/40 transition-all duration-300 ${
                isOpen ? "border-gold/50" : "border-line hover:border-gold/40"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="no-zoom flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
              >
                <span className="flex items-center gap-3 text-[13px] font-bold">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                    {i + 1}
                  </span>
                  {t.title}
                </span>
                <span
                  className={`shrink-0 text-gold transition-transform duration-300 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              <div
                className={`grid transition-all duration-300 ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-xs leading-7 text-muted">{t.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[11px] leading-6 text-muted">
        سوالی درباره‌ی قوانین دارید؟{" "}
        <a
          href={SUPPORT}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold transition hover:text-gold-deep"
        >
          پشتیبانی ۲۴ ساعته در تلگرام
        </a>{" "}
        پاسخگوی شماست.
      </p>
    </section>
  );
}
