import Link from "next/link";

/**
 * سکشن پراپ‌فرم روی صفحه‌ی اصلی.
 *
 * برخلاف بقیه‌ی سکشن‌ها که دوستونی و یک‌درمیان چپ/راست‌اند، این یکی عمدا
 * وسط‌چین است و موشن‌گرافیکش عریض زیرش می‌نشیند — چون آخرین حرف صفحه است و
 * باید بایستد، نه اینکه در ریتم قبلی گم شود.
 */

const STEPS = [
  {
    n: "۱",
    t: "انتخاب چالش",
    d: "با MOON وارد چالش شوید و حساب پراپ دلخواهتان را انتخاب کنید.",
  },
  {
    n: "۲",
    t: "همان مسیر همیشگی",
    d: "کار جدیدی لازم نیست؛ پیش‌بینی‌های عادی شما در پلتفرم، مستقیماً برای قبولی در چالش ارزیابی می‌شوند.",
  },
  {
    n: "۳",
    t: "فرصت ۳۰ روزه",
    d: "یک ماه زمان دارید تا با رعایت مدیریت ریسک به هدف تعیین‌شده برسید.",
  },
  {
    n: "۴",
    t: "دریافت حساب واقعی",
    d: "در صورت قبولی، یک حساب با پول واقعی (Real) در بروکر همکار دریافت می‌کنید.",
  },
];

export default function PropSection() {
  return (
    <section
      id="prop"
      className="relative mx-auto max-w-5xl scroll-mt-20 px-6 py-24 text-center"
    >
      <span className="font-mono text-[11px] tracking-[0.3em] text-gold">
        ۰۴ · چالش پراپ
      </span>
      <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
        ارزیابی مهارت، <span className="text-gold">تأمین سرمایه</span>
      </h2>

      <p className="mx-auto mt-5 max-w-2xl leading-8 text-muted">
        آیا تحلیل‌گر قدرتمندی هستید؟ مهارت خود را در پیش‌بینی‌های مستمر و دقیق
        ثابت کنید تا ما تأمین سرمایه واقعی شما را بر عهده بگیریم.
      </p>

      <p className="mx-auto mt-4 max-w-2xl text-xs leading-7 text-muted">
        <b className="text-cream">چرا مستمر؟</b> چون یک موفقیت بزرگ می‌تواند
        حاصل شانس باشد، اما سودآوری در روزهای متوالی، نشان‌دهنده تخصص و مهارت
        شماست.
      </p>

      <PropGraphic />

      <div className="mt-10 grid grid-cols-1 gap-4 text-start sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="no-lift rounded-2xl border border-line bg-surface/40 p-5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 font-mono text-[12px] text-gold">
              {s.n}
            </span>
            <h3 className="mt-3 text-[13px] font-bold text-cream">{s.t}</h3>
            <p className="mt-2 text-[11px] leading-6 text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/challenge"
          className="rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
        >
          دیدن چالش‌ها
        </Link>
        <Link
          href="/trade"
          className="rounded-xl border border-line px-7 py-3.5 text-sm text-cream transition hover:border-gold hover:text-gold"
        >
          اول رایگان تمرین کن
        </Link>
      </div>

      <p className="mx-auto mt-6 max-w-xl text-[10px] leading-6 text-muted">
        ورودی چالش پس از شروع بازگشت‌پذیر نیست. این یک آزمون مهارت است، نه
        شرط‌بندی، و هیچ سود تضمین‌شده‌ای وعده داده نمی‌شود.
      </p>
    </section>
  );
}

/**
 * موشن‌گرافیک عریض: مسیر امتیاز یک نامزد چالش که بالا و پایین می‌رود ولی از
 * «کف افت» رد نمی‌شود و در نهایت به خط هدف می‌رسد. همان چیزی که چالش می‌سنجد.
 */
function PropGraphic() {
  return (
    <div className="no-lift relative mt-10 overflow-hidden rounded-2xl border border-line bg-surface/40">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[10px]">
        <span className="text-muted">مسیر یک چالش ۳۰ روزه</span>
        <span className="flex items-center gap-1.5 text-gain">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
          </span>
          در حال ارزیابی
        </span>
      </div>

      <svg viewBox="0 0 900 220" className="h-[200px] w-full md:h-[240px]">
        {/* خط هدف */}
        <line x1="0" x2="900" y1="42" y2="42" stroke="rgba(62,207,142,0.35)" strokeDasharray="6 8" />
        <text x="12" y="34" fill="#3ecf8e" fontSize="11" fontFamily="monospace">
          TARGET
        </text>

        {/* کف افت */}
        <line x1="0" x2="900" y1="178" y2="178" stroke="rgba(229,72,77,0.35)" strokeDasharray="6 8" />
        <text x="12" y="196" fill="#e5484d" fontSize="11" fontFamily="monospace">
          MAX DRAWDOWN
        </text>

        {/* ناحیه‌ی مجاز */}
        <rect x="0" y="42" width="900" height="136" fill="rgba(232,196,106,0.03)" />

        {/* مسیر امتیاز — با نقاب متحرک کشیده می‌شود */}
        <path
          className="prop-path"
          d="M0,160 L75,146 L150,158 L225,124 L300,138 L375,104 L450,132 L525,92 L600,110 L675,72 L750,84 L825,52 L900,44"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* جرقه‌ی سرِ مسیر */}
        <circle className="prop-dot" r="5" fill="var(--color-gold)">
          <animateMotion
            dur="7s"
            repeatCount="indefinite"
            path="M0,160 L75,146 L150,158 L225,124 L300,138 L375,104 L450,132 L525,92 L600,110 L675,72 L750,84 L825,52 L900,44"
          />
        </circle>
      </svg>
    </div>
  );
}
