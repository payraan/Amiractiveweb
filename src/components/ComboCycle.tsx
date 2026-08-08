"use client";

import { useEffect, useState } from "react";

/**
 * چرخه‌ی متحرک کمبو.
 *
 * سکشن کمبو تنها بخش صفحه‌ی اصلی بود که هیچ حرکتی نداشت. این چرخه همان چیزی
 * را نشان می‌دهد که کمبو واقعا هست: پاهای تیکت یکی‌یکی تسویه می‌شوند و تا
 * وقتی همه درست باشند تیکت زنده است — یک اشتباه کافی است تا کل تیکت بسوزد.
 */
const LEGS = [
  { q: "Bitcoin above $70K", c: "بله", p: "62%" },
  { q: "Fed cuts rates in Sept", c: "خیر", p: "55%" },
  { q: "Lakers win the title", c: "بله", p: "48%" },
];

// چهار مرحله: در انتظار → پای اول سبز → پای دوم سبز → پای سوم سبز و تیکت برد
const STEPS = 5;

export default function ComboCycle() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(STEPS - 1);
      return;
    }
    const id = setInterval(() => setStage((s) => (s + 1) % STEPS), 1600);
    return () => clearInterval(id);
  }, []);

  const settledCount = Math.min(LEGS.length, Math.max(0, stage - 1));
  const won = stage === STEPS - 1;

  return (
    <div>
      <div className="flex flex-col gap-2">
        {LEGS.map((l, i) => {
          const done = i < settledCount;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                done
                  ? "border-gain/40 bg-gain/5"
                  : "border-line bg-ink/40"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-colors duration-500 ${
                  done ? "border-gain text-gain" : "border-gold/40 text-gold"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="line-clamp-1 flex-1 text-[11px] text-muted" dir="ltr">
                {l.q}
              </span>
              <span
                className={`shrink-0 text-xs font-bold ${
                  l.c === "بله" ? "text-gain" : "text-loss"
                }`}
              >
                {l.c}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted" dir="ltr">
                {l.p}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 transition-all duration-500 ${
          won ? "border-gain/50 bg-gain/10" : "border-gold/40 bg-gold/5"
        }`}
      >
        <div className="flex justify-between text-[11px]">
          <span className="text-muted">
            {won ? "هر سه درست بود — تیکت برد" : "شانس برد تیکت"}
          </span>
          <span
            className={`font-mono font-bold ${won ? "text-gain" : "text-cream"}`}
            dir="ltr"
          >
            {won ? "WIN" : "16.4%"}
          </span>
        </div>

        {/* نوار پیشرفت پاهای تسویه‌شده */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              won ? "bg-gain" : "bg-gold"
            }`}
            style={{ width: `${(settledCount / LEGS.length) * 100}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-[11px]">
          <span className="text-muted">اگر همه درست باشند</span>
          <span className="font-mono font-bold text-gain" dir="ltr">
            +251
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-muted">اگر یکی اشتباه باشد</span>
          <span className="font-mono font-bold text-loss" dir="ltr">
            −49
          </span>
        </div>
      </div>
    </div>
  );
}
