import Link from "next/link";
import ArenaCycle from "@/components/ArenaCycle";

const SUPPORT = "https://t.me/Amiractive_support";
const CHANNEL = "https://t.me/CashflowFactorys";

const TIERS = [
  { label: "$1K", fee: "50◆" },
  { label: "$5K", fee: "150◆" },
  { label: "$10K", fee: "250◆" },
  { label: "$50K", fee: "500◆" },
];

const POINTS = [
  "روی مهم‌ترین رویدادهای جهان — سیاست، کریپتو، اقتصاد، ورزش — پیش‌بینی بله/خیر ثبت کنید؛ ورود رایگان است.",
  "امتیازدهی صفر-انتظار: برد روی گزینه‌ی سخت امتیاز بزرگ می‌دهد و انتخاب گزینه‌های واضح چیزی نمی‌سازد — فقط مهارت.",
  "چلنج پراپ: حساب ۱K تا ۵۰K را با کردیت فعال کنید، در ۳۰ روز هدف پوینتی را بدون عبور از حد افت بزنید.",
  "پاداش هر چلنج، حساب پراپی به اندازه‌ی همان تیر است — از ۱,۰۰۰ تا ۵۰,۰۰۰ دلار. حساب‌های ۱۰۰ تا ۱,۰۰۰ دلاری هم جوایز اکسترای کمپین‌های دوره‌ای‌اند.",
];

export default function ArenaSection() {
  return (
    <section
      id="arena"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-2">
          <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            02 · PREDICTION ARENA
          </span>
          <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
            آرنای <span className="text-gold">پیش‌بینی</span>
          </h2>
          <p className="mt-4 max-w-xl leading-8 text-muted">
            بازارهای بله/خیر روی رویدادهای واقعی جهان — با دیتای زنده‌ی
            پالی‌مارکت، بزرگ‌ترین بازار پیش‌بینی جهان.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {POINTS.map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/arena"
              className="rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
            >
              ورود به آرنای پیش‌بینی
            </Link>
            <Link
              href="/arena#challenge"
              className="rounded-xl border border-line px-7 py-3.5 text-cream transition hover:border-gold hover:text-gold"
            >
              چلنج پراپ
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
            <a
              href={SUPPORT}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-gold"
            >
              پشتیبانی ۲۴ ساعته
            </a>
            <a
              href={CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-gold"
            >
              عضویت در کانال تلگرام
            </a>
          </div>
        </div>

        {/* گرافیک: بازارهای زنده + تیرهای پراپ */}
        <div className="order-1 lg:order-1 rounded-2xl border border-line bg-surface/50 p-6 backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:border-gold/60 hover:shadow-[0_0_28px_rgba(232,196,106,0.14)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10px] text-muted" dir="ltr">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
              </span>
              LIVE MARKETS
            </span>
            <span className="font-mono text-[10px] text-muted" dir="ltr">
              POWERED BY POLYMARKET DATA
            </span>
          </div>

          <div className="mt-5">
            <ArenaCycle />
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="text-[10px] text-muted">چلنج پراپ — ورودی با کردیت:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <span
                  key={t.label}
                  className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-1.5 font-mono text-[11px] text-gold"
                  dir="ltr"
                >
                  {t.label} · {t.fee}
                </span>
              ))}
            </div>
            <div className="mt-3 text-[10px] leading-5 text-muted">
              🏆 پاداش هر چلنج: حساب پراپی به همان اندازه — تا ۵۰,۰۰۰ دلار
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
