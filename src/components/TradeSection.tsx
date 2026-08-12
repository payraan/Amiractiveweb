import Link from "next/link";
import ArenaCycle from "@/components/ArenaCycle";

// متن عمدا با «مثال» شروع می‌شود، نه با ویژگی. کاربر تازه‌وارد اول باید
// بفهمد اینجا چه کاری انجام می‌دهد، بعد بداند چه ابزارهایی دارد.
const POINTS = [
  "رقابت با نظر اکثریت: کنار هر سوال مشخص است که چند درصد از مردم چه انتخابی داشته‌اند.",
  "دیتای معتبر و زنده: تمامی اطلاعات به صورت لحظه‌ای از «پالی‌مارکت»، بزرگ‌ترین بازار پیش‌بینی جهان، دریافت می‌شوند.",
  "شفافیت کامل: پیش از ثبت پیش‌بینی، دقیقاً می‌دانید میزان پاداش یا کسر امتیاز شما چقدر است.",
];

export default function TradeSection() {
  return (
    <section id="trade" className="relative mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="font-mono text-[11px] tracking-[0.3em] text-gold">
            ۰۱ · بازار خارجی
          </span>
          <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
            ترید <span className="text-gold">پیش‌بینی</span>
          </h2>
          <p className="mt-4 max-w-xl leading-8 text-muted">
            یک سوال ساده: «بیت‌کوین این هفته به بالای ۷۰ هزار دلار می‌رسد؟»
            شما فقط «بله» یا «خیر» را انتخاب می‌کنید.
          </p>

          <p className="mt-3 max-w-xl text-xs leading-7 text-muted">
            <b className="text-cream">رقابت اصلی کجاست؟</b> هرچه پیش‌بینی شما
            برخلاف نظر اکثریت باشد و درست از آب دربیاید، پاداش بسیار بیشتری
            دریافت می‌کنید!
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
              امتحان کنید، رایگان است
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface/50 p-4 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_28px_rgba(232,196,106,0.12)]">
          <ArenaCycle />
        </div>
      </div>
    </section>
  );
}
