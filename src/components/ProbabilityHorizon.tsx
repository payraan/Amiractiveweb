/**
 * بادبزن احتمال با کره‌ی زمین — امضای بصری نارمون.
 * دو لایه‌ی SVG هم‌تراز: لایه‌ی پرتوها ماسک‌دار است (بالا محو می‌شود) و
 * لایه‌ی کره/فریم/جرقه بدون ماسک تا فریمِ طلایی هرگز محو نشود. کارتِ
 * بازارِ زنده (در Hero) با فاصله بالای قله‌ی کره شناور است. تماماً SVG و
 * CSS، بدون کتابخانه و بدون هزینه‌ی جاوااسکریپت — امن برای مخاطب کندِ ایران.
 */

type Ray = {
  dx: number;
  dy: number;
  w: number;
  o: number;
  delay: string;
  tone: "gold" | "gain";
};

// پرتوها یا به بالای کادر می‌رسند یا از لبه‌ی کناری خارج می‌شوند —
// هیچ‌کدام وسطِ صفحه معلق تمام نمی‌شوند.
const RAYS: Ray[] = [
  { dx: -1160, dy: -770, w: 1.0, o: 0.1, delay: "0s", tone: "gold" },
  { dx: -840, dy: -840, w: 1.3, o: 0.14, delay: "-1.9s", tone: "gold" },
  { dx: -540, dy: -965, w: 1.1, o: 0.12, delay: "-3.6s", tone: "gain" },
  { dx: -260, dy: -965, w: 1.7, o: 0.2, delay: "-1.0s", tone: "gold" },
  { dx: 0, dy: -985, w: 2.1, o: 0.28, delay: "-2.6s", tone: "gold" },
  { dx: 260, dy: -965, w: 1.7, o: 0.2, delay: "-4.1s", tone: "gold" },
  { dx: 540, dy: -965, w: 1.1, o: 0.12, delay: "-1.4s", tone: "gain" },
  { dx: 840, dy: -840, w: 1.3, o: 0.14, delay: "-3.1s", tone: "gold" },
  { dx: 1160, dy: -770, w: 1.0, o: 0.1, delay: "-4.8s", tone: "gold" },
];

const OX = 600;
const OY = 990; // مرکز کره — دست‌نخورده نسبت به نسخه‌ی فعلی
const R = 190;
const CROWN_Y = OY - R; // قله‌ی کره؛ روی همین نقطه هم فریم و هم تلاقیِ پرتوها می‌نشیند

// نقاطِ محلِ برخوردِ کره با لبه‌ی پایینِ viewBox (برای کشیدنِ فریمِ کاملِ قوسِ بالا)
const EDGE_DX = Math.sqrt(R * R - (OY - 900) * (OY - 900)); // ~167
const LX = OX - EDGE_DX;
const RX = OX + EDGE_DX;

function pathFor(r: Ray): string {
  const sx = OX;
  const sy = CROWN_Y;
  const cx = sx + r.dx * 0.26;
  const cy = sy + r.dy * 0.78;
  return `M${sx},${sy} Q${cx.toFixed(0)},${cy.toFixed(0)} ${OX + r.dx},${OY + r.dy}`;
}

// تاخیرها عمدا منفی‌اند. با تاخیر مثبت، پرتو تا رسیدن نوبتش انیمیشن را شروع
// نمی‌کند و چون fill-mode ندارد با stroke-dashoffset پیش‌فرض (صفر) رندر می‌شود
// — یعنی یک تکه خطِ ساکن چند ثانیه وسط صفحه می‌ماند و بعد ناگهان راه می‌افتد.
// تاخیر منفی یعنی «انگار این‌قدر از انیمیشن گذشته»، پس همه از فریم اول در حال
// حرکت‌اند و پلکانی هم می‌مانند.
const MERIDIAN_DELAYS = ["0s", "-6s", "-12s"];
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

      {/* لایه‌ی ۱ — پرتوها (ماسک‌دار: بالا نرم محو می‌شود) */}
      <svg
        viewBox="0 0 1200 900"
        className="horizon-mask absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
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
                strokeDasharray="180 2600"
                style={{ animation: `narmoon-ray 8.5s linear ${r.delay} infinite` }}
              />
            </g>
          );
        })}
      </svg>

      {/* لایه‌ی ۲ — کره و فریم و جرقه (بدون ماسک: هرگز محو نمی‌شود) */}
      <svg
        viewBox="0 0 1200 900"
        className="absolute inset-0 h-full w-full"
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
          <radialGradient id="nm-spark" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-cream)" stopOpacity="0.95" />
            <stop offset="30%" stopColor="var(--color-gold)" stopOpacity="0.7" />
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

        {/* هاله‌ی اتمسفری بیرونِ کره */}
        <circle cx={OX} cy={OY} r={R + 16} fill="url(#nm-atmos)" />

        {/* بدنه‌ی کره */}
        <g clipPath="url(#nm-globe-clip)">
          <circle cx={OX} cy={OY} r={R} fill="url(#nm-globe)" />

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

          <circle cx={OX} cy={OY} r={R} fill="url(#nm-sheen)" />
        </g>

        {/* فریمِ کاملِ کره — دورِ کلِ دایره، روشن و یکدست (بخشِ زیرِ لبه‌ی پایین
            به‌طور طبیعی بیرون از کادر است، مثل سیاره‌ای روی افق) */}
        <circle
          cx={OX}
          cy={OY}
          r={R}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />
        {/* قوسِ روشنِ افق — از یک لبه‌ی پایین، روی قله، تا لبه‌ی پایینِ دیگر:
            کلِ نیم‌کره‌ی دیده‌شده را کامل می‌پوشاند */}
        <path
          d={`M${LX.toFixed(1)},900 A${R},${R} 0 0 1 ${RX.toFixed(1)},900`}
          fill="none"
          stroke="var(--color-gold)"
          strokeOpacity="0.85"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* جرقه‌ی تلاقیِ پرتوها — روی قله‌ی فریم، با چشمکِ نرم */}
        <circle
          className="narmoon-spark"
          cx={OX}
          cy={CROWN_Y}
          r="46"
          fill="url(#nm-spark)"
        />
      </svg>
    </div>
  );
}
