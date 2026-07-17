"use client";

import { useEffect, useRef, useState } from "react";

const MYFXBOOK_URL = "https://www.myfxbook.com"; // TODO: real portfolio link

const MONTHLY = [
  { m: "مرداد", v: 4.2 },
  { m: "شهریور", v: 7.8 },
  { m: "مهر", v: -2.1 },
  { m: "آبان", v: 9.4 },
  { m: "آذر", v: 12.1 },
  { m: "دی", v: 5.3 },
  { m: "بهمن", v: -3.4 },
  { m: "اسفند", v: 8.8 },
  { m: "فروردین", v: 15.2 },
  { m: "اردیبهشت", v: 6.1 },
  { m: "خرداد", v: -1.2 },
  { m: "تیر", v: 11.4 },
];

function useInView(threshold = 0.2) {
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

function useCountUp(target: number, run: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return val;
}

function Stat({
  label,
  target,
  run,
  prefix = "",
  suffix = "%",
  decimals = 1,
  tone = "text-cream",
  delay = 0,
}: {
  label: string;
  target: number;
  run: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tone?: string;
  delay?: number;
}) {
  const v = useCountUp(target, run);
  const shown =
    decimals === 0
      ? Math.round(v).toLocaleString("en-US")
      : v.toFixed(decimals);
  return (
    <div
      className={`flex flex-col items-start gap-1 transition-all duration-700 ease-out ${
        run ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`font-mono text-lg font-bold md:text-xl ${tone}`} dir="ltr">
        {prefix}
        {shown}
        {suffix}
      </span>
    </div>
  );
}

export default function Results() {
  const { ref, inView } = useInView();
  const rv = (extra = "") =>
    `transition-all duration-700 ease-out ${
      inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    } ${extra}`;

  return (
    <section
      id="results"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <div ref={ref}>
        <span className={rv("font-mono text-[11px] tracking-[0.4em] text-gold")} dir="ltr">
          LIVE PERFORMANCE · MYFXBOOK
        </span>

        <h2
          className={rv("mt-4 font-display text-3xl font-black md:text-4xl")}
          style={{ transitionDelay: "80ms" }}
        >
          عملکرد زنده از حساب واقعی
        </h2>

        <p
          className={rv("mt-4 max-w-2xl leading-8 text-muted")}
          style={{ transitionDelay: "160ms" }}
        >
          تمام آمار این بخش مستقیم از حساب واقعی می‌آید و به‌صورت مستقل در
          Myfxbook قابل بررسی است — ماه‌های منفی هم همین‌جاست، چون اعتماد از
          شفافیت می‌آید، نه از فیلتر.
        </p>

        <div className={rv("mt-10")} style={{ transitionDelay: "240ms" }}>
          <div className="frame-hover rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-8">
          <svg viewBox="0 0 600 170" className="w-full" aria-hidden="true">
            <defs>
              <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.16" />
                <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="42" x2="600" y2="42" stroke="var(--color-line)" strokeWidth="1" />
            <line x1="0" y1="85" x2="600" y2="85" stroke="var(--color-line)" strokeWidth="1" />
            <line x1="0" y1="128" x2="600" y2="128" stroke="var(--color-line)" strokeWidth="1" />
            <path
              d="M0 150 C 30 142, 55 138, 85 128 S 130 108, 150 118 S 200 96, 235 86 S 290 62, 320 72 S 370 52, 410 44 S 470 28, 500 36 S 560 22, 600 16 L 600 170 L 0 170 Z"
              fill="url(#eqg)"
              className="transition-opacity duration-1000"
              style={{ opacity: inView ? 1 : 0, transitionDelay: "900ms" }}
            />
            <path
              d="M0 150 C 30 142, 55 138, 85 128 S 130 108, 150 118 S 200 96, 235 86 S 290 62, 320 72 S 370 52, 410 44 S 470 28, 500 36 S 560 22, 600 16"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="2.5"
              pathLength={1}
              className={inView ? "draw" : "opacity-0"}
            />
          </svg>

          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="بازده کل" target={187.4} run={inView} prefix="+" tone="text-gain" delay={350} />
            <Stat label="میانگین ماهانه" target={12.4} run={inView} prefix="+" tone="text-gain" delay={420} />
            <Stat label="نرخ برد" target={84.2} run={inView} delay={490} />
            <Stat label="حداکثر افت" target={6.8} run={inView} tone="text-loss" delay={560} />
            <Stat label="تعداد معاملات" target={1284} run={inView} suffix="" decimals={0} delay={630} />
            <Stat label="روزهای فعالیت" target={312} run={inView} suffix="" decimals={0} delay={700} />
          </div>

          <p className="mt-6 text-[10px] leading-5 text-muted">
            داده‌های نمایشی برای پیش‌نمایش — پیش از انتشار با آمار واقعی حساب
            جایگزین می‌شوند.
          </p>
          </div>
        </div>

        <div className={rv("mt-8")} style={{ transitionDelay: "320ms" }}>
          <div className="frame-hover rounded-2xl border border-line bg-surface/40 p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold">بازده ماه‌به‌ماه (٪)</span>
            <span className="flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-gain" />
                سود
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-loss" />
                زیان
              </span>
            </span>
          </div>

          <div className="flex items-stretch gap-1.5 sm:gap-2.5">
            {MONTHLY.map((b, i) => {
              const pos = b.v >= 0;
              const h = Math.round(Math.abs(b.v) * 7);
              return (
                <div key={b.m} className="flex flex-1 flex-col items-center" title={`${b.m}: ${b.v}٪`}>
                  <div className="flex h-[110px] w-full items-end justify-center">
                    {pos && (
                      <div
                        className="w-2.5 rounded-t-sm bg-gain/80 transition-transform duration-700 ease-out sm:w-4"
                        style={{
                          height: `${h}px`,
                          transform: inView ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "bottom",
                          transitionDelay: `${250 + i * 50}ms`,
                        }}
                      />
                    )}
                  </div>
                  <div className="h-px w-full bg-line" />
                  <div className="flex h-[40px] w-full items-start justify-center">
                    {!pos && (
                      <div
                        className="w-2.5 rounded-b-sm bg-loss/80 transition-transform duration-700 ease-out sm:w-4"
                        style={{
                          height: `${h}px`,
                          transform: inView ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "top",
                          transitionDelay: `${250 + i * 50}ms`,
                        }}
                      />
                    )}
                  </div>
                  <span className="mt-2 w-full text-center text-[8px] text-muted sm:text-[10px]">
                    {b.m}
                  </span>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div
          className={rv("mt-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center")}
          style={{ transitionDelay: "400ms" }}
        >
          <a
            href={MYFXBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-gold/40 px-6 py-3 text-gold transition hover:bg-gold hover:text-ink"
          >
            بررسی مستقل در Myfxbook
            <span dir="ltr" aria-hidden="true">↗</span>
          </a>
          <p className="max-w-md text-xs leading-6 text-muted">
            معامله در بازارهای مالی با ریسک همراه است؛ عملکرد گذشته
            تضمین‌کننده‌ی نتایج آینده نیست.
          </p>
        </div>
      </div>
    </section>
  );
}
