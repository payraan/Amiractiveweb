"use client";

import { useEffect, useRef, useState } from "react";

const TELEGRAM_SUPPORT = "https://t.me/CashflowFactorys"; // TODO: real support/admin ID

const FEATURES = [
  {
    title: "اسکلپینگ روی طلا و یورودلار",
    desc: "معاملات کوتاه با هدف مشخص روی تایم‌فریم پایین.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "پایبند به استراتژی",
    desc: "بدون ترس و طمع؛ فقط قواعد ازپیش‌تعریف‌شده را اجرا می‌کند.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "خستگی‌ناپذیر",
    desc: "تمام ساعات بازار را می‌پاید؛ فرصتی را از سر خستگی از دست نمی‌دهد.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "ریسک و ساعت معامله در اختیار شما",
    desc: "حجم، حد ضرر، حد سود و بازه‌ی معامله قابل تنظیم است.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13M20 17h0" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="19" cy="17" r="2" />
      </svg>
    ),
  },
  {
    title: "نصب آسان، بدون دانش تخصصی",
    desc: "اتصال به حساب متاتریدر ۵ و تنظیمات اولیه — تمام.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 3v10M8 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "شفافیت کامل",
    desc: "عملکرد ربات به‌صورت زنده و مستقل در Myfxbook ثبت می‌شود.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
];

type Plan = {
  name: string;
  price: string;
  period: string;
  oldPrice?: string;
  badge?: string;
  note: string;
  items: string[];
  cta: string;
  highlighted?: boolean;
};

// برای کمپین یا جشنواره: کافی است روی هر پلن oldPrice و badge را ست کنید
// مثال: oldPrice: "$100", price: "$80", badge: "تخفیف جشنواره"
const PLANS: Plan[] = [
  {
    name: "تست رایگان",
    price: "$0",
    period: "/ یک هفته",
    note: "روی حساب دمو — بدون ریسک، عملکرد را خودتان بسنجید.",
    items: [
      "دسترسی کامل به ربات",
      "یک هفته روی حساب دمو",
      "راهنمای نصب قدم‌به‌قدم",
      "پشتیبانی در تلگرام",
    ],
    cta: "دریافت نسخه‌ی تست",
  },
  {
    name: "با بروکر معرفی ما",
    price: "$100",
    period: "/ ماه",
    badge: "پیشنهاد ما",
    note: "چرا ارزان‌تر؟ چون بخشی از هزینه را همکاری ما با بروکر پوشش می‌دهد.",
    items: [
      "لایسنس کامل ربات",
      "راهنمای نصب قدم‌به‌قدم روی MT5",
      "پشتیبانی مستقیم در تلگرام",
      "ثبت‌نام بروکر با راهنمایی ما",
    ],
    cta: "خرید و فعال‌سازی",
    highlighted: true,
  },
  {
    name: "با بروکر دلخواه شما",
    price: "$150",
    period: "/ ماه",
    note: "روی هر بروکری که خودتان انتخاب کرده‌اید فعال می‌شود.",
    items: [
      "لایسنس کامل ربات",
      "راهنمای نصب قدم‌به‌قدم روی MT5",
      "پشتیبانی مستقیم در تلگرام",
      "بدون نیاز به تغییر بروکر",
    ],
    cta: "خرید و فعال‌سازی",
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-gold">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Bot() {
  const { ref, inView } = useInView();
  const rv = (extra = "") =>
    `transition-all duration-700 ease-out ${
      inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    } ${extra}`;

  return (
    <section
      id="bot"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <div ref={ref}>
        <span className={rv("font-mono text-[11px] tracking-[0.4em] text-gold")} dir="ltr">
          TRADING ROBOT · MT5 EXPERT
        </span>

        <h2
          className={rv("mt-4 font-display text-3xl font-black md:text-4xl")}
          style={{ transitionDelay: "80ms" }}
        >
          اسکلپینگ خودکار روی متاتریدر ۵
        </h2>

        <p
          className={rv("mt-4 max-w-2xl leading-8 text-muted")}
          style={{ transitionDelay: "160ms" }}
        >
          یک اکسپرت اسکلپینگ برای متاتریدر ۵ که بر اساس قواعد مشخص و بدون
          دخالت احساسات معامله می‌کند — همان رباتی که عملکردش را در بخش نتایج
          زنده دیدید.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={rv("rounded-2xl border border-line bg-surface/50 p-5")}
              style={{ transitionDelay: `${240 + i * 60}ms` }}
            >
              <span className="text-gold">{f.icon}</span>
              <h3 className="mt-4 text-sm font-bold">{f.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={rv(
                `relative rounded-2xl p-6 ${
                  plan.highlighted
                    ? "border border-gold/50 bg-surface/70 backdrop-blur"
                    : "border border-line bg-surface/40"
                }`
              )}
              style={{ transitionDelay: `${620 + i * 80}ms` }}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-ink">
                  {plan.badge}
                </span>
              )}
              <h3 className="text-sm font-bold text-muted">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                {plan.oldPrice && (
                  <span className="font-mono text-lg text-muted line-through" dir="ltr">
                    {plan.oldPrice}
                  </span>
                )}
                <span
                  className={`font-mono text-4xl font-bold ${
                    plan.highlighted ? "text-gold" : ""
                  }`}
                  dir="ltr"
                >
                  {plan.price}
                </span>
                <span className="text-sm text-muted">{plan.period}</span>
              </div>
              <p className="mt-2 min-h-10 text-[11px] leading-5 text-muted">
                {plan.note}
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {plan.items.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm">
                    <Check />
                    {p}
                  </li>
                ))}
              </ul>
              <a
                href={TELEGRAM_SUPPORT}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-6 block rounded-xl py-3.5 text-center transition ${
                  plan.highlighted
                    ? "bg-gold font-display font-extrabold text-ink hover:bg-gold-deep"
                    : "border border-line font-bold text-cream hover:border-gold hover:text-gold"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div
          className={rv("mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted")}
          style={{ transitionDelay: "900ms" }}
        >
          <span>پرداخت با تتر (USDT)</span>
          <span className="text-gold">·</span>
          <span>فعال‌سازی سریع توسط پشتیبانی</span>
          <span className="text-gold">·</span>
          <span>نتایج متصل به Myfxbook</span>
        </div>
      </div>
    </section>
  );
}
