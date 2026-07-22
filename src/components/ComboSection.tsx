import Link from "next/link";

export default function ComboSection() {
  return (
    <section id="combo" className="relative mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1 rounded-2xl border border-line bg-surface/50 p-6 transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_32px_rgba(232,196,106,0.10)]">
          <div className="flex flex-col gap-2">
            {[
              { q: "Bitcoin above $70K", c: "بله", p: "62%" },
              { q: "Fed cuts rates in Sept", c: "خیر", p: "55%" },
              { q: "Lakers win the title", c: "بله", p: "48%" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                  {i + 1}
                </span>
                <span className="line-clamp-1 flex-1 text-[11px] text-muted" dir="ltr">
                  {l.q}
                </span>
                <span className={`shrink-0 text-xs font-bold ${l.c === "بله" ? "text-gain" : "text-loss"}`}>
                  {l.c}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted" dir="ltr">
                  {l.p}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted">شانس برد تیکت</span>
              <span className="font-mono font-bold text-cream" dir="ltr">
                16.4%
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[11px]">
              <span className="text-muted">اگر همه درست باشند</span>
              <span className="font-mono font-bold text-gain" dir="ltr">
                +251
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[11px]">
              <span className="text-muted">اگر یکی اشتباه باشد</span>
              <span className="font-mono font-bold text-loss" dir="ltr">
                −49
              </span>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            04 · COMBO TICKETS
          </span>
          <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
            کمبو <span className="text-gold">پیش‌بینی</span>
          </h2>
          <p className="mt-4 max-w-xl leading-8 text-muted">
            چند پیش‌بینی را در یک تیکت جمع کن. تیکت فقط وقتی برنده است که همه‌ی
            انتخاب‌ها درست باشند — سخت‌تر، اما پاداشش چندبرابر.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {[
              "بین ۲ تا ۵ بازار را در یک تیکت ترکیب کن.",
              "شانس برد تیکت، حاصل‌ضرب شانس تک‌تک انتخاب‌هاست — پس پاداش هم به همان نسبت بزرگ‌تر.",
              "هر روز یک کمبوی رایگان داری؛ کمبوهای بعدی با کردیت.",
            ].map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href="/combos"
              className="inline-block rounded-xl bg-gold px-7 py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep"
            >
              ساخت کمبو
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
