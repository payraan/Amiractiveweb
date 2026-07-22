"use client";

import { useEffect, useState } from "react";

// چرخه‌ی متحرک آرنا: بازار باز → انتخاب بله → حرکت بازار → تسویه و امتیاز.
const STATUS = [
  "بازار باز است — انتخاب کنید",
  "پیش‌بینی شما ثبت شد: بله",
  "بازار در حرکت است…",
  "تسویه شد — امتیاز نشست",
];

export default function ArenaCycle() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(3);
      return;
    }
    const id = setInterval(() => setStage((s) => (s + 1) % 4), 2100);
    return () => clearInterval(id);
  }, []);

  const yes = stage >= 2 ? 68 : 40;
  const picked = stage >= 1;
  const settled = stage === 3;

  return (
    <div className="relative rounded-xl border border-line bg-ink/40 p-4">
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-2 font-mono text-[10px] text-muted"
          dir="ltr"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
          </span>
          LIVE MARKET
        </span>
        <span
          className={`font-mono text-xs font-extrabold transition-all duration-500 ${
            settled ? "-translate-y-1 text-gain opacity-100" : "translate-y-0 opacity-0"
          }`}
          dir="ltr"
        >
          +32
        </span>
      </div>

      <div className="mt-3 text-xs font-bold leading-6" dir="ltr">
        Will Bitcoin close above $70K this week?
      </div>

      <div className="mt-3 flex justify-between font-mono text-[10px]" dir="ltr">
        <span className="text-gain">Yes {yes}%</span>
        <span className="text-loss">No {100 - yes}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-loss/25">
        <div
          className="h-full rounded-full bg-gain transition-all duration-700 ease-out"
          style={{ width: `${yes}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <span
          className={`rounded-xl border py-2 text-center text-xs font-bold transition-all duration-500 ${
            picked
              ? "border-gain bg-gain/10 text-gain shadow-[0_0_16px_rgba(62,207,142,0.2)]"
              : "border-line text-muted"
          }`}
        >
          بله
        </span>
        <span className="rounded-xl border border-line py-2 text-center text-xs font-bold text-muted">
          خیر
        </span>
      </div>

      <div className="mt-3 text-center text-[10px] text-muted">{STATUS[stage]}</div>
    </div>
  );
}
