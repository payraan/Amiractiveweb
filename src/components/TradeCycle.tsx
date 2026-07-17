"use client";

import { useEffect, useRef, useState } from "react";

const PHASES = [
  { label: "در حال اسکن بازار…", tone: "bg-gold" },
  { label: "سیگنال شناسایی شد", tone: "bg-gold" },
  { label: "ورود به معامله — حد سود و حد ضرر ثبت شد", tone: "bg-cream" },
  { label: "مدیریت خودکار معامله…", tone: "bg-gain" },
  { label: "معامله با سود بسته شد", tone: "bg-gain" },
];

const DUR = [2400, 1600, 2000, 2600, 2200];

type Candle = readonly [number, number, number, number, number, number];

const BASE: readonly Candle[] = [
  [24, 150, 18, 1, 145, 172],
  [46, 155, 14, 0, 150, 174],
  [68, 142, 20, 1, 138, 166],
  [90, 132, 16, 1, 128, 152],
  [112, 138, 12, 0, 134, 156],
  [134, 126, 18, 1, 120, 148],
  [156, 133, 10, 0, 129, 147],
  [178, 120, 16, 1, 115, 140],
  [200, 128, 14, 0, 124, 146],
  [222, 118, 14, 1, 112, 136],
  [244, 124, 10, 0, 120, 138],
  [266, 108, 22, 1, 102, 134],
];

const LIVE: readonly Candle[] = [
  [288, 96, 14, 1, 92, 112],
  [310, 84, 15, 1, 80, 100],
  [332, 88, 8, 0, 84, 98],
  [354, 64, 20, 1, 58, 90],
];

const ENTRY_Y = 108;
const TP_Y = 56;
const SL_Y = 160;

function CandleRect({ c, highlight = false }: { c: Candle; highlight?: boolean }) {
  const [x, y, h, up, w1, w2] = c;
  const color = up ? "var(--color-gain)" : "var(--color-loss)";
  return (
    <g>
      <line x1={x + 7} y1={w1} x2={x + 7} y2={w2} stroke={color} strokeWidth="1.2" opacity="0.7" />
      <rect
        x={x}
        y={y}
        width="14"
        height={h}
        rx="2"
        fill={color}
        opacity="0.75"
        stroke={highlight ? "var(--color-gold)" : "none"}
        strokeWidth={highlight ? 1.5 : 0}
      />
    </g>
  );
}

export default function TradeCycle() {
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
      <svg viewBox="0 0 600 240" className="w-full" aria-hidden="true">
        <line x1="0" y1="60" x2="600" y2="60" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="120" x2="600" y2="120" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="180" x2="600" y2="180" stroke="var(--color-line)" strokeWidth="1" opacity="0.6" />

        {BASE.map((c, i) => (
          <CandleRect key={i} c={c} highlight={i === 11 && phase >= 1} />
        ))}

        {LIVE.map((c, i) => (
          <g
            key={c[0]}
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? "translateY(0)" : "translateY(8px)",
              transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: phase >= 3 ? `${i * 380}ms` : "0ms",
            }}
          >
            <CandleRect c={c} />
          </g>
        ))}

        {phase === 0 && !reduced && (
          <g className="sweep">
            <line x1="24" y1="28" x2="24" y2="205" stroke="var(--color-gold)" strokeWidth="1" opacity="0.5" />
          </g>
        )}

        {phase >= 1 && <circle cx="273" cy="97" r="3" fill="var(--color-gold)" />}
        {phase === 1 && (
          <circle
            cx="273"
            cy="97"
            r="9"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.5"
            className="ping-ring"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {phase >= 2 && (
          <g className="appear">
            <line x1="266" y1={TP_Y} x2="556" y2={TP_Y} stroke="var(--color-gain)" strokeWidth="1.2" strokeDasharray="5 4" />
            <line x1="266" y1={SL_Y} x2="556" y2={SL_Y} stroke="var(--color-loss)" strokeWidth="1.2" strokeDasharray="5 4" />
            <line x1="266" y1={ENTRY_Y} x2="556" y2={ENTRY_Y} stroke="var(--color-gold)" strokeWidth="1.4" />
            <text x="562" y={TP_Y + 3} fontSize="9" fill="var(--color-gain)" fontFamily="monospace">
              TP
            </text>
            <text x="562" y={SL_Y + 3} fontSize="9" fill="var(--color-loss)" fontFamily="monospace">
              SL
            </text>
            <text x="562" y={ENTRY_Y + 3} fontSize="9" fill="var(--color-gold)" fontFamily="monospace">
              EN
            </text>
          </g>
        )}

        {phase === 4 && (
          <text
            x="346"
            y="46"
            fontSize="11"
            fontWeight="bold"
            fill="var(--color-gain)"
            fontFamily="monospace"
            className="float-up"
          >
            +0.8%
          </text>
        )}
      </svg>

      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-line bg-ink/80 px-3 py-1.5 text-[11px] text-cream backdrop-blur">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${PHASES[phase].tone} ${reduced ? "" : "blink"}`} />
        {PHASES[phase].label}
      </div>
    </div>
  );
}
