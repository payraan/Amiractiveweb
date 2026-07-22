import Link from "next/link";

const POINTS = [
  "نمای حرفه‌ای هر بازار: نمودار احتمال با بازه‌های ۱ روز تا کل تاریخچه، با کراس‌هر تعاملی.",
  "نردبان رویداد: همه‌ی بازارهای یک رویداد کنار هم — با یک کلیک بین‌شان جابه‌جا شو.",
  "ثبت پیش‌بینی از همان صفحه: پاداش و ریسک هر گزینه پیش از ثبت مشخص است.",
  "جستجو و فیلتر زنده روی بیش از صد بازار، مرتب بر اساس نزدیک‌ترین سررسید.",
];

export default function TradeSection() {
  return (
    <section id="trade" className="relative mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            01 · PREDICTION TERMINAL
          </span>
          <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
            ترید <span className="text-gold">پیش‌بینی</span>
          </h2>
          <p className="mt-4 max-w-xl leading-8 text-muted">
            ترمینال کامل بازارهای پیش‌بینی — همان تجربه‌ای که از یک پلتفرم
            حرفه‌ای انتظار داری، به فارسی.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {POINTS.map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/trade"
              className="rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
            >
              ورود به ترمینال
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface/50 transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_32px_rgba(232,196,106,0.10)]">
          <div className="flex items-center gap-1 border-b border-line px-3 py-2">
            {["1D", "1W", "1M", "ALL"].map((t, i) => (
              <span
                key={t}
                className={`rounded px-2.5 py-1 font-mono text-[10px] ${
                  i === 1 ? "bg-gold/15 text-gold" : "text-muted"
                }`}
                dir="ltr"
              >
                {t}
              </span>
            ))}
            <span className="ms-auto flex items-center gap-1.5 font-mono text-[9px] text-muted" dir="ltr">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
              </span>
              LIVE
            </span>
          </div>

          <div className="relative p-4">
            <svg viewBox="0 0 400 130" className="h-[130px] w-full" preserveAspectRatio="none">
              <path
                d="M0,95 L40,88 L80,96 L120,72 L160,78 L200,58 L240,64 L280,42 L320,48 L360,30 L400,34 L400,130 L0,130 Z"
                fill="rgba(232,196,106,0.08)"
              />
              <path
                d="M0,95 L40,88 L80,96 L120,72 L160,78 L200,58 L240,64 L280,42 L320,48 L360,30 L400,34"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2"
              />
            </svg>
            <span className="absolute end-5 top-5 font-mono text-xl font-bold text-gold" dir="ltr">
              68%
            </span>
          </div>

          <div className="border-t border-line">
            {[
              { q: "above $70,000", p: 68 },
              { q: "above $75,000", p: 41 },
              { q: "above $80,000", p: 19 },
            ].map((r, i) => (
              <div
                key={r.q}
                className={`relative flex items-center justify-between px-4 py-2.5 ${
                  i === 0 ? "bg-gold/10" : ""
                }`}
              >
                <span
                  className="absolute inset-y-0 start-0 bg-gain/10"
                  style={{ width: `${r.p}%` }}
                />
                <span className="relative font-mono text-[10px] text-muted" dir="ltr">
                  {r.q}
                </span>
                <span
                  className={`relative font-mono text-[11px] font-bold ${
                    r.p >= 50 ? "text-gain" : "text-loss"
                  }`}
                  dir="ltr"
                >
                  {r.p}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
