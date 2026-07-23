/**
 * بادبزن احتمال — امضای بصری نارمون.
 * پرتوها از یک نقطه باز می‌شوند: تصویر استاندارد «آینده‌های ممکن» در
 * پیش‌بینی احتمالی. هر پرتو یک نبض نور دارد که به بیرون سفر می‌کند.
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
  { dx: -780, dy: -190, w: 1.0, o: 0.14, delay: "0s", tone: "gold" },
  { dx: -570, dy: -262, w: 1.3, o: 0.22, delay: "1.7s", tone: "gold" },
  { dx: -375, dy: -302, w: 1.1, o: 0.18, delay: "3.3s", tone: "gain" },
  { dx: -188, dy: -322, w: 1.7, o: 0.34, delay: "0.9s", tone: "gold" },
  { dx: 0, dy: -330, w: 2.1, o: 0.46, delay: "2.4s", tone: "gold" },
  { dx: 188, dy: -322, w: 1.7, o: 0.34, delay: "3.8s", tone: "gold" },
  { dx: 375, dy: -302, w: 1.1, o: 0.18, delay: "1.3s", tone: "gain" },
  { dx: 570, dy: -262, w: 1.3, o: 0.22, delay: "2.9s", tone: "gold" },
  { dx: 780, dy: -190, w: 1.0, o: 0.14, delay: "4.4s", tone: "gold" },
];

const OX = 600;
const OY = 344;

function pathFor(r: Ray): string {
  const cx = OX + r.dx * 0.3;
  const cy = OY + r.dy * 0.74;
  return `M${OX},${OY} Q${cx.toFixed(0)},${cy.toFixed(0)} ${OX + r.dx},${OY + r.dy}`;
}

export default function ProbabilityHorizon() {
  return (
    <div
      className="horizon-mask pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[300px] overflow-hidden md:h-[344px]"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 344"
        className="h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="nm-core" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.30" />
            <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* هاله‌ی نقطه‌ی مبدأ */}
        <ellipse
          className="narmoon-glow"
          cx={OX}
          cy={OY}
          rx="420"
          ry="230"
          fill="url(#nm-core)"
          style={{ animation: "narmoon-glow 7s ease-in-out infinite" }}
        />

        {RAYS.map((r, i) => {
          const d = pathFor(r);
          const color = r.tone === "gain" ? "var(--color-gain)" : "var(--color-gold)";
          return (
            <g key={i}>
              {/* خط پایه */}
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={r.w}
                strokeOpacity={r.o}
                strokeLinecap="round"
              />
              {/* نبض نور در حال سفر */}
              <path
                className="narmoon-ray"
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={r.w + 0.9}
                strokeLinecap="round"
                strokeDasharray="120 1500"
                style={{
                  animation: `narmoon-ray 6.5s linear ${r.delay} infinite`,
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
