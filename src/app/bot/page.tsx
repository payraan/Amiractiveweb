import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BotFaq from "@/components/BotFaq";
import Bot from "@/components/Bot";
// نتایج زنده و بروکر داخل همین صفحه ادغام شدند: هر سه یک محصول‌اند و سه
// ورودی جدا در منو، کاربر را وادار می‌کرد برای فهمیدن یک چیز سه جا برود.
import Results from "@/components/Results";
import Broker from "@/components/Broker";

export const metadata: Metadata = {
  title: "ربات معامله‌گر متاتریدر ۵، کارنامه‌ی زنده و بروکر همکار | نارمون",
  description:
    "اکسپرت اختصاصی اسکلپینگ برای متاتریدر ۵، همراه با کارنامه معاملاتی شفاف و تأییدشده در Myfxbook.",
};

const FACTS: { k: string; v: string }[] = [
  { k: "پلتفرم معاملاتی", v: "متاتریدر ۵ (MT5)" },
  { k: "استراتژی", v: "اسکلپینگ (نوسان‌گیری کوتاه‌مدت)" },
  { k: "امنیت اجرا", v: "مستقیماً روی حساب شخصی شما" },
  { k: "شفافیت نتایج", v: "ثبت زنده و مستقل در Myfxbook" },
];

const HOWTO = [
  "دریافت اکسپرت: پس از تهیه اشتراک، فایل ربات به همراه راهنمای جامع نصب در اختیار شما قرار می‌گیرد.",
  "نصب و کنترل کامل: ربات مستقیماً روی نرم‌افزار متاتریدر و حساب شخصی شما نصب می‌شود. ما هیچ‌گونه دسترسی به حساب شما نداریم و سفارشی از سمت ما روی سیستم شما اجرا نمی‌شود.",
  "مدیریت ریسک اختصاصی: تنظیمات بهینه (جفت‌ارزها، تایم‌فریم، حجم معاملات و مدیریت ریسک) در راهنما ارائه شده است، اما تصمیم‌گیری و پیکربندی نهایی کاملاً در اختیار شماست.",
  "شفافیت عملکرد: کارنامه و نتایج زنده ربات به‌صورت کاملاً مستقل توسط پلتفرم جهانی Myfxbook ثبت و تأیید می‌شود.",
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
              اکسپرت اختصاصی اسکلپینگ برای متاتریدر ۵، همراه با کارنامه
              معاملاتی شفاف و تأییدشده. این ابزار، محصولی مجزا از پلتفرم
              پیش‌بینی نارمون است و تأثیری بر امتیازات یا حساب چالش پراپ شما
              ندارد.
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
              مراحل راه‌اندازی
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
              معامله در بازارهای مالی با ریسک بالایی همراه است و می‌تواند منجر
              به از دست رفتن سرمایه شود. عملکرد موفق ربات در گذشته، تضمینی برای
              سودآوری در آینده نیست. این پلتفرم هیچ‌گونه سود قطعی را وعده
              نمی‌دهد؛ این محصول صرفاً یک ابزار الگوریتمی است و مسئولیت مدیریت
              سرمایه و تصمیمات مالی تماماً بر عهده شماست.
            </p>
          </div>
        </section>

        {/* پیمایش داخلی — سه بخشی که قبلا سه صفحه‌ی جدا بودند */}
        <nav className="mx-auto mb-2 flex max-w-4xl flex-wrap justify-center gap-3 px-6">
          {[
            { href: "#features", label: "امکانات ربات" },
            { href: "#results", label: "کارنامه‌ی زنده" },
            { href: "#broker", label: "بروکر همکار" },
            { href: "#faq", label: "پرسش‌های متداول" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full border border-line px-4 py-2 text-[12px] text-muted transition hover:border-gold/50 hover:text-gold"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div id="features" className="scroll-mt-24">
          <Bot />
        </div>

        {/* ── کارنامه‌ی زنده (پیش‌تر صفحه‌ی /results) ── */}
        <section id="results" className="scroll-mt-24 px-6 pt-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              VERIFIED TRACK RECORD
            </span>
            <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
              کارنامه‌ی <span className="text-gold">زنده</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted">
              کارنامه‌ی معاملاتی ربات، متصل به حساب واقعی (Real) و تأییدشده
              توسط پلتفرم مستقل جهانی Myfxbook. این داده‌ها مستقیماً از سرورهای
              معاملاتی استخراج می‌شوند و توسط ما قابل ویرایش یا دستکاری نیستند.
            </p>
          </div>
        </section>
        <Results />

        {/* ── بروکر همکار (پیش‌تر صفحه‌ی /broker) ── */}
        <section id="broker" className="scroll-mt-24 px-6 pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              PARTNER BROKERS
            </span>
            <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
              بروکر <span className="text-gold">همکار</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted">
              برای اجرای ربات معامله‌گر و همچنین دریافت حساب جایزه‌ی مسیر
              معاملاتی چالش، به یک حساب نزد بروکر همکار نیاز دارید. شرایط
              معاملاتی، اسپرد و روش برداشت تابع قوانین همان بروکر است، نه نارمون.
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-loss/30 bg-loss/5 p-5">
            <h3 className="text-[13px] font-bold text-loss">
              پیش از افتتاح حساب بخوانید
            </h3>
            <p className="mt-2 text-[12px] leading-7 text-muted">
              نارمون معرف بروکر است و در معاملات شما نقشی ندارد. مسئولیت انتخاب
              بروکر، رعایت قوانین آن و نتیجه‌ی معاملات تماماً با شماست. معامله
              در بازارهای مالی ریسک بالایی دارد و می‌تواند به از دست رفتن کل
              سرمایه منجر شود.
            </p>
          </div>
        </section>
        <Broker />

        <div id="faq" className="scroll-mt-24">
          <BotFaq />
        </div>
      </main>
      <Footer />
    </>
  );
}
