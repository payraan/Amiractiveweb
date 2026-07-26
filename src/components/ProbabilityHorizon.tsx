/**
 * بادبزن احتمال با کره‌ی زمین — امضای بصری نارمون.
 * کره (رویدادهای جهان) مثل سیاره‌ای روی افق در پایین می‌نشیند و پرتوها
 * (آینده‌های ممکن) از قله‌ی آن به بالا باز می‌شوند. کارتِ بازارِ زنده
 * (در Hero) با فاصله بالای قله‌ی کره شناور است. تماماً SVG و CSS،
 * بدون کتابخانه و بدون هزینه‌ی جاوااسکریپت — امن برای مخاطب کندِ ایران.
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
  { dx: -1020, dy: -520, w: 1.0, o: 0.08, delay: "0s", tone: "gold" },
  { dx: -760, dy: -700, w: 1.3, o: 0.13, delay: "1.9s", tone: "gold" },
  { dx: -500, dy: -820, w: 1.1, o: 0.1, delay: "3.6s", tone: "gain" },
  { dx: -250, dy: -900, w: 1.7, o: 0.18, delay: "1.0s", tone: "gold" },
  { dx: 0, dy: -940, w: 2.1, o: 0.26, delay: "2.6s", tone: "gold" },
  { dx: 250, dy: -900, w: 1.7, o: 0.18, delay: "4.1s", tone: "gold" },
  { dx: 500, dy: -820, w: 1.1, o: 0.1, delay: "1.4s", tone: "gain" },
  { dx: 760, dy: -700, w: 1.3, o: 0.13, delay: "3.1s", tone: "gold" },
  { dx: 1020, dy: -520, w: 1.0, o: 0.08, delay: "4.8s", tone: "gold" },
];

const OX = 600;
const OY = 990; // مرکز کره پایین‌تر رفت تا کره زیرِ کارتِ شناور بنشیند
const R = 190;

function pathFor(r: Ray): string {
  // پرتوها از قله‌ی کره (بالاترین نقطه‌ی افق) شروع می‌شوند
  const sx = OX;
  const sy = OY - R;
  const cx = sx + r.dx * 0.26;
  const cy = sy + r.dy * 0.78;
  return `M${sx},${sy} Q${cx.toFixed(0)},${cy.toFixed(0)} ${OX + r.dx},${OY + r.dy}`;
}

// نصف‌النهارهای کمتر و نازک‌تر تا کره تمیزتر و کم‌شلوغ‌تر باشد
const MERIDIAN_DELAYS = ["0s", "-6s", "-12s"];

// مدارها (خطوط عرضی) — نسبت به شعاع، ملایم
const PARALLELS = [-0.5, -0.25, 0, 0.25, 0.5];

export default function ProbabilityHorizon() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* هاله‌ی طلایی نرم پشت هیرو */}
      <div
        className="narmoon-glow absolute inset-x-0 top-0 h-[440px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(232,196,106,0.13), rgba(232,196,106,0.035) 45%, transparent 75%)",
          animation: "narmoon-glow 9s ease-in-out infinite",
        }}
      />

      <svg
        viewBox="0 0 1200 900"
        className="horizon-mask absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="nm-core" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nm-globe" cx="36%" cy="26%" r="82%">
            <stop offset="0%" stopColor="#2b2b36" />
            <stop offset="55%" stopColor="#16161d" />
            <stop offset="100%" stopColor="#0b0b10" />
          </radialGradient>
          <radialGradient id="nm-sheen" cx="34%" cy="22%" r="42%">
            <stop offset="0%" stopColor="var(--color-cream)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-cream)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nm-atmos" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="var(--color-gold)" stopOpacity="0" />
            <stop offset="90%" stopColor="var(--color-gold)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </radialGradient>
          <clipPath id="nm-globe-clip">
            <circle cx={OX} cy={OY} r={R} />
          </clipPath>
        </defs>

        {/* هاله‌ی وسیع پشت کره */}
        <ellipse
          className="narmoon-glow"
          cx={OX}
          cy={OY}
          rx="440"
          ry="360"
          fill="url(#nm-core)"
          style={{ animation: "narmoon-glow 7s ease-in-out infinite" }}
        />

        {/* پرتوها — از قله‌ی کره، پشتِ کارت به بالا باز می‌شوند */}
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
                strokeOpacity="0.7"
                strokeLinecap="round"
                strokeDasharray="180 2400"
                style={{ animation: `narmoon-ray 8s linear ${r.delay} infinite` }}
              />
            </g>
          );
        })}

        {/* هاله‌ی اتمسفری بیرونِ کره */}
        <circle cx={OX} cy={OY} r={R + 16} fill="url(#nm-atmos)" />

        {/* بدنه‌ی کره */}
        <g clipPath="url(#nm-globe-clip)">
          <circle cx={OX} cy={OY} r={R} fill="url(#nm-globe)" />

          {/* مدارها (خطوط عرضی ثابت) */}
          {PARALLELS.map((f, i) => {
            const ry = R * Math.cos(Math.asin(f));
            return (
              <ellipse
                key={`par-${i}`}
                cx={OX}
                cy={OY + f * R}
                rx={ry}
                ry={ry * 0.15}
                fill="none"
                stroke="var(--color-gold)"
                strokeOpacity={f === 0 ? 0.34 : 0.16}
                strokeWidth={f === 0 ? 0.9 : 0.6}
              />
            );
          })}

          {/* نصف‌النهارها (خطوط طولی چرخان) */}
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
              strokeWidth="0.6"
              strokeOpacity="0.34"
              style={{ animationDelay: delay }}
              transform={`rotate(${i * 60} ${OX} ${OY})`}
            />
          ))}

          {/* درخششِ نورِ خورشید روی لبه‌ی بالا-چپ */}
          <circle cx={OX} cy={OY} r={R} fill="url(#nm-sheen)" />
        </g>

        {/* لبه‌ی محوِ کره (کل دور) — فقط برای تعریفِ شکل */}
        <circle
          cx={OX}
          cy={OY}
          r={R}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />

        {/* برجستگیِ نور فقط روی قوسِ بالا (خطِ افق) تا با کارت نجنگد */}
        <path
          d={`M${OX - R * 0.82},${OY - R * 0.58} A${R},${R} 0 0 1 ${OX + R * 0.82},${OY - R * 0.58}`}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.62"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
