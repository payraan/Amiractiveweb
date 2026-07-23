/**
 * بادبزن احتمال — امضای بصری نارمون.
 * پرتوها از یک نقطه در پایین باز می‌شوند و تا بالای صفحه بالا می‌روند:
 * تصویر استاندارد «آینده‌های ممکن» در پیش‌بینی احتمالی.
 * تماماً SVG و CSS — بدون کتابخانه، بدون هزینه‌ی جاوااسکریپت.
 */

type Ray = {
  dx: number;
  dy: number;
  w: number;
  o: number;
  delay: string;
  tone: "gold" | "gain";
};

const RAYS: Ray[] = [
  { dx: -980, dy: -470, w: 1.0, o: 0.1, delay: "0s", tone: "gold" },
  { dx: -720, dy: -620, w: 1.3, o: 0.16, delay: "1.9s", tone: "gold" },
  { dx: -470, dy: -730, w: 1.1, o: 0.13, delay: "3.6s", tone: "gain" },
  { dx: -235, dy: -800, w: 1.7, o: 0.24, delay: "1.0s", tone: "gold" },
  { dx: 0, dy: -830, w: 2.1, o: 0.32, delay: "2.6s", tone: "gold" },
  { dx: 235, dy: -800, w: 1.7, o: 0.24, delay: "4.1s", tone: "gold" },
  { dx: 470, dy: -730, w: 1.1, o: 0.13, delay: "1.4s", tone: "gain" },
  { dx: 720, dy: -620, w: 1.3, o: 0.16, delay: "3.1s", tone: "gold" },
  { dx: 980, dy: -470, w: 1.0, o: 0.1, delay: "4.8s", tone: "gold" },
];

const OX = 600;
const OY = 880;

function pathFor(r: Ray): string {
  const cx = OX + r.dx * 0.28;
  const cy = OY + r.dy * 0.76;
  return `M${OX},${OY} Q${cx.toFixed(0)},${cy.toFixed(0)} ${OX + r.dx},${OY + r.dy}`;
}

export default function ProbabilityHorizon() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* هاله‌ی بالای صفحه */}
      <div
        className="narmoon-glow absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(232,196,106,0.16), rgba(232,196,106,0.04) 45%, transparent 75%)",
          animation: "narmoon-glow 9s ease-in-out infinite",
        }}
      />

      <svg
        viewBox="0 0 1200 900"
        className="horizon-mask absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="nm-core" cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.26" />
            <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          className="narmoon-glow"
          cx={OX}
          cy={OY}
          rx="520"
          ry="330"
          fill="url(#nm-core)"
          style={{ animation: "narmoon-glow 7s ease-in-out infinite" }}
        />

        {RAYS.map((r, i) => {
          const d = pathFor(r);
          const color = r.tone === "gain" ? "var(--color-gain)" : "var(--color-gold)";
          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={r.w}
                strokeOpacity={r.o}
                strokeLinecap="round"
              />
              <path
                className="narmoon-ray"
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={r.w + 0.8}
                strokeOpacity="0.75"
                strokeLinecap="round"
                strokeDasharray="180 2400"
                style={{ animation: `narmoon-ray 8s linear ${r.delay} infinite` }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
