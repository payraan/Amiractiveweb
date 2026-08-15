import { LINKS } from "@/config/site";
import Link from "next/link";
import PredictCycle from "@/components/predict/PredictCycle";

const SUPPORT = LINKS.telegramSupport;
const CHANNEL = "https://t.me/CashflowFactorys";

const POINTS = [
  "قیمت آینده دارایی‌ها را در بازه‌های زمانی مختلف (۱، ۴، ۱۲ و ۲۴ ساعته) پیش‌بینی کنید.",
  "امتیازدهی کاملاً عادلانه و بر اساس میزان نوسان طبیعی همان بازه در بازار محاسبه می‌شود.",
  "پیش‌بینی در تایم‌فریم ۲۴ ساعته کاملاً رایگان است! بازه‌های کوتاه‌تر با MOON باز می‌شوند.",
  "نفرات برتر در جدول ماهانه، جوایز ویژه‌ای شامل حساب معاملاتی واقعی، اشتراک ربات تریدر و پاداش تتر دریافت می‌کنند.",
];

export default function MarketPulseSection() {
  return (
    <section
      id="pulse"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-2">
          <span className="font-mono text-[11px] tracking-[0.3em] text-gold">
            ۰۲ · نبض بازار
          </span>
          <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
            پیش‌بینی دقیق <span className="text-gold">قیمت‌ها</span>
          </h2>
          <p className="mt-4 leading-8 text-muted">
            میدان رقابت برای پیش‌بینی دارایی‌های بازارهای مالی (کریپتو، فارکس،
            فلزات و سهام آمریکا). هرچه پیش‌بینی شما به قیمت واقعی نزدیک‌تر
            باشد، امتیاز بالاتری می‌گیرید؛ یک رقابت کاملاً مهارتی.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
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

        </div>

        <div className="order-1 lg:order-1 rounded-2xl border border-line bg-surface/40 p-4 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_28px_rgba(232,196,106,0.12)]">
          <PredictCycle />
        </div>
      </div>
    </section>
  );
}
