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
    d: "پلتفرم Myfxbook یک مرجع مستقل و شخص ثالث است که مستقیماً به حساب معاملاتی بروکر متصل می‌شود. اعدادی که در این صفحه مشاهده می‌کنید، توسط سیستم ما وارد نشده‌اند و کاملاً غیرقابل دستکاری هستند.",
  },
  {
    t: "چه اطلاعاتی نمایش داده می‌شود؟",
    d: "میزان بازدهی، حداکثر افت سرمایه (Drawdown)، تعداد معاملات و منحنی رشد حساب. تمامی این داده‌ها عیناً از همان حساب واقعی (Real) که اکسپرت روی آن در حال اجراست، خوانده می‌شوند.",
  },
  {
    t: "تفاوت با حساب شخصی شما",
    d: "این کارنامه، نمایانگر عملکرد ربات روی یک حساب مرجع است. میزان سرمایه اولیه شما، نوع بروکر انتخابی، اسپردها و زمان شروع فعالیتتان می‌تواند نتایج متفاوتی را برای حساب شخصی شما رقم بزند.",
  },
  {
    t: "ارتباط با سایر بخش‌های نارمون",
    d: "هیچ‌گونه ارتباطی وجود ندارد. امتیازات بخش‌های ترید پیش‌بینی، نبض بازار و چالش پراپ کاملاً مستقل از این ربات بوده و صرفاً به مهارت تحلیلی خود کاربر بستگی دارند.",
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
              کارنامه‌ی معاملاتی ربات، متصل به حساب واقعی (Real) و تأییدشده توسط
              پلتفرم مستقل جهانی Myfxbook. این داده‌ها مستقیماً از سرورهای
              معاملاتی استخراج می‌شوند و توسط ما قابل ویرایش یا دستکاری نیستند.
            </p>
          </div>

          <div className="mx-auto mt-10 grid grid-cols-1 max-w-4xl gap-4 md:grid-cols-2">
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
