"use client";

import { useEffect, useRef, useState } from "react";
import { LINKS, PLANS } from "@/config/site";
import TradeCycle from "@/components/TradeCycle";

const FEATURES = [
  {
    title: "اسکلپینگ روی طلا و یورودلار",
    desc: "معاملات کوتاه با هدف مشخص روی تایم‌فریم پایین.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M8 5v3M8 16v3M16 3v4M16 15v6" strokeLinecap="round" />
        <rect x="6" y="8" width="4" height="8" rx="1" />
        <rect x="14" y="7" width="4" height="8" rx="1" />
      </svg>
    ),
  },
  {
    title: "پایبند به استراتژی",
    desc: "بدون ترس و طمع؛ فقط قواعد ازپیش‌تعریف‌شده را اجرا می‌کند.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "خستگی‌ناپذیر",
    desc: "تمام ساعات بازار را می‌پاید؛ فرصتی را از سر خستگی از دست نمی‌دهد.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M13 2L4.5 13H11l-1 9L19 11h-6.5L13 2z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "ریسک و ساعت معامله در اختیار شما",
    desc: "حجم، حد ضرر، حد سود و بازه‌ی معامله قابل تنظیم است.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    ),
  },
  {
    title: "نصب آسان، بدون دانش تخصصی",
    desc: "اتصال به حساب متاتریدر ۵ و تنظیمات اولیه — تمام.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "شفافیت کامل",
    desc: "عملکرد ربات به‌صورت زنده و مستقل در Myfxbook ثبت می‌شود.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
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

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
    </svg>
  );
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

        <div className={rv("mt-10")} style={{ transitionDelay: "240ms" }}>
          <TradeCycle />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={rv()}
              style={{ transitionDelay: `${320 + i * 60}ms` }}
            >
              <div className="card-hover h-full rounded-2xl border border-line bg-surface/50 p-5">
                <span className="text-gold">{f.icon}</span>
                <h3 className="mt-4 text-sm font-bold">{f.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div
              key={p.id}
              className={rv()}
              style={{ transitionDelay: `${700 + i * 80}ms` }}
            >
              <div
                className={`card-hover relative h-full rounded-2xl border p-7 ${
                  p.highlight
                    ? "border-gold/50 bg-surface/70 backdrop-blur"
                    : "border-line bg-surface/40"
                }`}
              >
              {p.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-ink">
                  {p.badge}
                </span>
              )}

              <h3 className="text-sm font-bold text-muted">{p.title}</h3>

              <div className="mt-3 flex items-baseline gap-2">
                {p.originalPrice && (
                  <span className="font-mono text-lg text-muted line-through" dir="ltr">
                    {p.originalPrice}
                  </span>
                )}
                <span
                  className={`font-mono text-4xl font-bold ${p.highlight ? "text-gold" : ""}`}
                  dir="ltr"
                >
                  {p.price}
                </span>
                <span className="text-sm text-muted">{p.period}</span>
              </div>

              {p.note && (
                <p className="mt-2 text-[11px] leading-5 text-muted">{p.note}</p>
              )}

              <ul className="mt-6 flex flex-col gap-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={LINKS.telegramSupport}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-7 flex items-center justify-center gap-2 rounded-xl py-3.5 font-display font-extrabold transition ${
                  p.highlight
                    ? "bg-gold text-ink hover:bg-gold-deep"
                    : "border border-line text-cream hover:border-gold hover:text-gold"
                }`}
              >
                <TgIcon />
                {p.cta}
              </a>
              </div>
            </div>
          ))}
        </div>

        <div
          className={rv("mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted")}
          style={{ transitionDelay: "980ms" }}
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
