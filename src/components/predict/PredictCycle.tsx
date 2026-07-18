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

const GUESSES = [
  { y: 60, winner: false },
  { y: 84, winner: true },
  { y: 112, winner: false },
  { y: 138, winner: false },
];

const HIST =
  "M0 150 C 30 142, 55 146, 80 132 S 130 118, 160 124 S 210 100, 240 106 S 300 88, 330 96 L 360 95";
const FUTURE = "M360 95 C 395 92, 420 96, 450 90 L 480 88";

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
      <svg viewBox="0 0 600 220" className="w-full" aria-hidden="true">
        <line x1="0" y1="55" x2="600" y2="55" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="110" x2="600" y2="110" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="165" x2="600" y2="165" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />

        <rect x="360" y="20" width="240" height="175" fill="var(--color-gold)" opacity="0.025" />
        <line
          x1="360"
          y1="20"
          x2="360"
          y2="195"
          stroke="var(--color-gold)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.45"
        />

        <text x="352" y="212" fontSize="10" fill="var(--color-muted)" textAnchor="end">
          امروز
        </text>
        <text x="480" y="212" fontSize="10" fill="var(--color-muted)" textAnchor="middle">
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

        {phase >= 1 && phase < 3 && (
          <text
            x="480"
            y="78"
            fontSize="34"
            fontWeight="bold"
            fill="var(--color-gold)"
            textAnchor="middle"
            className="blink"
          >
            ؟
          </text>
        )}

        {GUESSES.map((g, i) => (
          <g
            key={g.y}
            style={{
              opacity: phase >= 2 ? (phase === 4 && !g.winner ? 0.25 : 1) : 0,
              transform: phase >= 2 ? "translateY(0)" : "translateY(6px)",
              transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: phase === 2 ? `${i * 260}ms` : "0ms",
            }}
          >
            <line
              x1="472"
              y1={g.y}
              x2="492"
              y2={g.y}
              stroke={phase === 4 && g.winner ? "var(--color-gain)" : "var(--color-muted)"}
              strokeWidth="1.2"
              opacity="0.7"
            />
            <circle
              cx="482"
              cy={g.y}
              r="4"
              fill={phase === 4 && g.winner ? "var(--color-gain)" : "var(--color-cream)"}
            />
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
            <circle cx="480" cy="88" r="4.5" fill="var(--color-gold)" />
            {phase === 3 && (
              <circle
                cx="480"
                cy="88"
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

        {phase === 4 && (
          <g>
            <circle
              cx="482"
              cy="84"
              r="10"
              fill="none"
              stroke="var(--color-gain)"
              strokeWidth="1.5"
              className="ping-ring"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <text
              x="510"
              y="70"
              fontSize="13"
              fontWeight="bold"
              fill="var(--color-gain)"
              fontFamily="monospace"
              className="float-up"
            >
              +100
            </text>
          </g>
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
