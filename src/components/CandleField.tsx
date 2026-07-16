"use client";

import { useEffect, useRef } from "react";

type Candle = {
  left: number;
  top: number;
  h: number;
  dur: number;
  delay: number;
  o: number;
  mobile?: boolean;
};

const candles: Candle[] = [
  { left: 6, top: 12, h: 34, dur: 19, delay: 0, o: 0.05, mobile: true },
  { left: 14, top: 62, h: 22, dur: 24, delay: 3, o: 0.04 },
  { left: 22, top: 30, h: 46, dur: 28, delay: 6, o: 0.03, mobile: true },
  { left: 31, top: 78, h: 28, dur: 21, delay: 2, o: 0.05 },
  { left: 38, top: 18, h: 20, dur: 26, delay: 9, o: 0.04 },
  { left: 45, top: 55, h: 38, dur: 30, delay: 5, o: 0.03, mobile: true },
  { left: 52, top: 84, h: 24, dur: 22, delay: 8, o: 0.04 },
  { left: 58, top: 26, h: 30, dur: 25, delay: 1, o: 0.05, mobile: true },
  { left: 64, top: 66, h: 44, dur: 29, delay: 4, o: 0.03 },
  { left: 71, top: 14, h: 26, dur: 20, delay: 7, o: 0.04, mobile: true },
  { left: 77, top: 48, h: 34, dur: 27, delay: 10, o: 0.04 },
  { left: 83, top: 76, h: 20, dur: 23, delay: 2, o: 0.05, mobile: true },
  { left: 89, top: 34, h: 40, dur: 31, delay: 6, o: 0.03 },
  { left: 94, top: 60, h: 26, dur: 24, delay: 9, o: 0.04, mobile: true },
  { left: 10, top: 88, h: 30, dur: 26, delay: 11, o: 0.03 },
  { left: 27, top: 8, h: 24, dur: 22, delay: 12, o: 0.04 },
  { left: 68, top: 90, h: 32, dur: 28, delay: 13, o: 0.03 },
  { left: 48, top: 6, h: 28, dur: 25, delay: 14, o: 0.04, mobile: true },
];

function CandleShape({ h }: { h: number }) {
  const w = h * 0.36;
  return (
    <svg viewBox="0 0 8 22" width={w} height={h} className="fill-gold">
      <rect x="3.4" y="0" width="1.2" height="22" rx="0.6" />
      <rect x="1" y="6" width="6" height="10" rx="1" />
    </svg>
  );
}

export default function CandleField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.scrollY * -0.06}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div ref={ref} className="absolute inset-[-10%]">
        {candles.map((c, i) => (
          <span
            key={i}
            className={`float absolute ${c.mobile ? "" : "hidden md:block"}`}
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              opacity: c.o,
              animationDuration: `${c.dur}s`,
              animationDelay: `-${c.delay}s`,
            }}
          >
            <CandleShape h={c.h} />
          </span>
        ))}
      </div>
    </div>
  );
}
