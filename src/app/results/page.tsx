import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Results from "@/components/Results";

export const metadata: Metadata = {
  title: "نتایج زنده و کارنامه‌ی مستقل | نارمون",
  description:
    "کارنامه‌ی زنده‌ی ربات معامله‌گر، تأییدشده توسط Myfxbook. اعداد مستقیم از حساب واقعی خوانده می‌شوند و دستکاری‌شدنی نیستند.",
};

const WHY = [
  {
    t: "چرا Myfxbook؟",
    d: "Myfxbook یک سرویس مستقل شخص‌ثالث است که مستقیم به حساب معاملاتی وصل می‌شود و آمار را خودش می‌خواند. یعنی اعدادی که اینجا می‌بینید توسط ما وارد نشده‌اند و قابل ویرایش هم نیستند.",
  },
  {
    t: "چه چیزی نشان داده می‌شود",
    d: "بازده، افت سرمایه، تعداد معاملات و منحنی رشد حساب. همه‌ی این‌ها از همان حسابی خوانده می‌شود که ربات رویش اجرا می‌شود، نه از یک حساب نمایشی.",
  },
  {
    t: "چه چیزی نشان داده نمی‌شود",
    d: "کارنامه‌ی یک حساب، نتیجه‌ی حساب شما نیست. اندازه‌ی سرمایه، بروکر، اسپرد و زمان ورود شما متفاوت است و نتیجه‌ی متفاوتی می‌سازد.",
  },
  {
    t: "ارتباطش با بازی‌های نارمون",
    d: "هیچ. امتیاز آرنا، نبض بازار و چلنج پراپ کاملاً مستقل از این کارنامه محاسبه می‌شوند و از داده‌ی بازار عمومی می‌آیند.",
  },
];

export default function ResultsPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 pt-28">
        <section className="px-6 pb-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              VERIFIED TRACK RECORD
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-5xl">
              نتایج <span className="text-gold">زنده</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted md:text-base">
              کارنامه‌ی ربات معامله‌گر، مستقیم از حساب واقعی و تأییدشده توسط
              سرویس مستقل Myfxbook. ما این اعداد را وارد نمی‌کنیم و نمی‌توانیم
              تغییرشان دهیم.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            {WHY.map((w) => (
              <div
                key={w.t}
                className="rounded-2xl border border-line bg-surface/40 p-5"
              >
                <h2 className="text-[13px] font-bold text-cream">{w.t}</h2>
                <p className="mt-2 text-[12px] leading-7 text-muted">{w.d}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-loss/30 bg-loss/5 p-5">
            <h3 className="text-[13px] font-bold text-loss">افشای ریسک</h3>
            <p className="mt-2 text-[12px] leading-7 text-muted">
              عملکرد گذشته تضمینی برای نتایج آینده نیست. معامله در بازارهای مالی
              ریسک بالایی دارد و می‌تواند به از دست رفتن کل سرمایه منجر شود.
              محتوای این صفحه توصیه‌ی سرمایه‌گذاری نیست.
            </p>
          </div>
        </section>

        <Results />
      </main>
      <Footer />
    </>
  );
}
