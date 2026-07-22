import Link from "next/link";
import PredictCycle from "@/components/predict/PredictCycle";
import Leaderboard from "@/components/predict/Leaderboard";

const SUPPORT = "https://t.me/Amiractive_support";
const CHANNEL = "https://t.me/CashflowFactorys";

const POINTS = [
  "قیمت آینده‌ی بیت‌کوین و طلا را در چهار تایم‌فریم (۲۴، ۱۲، ۴ و ۱ ساعته) حدس بزنید.",
  "امتیاز فقط از دقت می‌آید: آستانه‌های هر تایم‌فریم متناسب با نوسان همان بازه تنظیم شده — عادلانه و هم‌ارز.",
  "تایم‌فریم ۲۴ ساعته رایگان است؛ تایم‌فریم‌های کوتاه‌تر با کردیت باز می‌شوند.",
  "نفرات برتر لیدربورد ماهانه، اشتراک ربات و حساب معاملاتی جایزه می‌گیرند.",
];

export default function MarketPulseSection() {
  return (
    <section
      id="pulse"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
        03 · MARKET PULSE
      </span>
      <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">نبض <span className="text-gold">بازار</span></h2>
      <p className="mt-4 max-w-xl leading-8 text-muted">
        آرنای حدس قیمت — دقت شما، امتیاز شما. با نمودار زنده، تسویه‌ی خودکار و
        رقابت کاملاً مهارتی.
      </p>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-2">
        <div>
          <ul className="flex flex-col gap-3">
            {POINTS.map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/predict"
              className="rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
            >
              شروع پیش‌بینی قیمت
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-line px-7 py-3.5 text-cream transition hover:border-gold hover:text-gold"
            >
              لیدربورد کامل
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
            <a
              href={SUPPORT}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-gold"
            >
              پشتیبانی ۲۴ ساعته
            </a>
            <a
              href={CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-gold"
            >
              عضویت در کانال تلگرام
            </a>
          </div>

          <div className="mt-8">
            <Leaderboard defaultRange="monthly" limit={5} />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/40 p-4 transition-all duration-300 hover:scale-[1.01] hover:border-gold/60 hover:shadow-[0_0_28px_rgba(232,196,106,0.12)]">
          <PredictCycle />
        </div>
      </div>
    </section>
  );
}
