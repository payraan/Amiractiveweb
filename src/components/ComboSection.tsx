import Link from "next/link";
import ComboCycle from "@/components/ComboCycle";

export default function ComboSection() {
  return (
    <section id="combo" className="relative mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1 rounded-2xl border border-line bg-surface/50 p-6 transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_32px_rgba(232,196,106,0.10)]">
          <ComboCycle />
        </div>

        <div className="order-1 lg:order-2">
          <span className="font-mono text-[11px] tracking-[0.3em] text-gold">
            ۰۳ · کمبو
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
              "هر روز یک کمبوی رایگان داری؛ کمبوهای بعدی با MOON.",
            ].map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href="/trade?tab=combo"
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
