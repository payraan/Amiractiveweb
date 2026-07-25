/**
 * بادبزن احتمال با کره‌ی زمین — امضای بصری نارمون.
 * کره (رویدادهای جهان) در پایین، و پرتوها (آینده‌های ممکن) از آن به
 * بالا باز می‌شوند. کره با نصف‌النهارهای چرخان توهم چرخش می‌سازد —
 * تماماً SVG و CSS، بدون کتابخانه و بدون هزینه‌ی جاوااسکریپت.
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
const OY = 792; // مرکز کره (کمی بالاتر از لبه‌ی پایین)
const R = 74; // شعاع کره

function pathFor(r: Ray): string {
  // پرتوها از لبه‌ی بالای کره شروع می‌شوند
  const sx = OX;
  const sy = OY - R;
  const cx = sx + r.dx * 0.28;
  const cy = sy + r.dy * 0.76;
  return `M${sx},${sy} Q${cx.toFixed(0)},${cy.toFixed(0)} ${OX + r.dx},${OY + r.dy}`;
}

// نصف‌النهارها با تأخیرهای متفاوت تا چرخش طبیعی به نظر برسد
const MERIDIAN_DELAYS = ["0s", "-3s", "-6s", "-9s", "-12s", "-15s"];

export default function ProbabilityHorizon() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
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
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.22" />
            <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nm-globe" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#2a2a34" />
            <stop offset="70%" stopColor="#15151b" />
            <stop offset="100%" stopColor="#0d0d12" />
          </radialGradient>
          <clipPath id="nm-globe-clip">
            <circle cx={OX} cy={OY} r={R} />
          </clipPath>
        </defs>

        {/* هاله‌ی پشت کره */}
        <ellipse
          className="narmoon-glow"
          cx={OX}
          cy={OY}
          rx="360"
          ry="300"
          fill="url(#nm-core)"
          style={{ animation: "narmoon-glow 7s ease-in-out infinite" }}
        />

        {/* پرتوها */}
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

        {/* کره‌ی زمین */}
        <g clipPath="url(#nm-globe-clip)">
          <circle cx={OX} cy={OY} r={R} fill="url(#nm-globe)" />

          {/* مدارها (خطوط افقی ثابت) */}
          {[-0.66, -0.33, 0, 0.33, 0.66].map((f, i) => {
            const ry = R * Math.cos(Math.asin(f));
            return (
              <ellipse
                key={`par-${i}`}
                cx={OX}
                cy={OY + f * R}
                rx={ry}
                ry={ry * 0.16}
                fill="none"
                stroke="var(--color-gold)"
                strokeOpacity={f === 0 ? 0.5 : 0.28}
                strokeWidth={f === 0 ? 1 : 0.7}
              />
            );
          })}

          {/* نصف‌النهارها (خطوط عمودی چرخان) */}
          {MERIDIAN_DELAYS.map((delay, i) => (
            <ellipse
              key={`mer-${i}`}
              className="narmoon-meridian"
              cx={OX}
              cy={OY}
              rx={R}
              ry={R}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="0.7"
              strokeOpacity="0.5"
              style={{ animationDelay: delay }}
              transform={`rotate(${i * 30} ${OX} ${OY})`}
            />
          ))}
        </g>

        {/* حاشیه‌ی درخشان کره */}
        <circle
          cx={OX}
          cy={OY}
          r={R}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.6"
          strokeWidth="1.2"
        />
        <circle
          cx={OX}
          cy={OY}
          r={R}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.15"
          strokeWidth="6"
        />
      </svg>
    </div>
  );
}
