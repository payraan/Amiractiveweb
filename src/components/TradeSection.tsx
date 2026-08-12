import Link from "next/link";
import ArenaCycle from "@/components/ArenaCycle";

// متن عمدا با «مثال» شروع می‌شود، نه با ویژگی. کاربر تازه‌وارد اول باید
// بفهمد اینجا چه کاری انجام می‌دهد، بعد بداند چه ابزارهایی دارد.
const POINTS = [
  "می‌بینی جمع چه فکر می‌کند: کنار هر سؤال یک عدد هست. «۶۸٪ بله» یعنی از میان همه‌ی کسانی که پیش‌بینی کرده‌اند، جمع روی «بله» سنگین‌تر است.",
  "نمودار نشان می‌دهد نظر جمع در طول زمان چطور عوض شده: دیروز ۵۸٪ بود، امروز ۷۱٪. همین تغییر، خودش خبر است.",
  "قبل از ثبت می‌بینی چقدر می‌بری و چقدر می‌بازی. هرچه گزینه‌ات کم‌طرفدارتر باشد، برد بیشتری دارد.",
  "بیش از صد بازار زنده، با جستجو و فیلتر، از قیمت بیت‌کوین تا نتیجه‌ی انتخابات.",
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
            یک سؤال ساده می‌بینی: «بیت‌کوین تا آخر هفته بالای ۷۰ هزار دلار
            می‌بندد؟» تو بله یا خیر را انتخاب می‌کنی. اگر درست بگویی امتیاز
            می‌گیری، و هرچه نظرت خلاف جمع بوده و درست دربیایی، امتیاز بیشتری
            می‌گیری.
          </p>

          <p className="mt-3 max-w-xl text-xs leading-7 text-muted">
            <b className="text-cream">چرا این‌طوری؟</b> چون حدس‌زدنِ چیزی که
            همه می‌دانند هنری نیست. اینجا فقط وقتی امتیاز می‌گیری که بهتر از
            جمع فهمیده باشی. بازارها و درصدها زنده از پالی‌مارکت، بزرگ‌ترین
            بازار پیش‌بینی جهان، می‌آیند.
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
              امتحان کن، رایگان است
            </Link>
          </div>
        </div>

        <div className="no-lift overflow-hidden rounded-2xl border border-line bg-surface/50 p-4">
          <ArenaCycle />
        </div>
      </div>
    </section>
  );
}
