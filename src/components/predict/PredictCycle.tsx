"use client";

import { useEffect, useRef, useState } from "react";

const PHASES = [
  { label: "رسم قیمت تا امروز…", tone: "bg-gold" },
  { label: "فردا چند؟", tone: "bg-gold" },
  { label: "پیش‌بینی‌ها ثبت شدند", tone: "bg-cream" },
  { label: "قیمت واقعی ثبت شد", tone: "bg-gold" },
  { label: "دقیق‌ترین پیش‌بینی برنده شد", tone: "bg-gain" },
];

const DUR = [2400, 1600, 2200, 2000, 2400];

// guesses live in the future zone; the winner is the one closest to the
// actual settle level (y = 86). x is fixed; only y differs.
const GUESS_X = 500;
const SETTLE_Y = 86;
const GUESSES = [
  { y: 44, winner: false },
  { y: 86, winner: true },
  { y: 128, winner: false },
  { y: 166, winner: false },
];

const HIST =
  "M0 150 C 30 142, 55 146, 80 132 S 130 118, 160 124 S 210 100, 240 106 S 300 90, 340 98 L 380 96";
const FUTURE = "M380 96 C 420 94, 450 90, 475 88 L 500 86";

export default function PredictCycle() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setPhase(4);
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
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reduced) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % PHASES.length), DUR[phase]);
    return () => clearTimeout(t);
  }, [phase, inView, reduced]);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-line bg-surface/60 backdrop-blur"
    >
      <svg viewBox="0 0 600 210" className="w-full" aria-hidden="true">
        <line x1="0" y1="52" x2="600" y2="52" stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />
        <line x1="0" y1="105" x2="600" y2="105" stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />
        <line x1="0" y1="158" x2="600" y2="158" stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />

        <rect x="380" y="18" width="220" height="170" fill="var(--color-gold)" opacity="0.025" />
        <line
          x1="380"
          y1="18"
          x2="380"
          y2="188"
          stroke="var(--color-gold)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.45"
        />

        <text x="372" y="204" fontSize="10" fill="var(--color-muted)" textAnchor="end">
          امروز
        </text>
        <text x="500" y="204" fontSize="10" fill="var(--color-muted)" textAnchor="middle">
          فردا
        </text>

        {inView && (
          <path
            d={HIST}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="2.2"
            pathLength={1}
            className={reduced ? "" : "draw"}
          />
        )}

        {/* question mark shows ONLY before guesses appear, centered in the empty future zone */}
        {phase === 1 && (
          <text
            x="500"
            y="112"
            fontSize="40"
            fontWeight="bold"
            fill="var(--color-gold)"
            textAnchor="middle"
            className="blink"
          >
            ؟
          </text>
        )}

        {phase >= 2 && phase < 4 &&
          GUESSES.map((g, i) => (
            <g
              key={g.y}
              style={{
                opacity: 1,
                transform: phase >= 2 ? "translateY(0)" : "translateY(6px)",
                transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: phase === 2 ? `${i * 260}ms` : "0ms",
              }}
            >
              <circle cx={GUESS_X} cy={g.y} r="4" fill="var(--color-cream)" opacity="0.85" />
            </g>
          ))}

        {phase >= 3 && (
          <g>
            <path
              d={FUTURE}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="2.2"
              strokeDasharray="6 5"
              className="appear"
            />
            {phase === 3 && (
              <circle
                cx={GUESS_X}
                cy={SETTLE_Y}
                r="10"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="1.5"
                className="ping-ring"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            )}
          </g>
        )}

        {phase === 4 &&
          GUESSES.map((g) => (
            <circle
              key={g.y}
              cx={GUESS_X}
              cy={g.y}
              r={g.winner ? 5 : 4}
              fill={g.winner ? "var(--color-gain)" : "var(--color-cream)"}
              opacity={g.winner ? 1 : 0.25}
            />
          ))}

        {/* actual settle dot always sits exactly at the end of the future line */}
        {phase >= 3 && (
          <circle
            cx={GUESS_X}
            cy={SETTLE_Y}
            r="4.5"
            fill={phase === 4 ? "var(--color-gain)" : "var(--color-gold)"}
          />
        )}

        {phase === 4 && (
          <text
            x="524"
            y="72"
            fontSize="13"
            fontWeight="bold"
            fill="var(--color-gain)"
            fontFamily="monospace"
            textAnchor="start"
            className="float-up"
          >
            +100
          </text>
        )}
      </svg>

      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-line bg-ink/80 px-3 py-1.5 text-[11px] text-cream backdrop-blur">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${PHASES[phase].tone} ${
            reduced ? "" : "blink"
          }`}
        />
        {PHASES[phase].label}
      </div>
    </div>
  );
}
