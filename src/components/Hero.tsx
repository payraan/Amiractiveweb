import Link from "next/link";

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M21.9 4.3 19 20.1c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.3-7.5c.4-.3-.1-.5-.6-.2L7.5 13.2 3 11.8c-1-.3-1-1 .2-1.4l17.4-6.7c.8-.3 1.5.2 1.3 1.6Z" />
    </svg>
  );
}

const STEPS = [
  { k: "۱", t: "بازار را انتخاب کن", d: "از انتخابات تا بیت‌کوین" },
  { k: "۲", t: "بله یا خیر بزن", d: "پیش‌بینی رایگان روزانه" },
  { k: "۳", t: "امتیاز بگیر", d: "هرچه سخت‌تر، پاداش بیشتر" },
];

export default function Hero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-36 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
      <div>
        <span
          className="rise inline-block font-mono text-[11px] tracking-[0.4em] text-gold"
          dir="ltr"
        >
          PREDICTION MARKETS · PROP CHALLENGE
        </span>

        <h1
          className="rise mt-6 font-display text-4xl font-black leading-[1.25] md:text-6xl"
          style={{ animationDelay: "90ms" }}
        >
          پیش‌بینی کن.
          <br />
          <span className="text-gold">امتیاز</span> بگیر.
          <br />
          <span className="text-gold">پراپ</span> بگیر.
        </h1>

        <p
          className="rise mt-7 max-w-lg text-base leading-9 text-muted"
          style={{ animationDelay: "180ms" }}
        >
          نارمون بازار پیش‌بینی فارسی است. روی رویدادهای واقعی جهان پیش‌بینی
          می‌کنی، امتیازت را مهارت می‌سازد نه شانس — و اگر خوب باشی، حساب پراپ
          می‌گیری.
        </p>

        <div
          className="rise mt-9 flex flex-wrap gap-4"
          style={{ animationDelay: "270ms" }}
        >
          <Link
            href="/trade"
            className="flex items-center gap-2.5 rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink shadow-[0_8px_28px_rgba(232,196,106,0.22)] transition hover:bg-gold-deep hover:shadow-[0_8px_36px_rgba(232,196,106,0.32)]"
          >
            شروع پیش‌بینی
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-4 w-4"
            >
              <path
                d="M19 12H5M12 5l-7 7 7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/arena#challenge"
            className="rounded-xl border border-line px-7 py-3.5 text-cream transition hover:border-gold hover:text-gold"
          >
            چلنج پراپ
          </Link>
          <a
            href="https://t.me/CashflowFactorys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-line px-7 py-3.5 text-cream transition hover:border-gold hover:text-gold"
          >
            <TgIcon />
            تلگرام
          </a>
        </div>

        <div
          className="rise mt-10 flex flex-wrap gap-x-8 gap-y-3"
          style={{ animationDelay: "360ms" }}
        >
          {STEPS.map((s) => (
            <div key={s.k} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                {s.k}
              </span>
              <div>
                <div className="text-xs font-bold text-cream">{s.t}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rise rounded-2xl border border-line bg-surface/50 p-6 backdrop-blur transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_40px_rgba(232,196,106,0.10)]"
        style={{ animationDelay: "220ms" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10px] text-muted"
            dir="ltr"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
            </span>
            LIVE MARKET
          </span>
          <span className="font-mono text-[10px] text-muted" dir="ltr">
            POLYMARKET DATA
          </span>
        </div>

        <h2 className="mt-5 text-base font-bold leading-8" dir="ltr">
          Will Bitcoin close above $70,000 this week?
        </h2>

        <div className="mt-5">
          <div className="flex justify-between font-mono text-xs" dir="ltr">
            <span className="text-gain">Yes 34%</span>
            <span className="text-loss">No 66%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-loss/25">
            <div className="h-full w-[34%] rounded-full bg-gain" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gain/50 bg-gain/10 py-3 text-center">
            <div className="text-sm font-bold text-gain">بله</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted" dir="ltr">
              +66 pts
            </div>
          </div>
          <div className="rounded-xl border border-line py-3 text-center">
            <div className="text-sm font-bold text-muted">خیر</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted" dir="ltr">
              +34 pts
            </div>
          </div>
        </div>

        <p className="mt-4 border-t border-line pt-4 text-[10px] leading-5 text-muted">
          امتیاز برد = ۱۰۰ منهای احتمال گزینه‌ات. انتخاب گزینه‌ی واضح، امتیاز
          نمی‌سازد — فقط بهتر فهمیدن از بازار.
        </p>
      </div>
    </section>
  );
}
