import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BotFaq from "@/components/BotFaq";
import Bot from "@/components/Bot";

export const metadata: Metadata = {
  title: "ربات معامله‌گر اسکلپر متاتریدر ۵ | نارمون",
  description:
    "اکسپرت اسکلپر متاتریدر ۵ با کارنامه‌ی مستقل و قابل بررسی. مشخصات، نحوه‌ی کار، شرایط استفاده و ریسک‌ها.",
};

const FACTS: { k: string; v: string }[] = [
  { k: "پلتفرم", v: "متاتریدر ۵ (MT5)" },
  { k: "سبک", v: "اسکلپ در بازه‌های کوتاه" },
  { k: "اجرا", v: "روی حساب شخصی شما، نزد بروکر خودتان" },
  { k: "کارنامه", v: "مستقل و عمومی در Myfxbook" },
];

const HOWTO = [
  "اشتراک را از طریق پشتیبانی تهیه می‌کنید و فایل اکسپرت به همراه راهنمای نصب تحویل داده می‌شود.",
  "ربات روی متاتریدر ۵ و روی حساب خودتان نصب می‌شود؛ ما به حساب شما دسترسی نداریم و هیچ سفارشی از سمت ما اجرا نمی‌شود.",
  "تنظیمات پیشنهادی (جفت‌ارز، تایم‌فریم، حجم و مدیریت ریسک) در راهنما آمده است و مسئولیت انتخاب نهایی با شماست.",
  "کارنامه‌ی زنده در بخش نتایج قابل بررسی است و به‌صورت مستقل توسط Myfxbook تأیید می‌شود.",
];

export default function BotPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 pt-28">
        <section className="px-6 pb-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              ALGORITHMIC TRADING
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-5xl">
              ربات <span className="text-gold">معامله‌گر</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted md:text-base">
              اکسپرت اسکلپر متاتریدر ۵ با کارنامه‌ی مستقل و قابل بررسی. این
              محصول از بخش‌های پیش‌بینی نارمون جداست و امتیاز یا جایزه‌ی
              پلتفرم را تحت تأثیر قرار نمی‌دهد.
            </p>
          </div>

          <div className="mx-auto mt-10 grid grid-cols-1 max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div
                key={f.k}
                className="rounded-2xl border border-line bg-surface/40 p-4 text-center"
              >
                <span className="block text-[10px] text-muted">{f.k}</span>
                <span className="mt-1.5 block text-[13px] font-bold text-cream">
                  {f.v}
                </span>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-line bg-surface/40 p-6">
            <h2 className="font-display text-lg font-extrabold text-cream">
              چطور کار می‌کند
            </h2>
            <ol className="mt-4 flex flex-col gap-3">
              {HOWTO.map((t, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-7 text-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-loss/30 bg-loss/5 p-5">
            <h3 className="text-[13px] font-bold text-loss">افشای ریسک</h3>
            <p className="mt-2 text-[12px] leading-7 text-muted">
              معامله در بازارهای مالی ریسک بالایی دارد و می‌تواند به از دست رفتن
              کل سرمایه منجر شود. عملکرد گذشته‌ی هیچ ربات یا استراتژی‌ای تضمینی
              برای نتایج آینده نیست. این صفحه توصیه‌ی سرمایه‌گذاری نیست و
              مسئولیت تصمیم‌های مالی تماماً با شماست. هیچ سود تضمین‌شده‌ای وعده
              داده نمی‌شود.
            </p>
          </div>
        </section>

        <Bot />
        <BotFaq />
      </main>
      <Footer />
    </>
  );
}
