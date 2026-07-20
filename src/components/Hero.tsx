"use client";

import { useEffect, useState } from "react";

function useLiveStats() {
  const [s, setS] = useState<{ monthly: number; drawdown: number; profitFactor: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/predict/results", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j && j.ok && j.stats) setS(j.stats);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
    </svg>
  );
}

function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
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
  }, [target, duration]);
  return val;
}

function Stat({
  label,
  target,
  prefix = "",
  suffix = "%",
  decimals = 1,
  tone = "text-cream",
  delay = 0,
}: {
  label: string;
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tone?: string;
  delay?: number;
}) {
  const v = useCountUp(target);
  return (
    <div className="rise flex flex-col items-start gap-1" style={{ animationDelay: `${delay}ms` }}>
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`font-mono text-xl font-bold ${tone}`} dir="ltr">
        {prefix}
        {v.toFixed(decimals)}
        {suffix}
      </span>
    </div>
  );
}

export default function Hero() {
  const live = useLiveStats();
  return (
    <section className="hero-glow relative overflow-hidden">
      <div className="mx-auto grid min-h-[92vh] max-w-6xl items-center gap-14 px-6 pb-16 pt-32 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <span className="rise font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            ALGORITHMIC TRADING · SINCE 2017
          </span>

          <h1
            className="rise max-w-xl text-balance font-display text-3xl font-black leading-[1.45] md:text-[2.5rem] md:leading-[1.3]"
            style={{ animationDelay: "90ms" }}
          >
            معامله‌گری الگوریتمیک،
            <br className="hidden md:block" />{" "}
            <span className="text-gold">با نتایج قابل راستی‌آزمایی</span>
          </h1>

          <p
            className="rise max-w-md leading-8 text-muted"
            style={{ animationDelay: "180ms" }}
          >
            هر معامله روی حساب واقعی ثبت می‌شود؛ عملکرد را زنده ببینید و
            خودتان قضاوت کنید.
          </p>

          <div className="rise flex flex-wrap gap-4" style={{ animationDelay: "270ms" }}>
            <a
              href="https://t.me/CashflowFactorys"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
            >
              <TgIcon />
              ورود به کانال تلگرام
            </a>
            <a
              href="#results"
              className="rounded-xl border border-line px-7 py-3.5 text-cream transition hover:border-gold hover:text-gold"
            >
              نتایج زنده
            </a>
          </div>

          <div
            className="rise flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
            style={{ animationDelay: "360ms" }}
          >
            <span>فعال از ۲۰۱۷</span>
            <span className="text-gold">·</span>
            <span>+۱۵٬۰۰۰ جامعه‌ی فارسی‌زبان</span>
            <span className="text-gold">·</span>
            <span dir="ltr" className="font-mono text-[11px]">
              MYFXBOOK VERIFIED
            </span>
          </div>
        </div>

        <div className="rise" style={{ animationDelay: "220ms" }}>
          <div className="rounded-2xl border border-line bg-surface/80 p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-display text-sm font-bold">
                عملکرد زنده‌ی ربات
              </span>
              <span
                className="flex items-center gap-2 rounded-full border border-gold/30 px-3 py-1 font-mono text-[10px] tracking-wider text-gold"
                dir="ltr"
              >
                <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-gain" />
                LIVE · VERIFIED
              </span>
            </div>

            <svg viewBox="0 0 300 80" className="mb-5 w-full" aria-hidden="true">
              <path
                d="M0 70 C 20 64, 32 66, 46 58 S 72 50, 88 53 S 112 38, 132 41 S 152 28, 172 33 S 202 20, 222 23 S 252 10, 272 13 L 300 7"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2"
                pathLength={1}
                className="draw"
              />
            </svg>

            <div className="grid grid-cols-3 gap-4 border-t border-line pt-5">
              <Stat label="پرافیت فکتور" target={live ? live.profitFactor : 1.82} suffix="" delay={400} />
              <Stat
                label="بازده ماهانه"
                target={live ? live.monthly : 12.4}
                prefix="+"
                tone="text-gain"
                delay={480}
              />
              <Stat label="حداکثر افت" target={live ? live.drawdown : 6.8} tone="text-loss" delay={560} />
            </div>

            <p className="mt-4 text-[10px] leading-5 text-muted">
              اعداد نمایشی‌اند و پیش از انتشار با آمار تأییدشده‌ی Myfxbook
              جایگزین می‌شوند.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
