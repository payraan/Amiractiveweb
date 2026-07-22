import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ArenaBoard from "@/components/predict/ArenaBoard";
import { settlePolyDue, POLY_FREE_PER_DAY, POLY_EXTRA_COST } from "@/lib/poly";

export const metadata: Metadata = {
  title: "آرنای پیش‌بینی | امیراکتیو",
  description:
    "روی مهم‌ترین رویدادهای جهان پیش‌بینی بله/خیر ثبت کنید، بر اساس سختی پیش‌بینی امتیاز بگیرید و در پراپ پیش‌بینی امیراکتیو جایزه ببرید.",
};

export const dynamic = "force-dynamic";

const PROP_RULES = [
  `ورود رایگان است: هر روز ${POLY_FREE_PER_DAY} پیش‌بینی رایگان دارید و پیش‌بینی‌های بیشتر هر کدام ${POLY_EXTRA_COST} کردیت.`,
  "امتیاز بر اساس سختی پیش‌بینی است: برد = ۱۰۰ منهای احتمال گزینه‌ی شما، باخت = منهای همان احتمال. مثال: برد روی گزینه‌ی ۲۰٪ یعنی +۸۰، باخت یعنی −۲۰.",
  "این یعنی انتخاب گزینه‌های واضح امتیازی نمی‌سازد؛ فقط فهمیدن بهتر از بازار، امتیاز مثبت می‌آورد.",
  "بازارها و احتمال‌ها به‌صورت زنده از پالی‌مارکت — بزرگ‌ترین بازار پیش‌بینی جهان — می‌آیند و پس از اعلام نتیجه‌ی رسمی تسویه می‌شوند.",
  "روی هر بازار فقط یک بار می‌توانید پیش‌بینی ثبت کنید و پس از ثبت قابل تغییر نیست.",
];

const PROP_EVAL = [
  "حداقل ۳۰ پیش‌بینی تسویه‌شده در ماه",
  "امتیاز ماهانه‌ی مثبت (سود از بازار)",
  "قرارگرفتن در رتبه‌های برتر لیدربورد ماهانه",
];

const PROP_PRIZES = [
  "اشتراک ماهانه‌ی ربات معامله‌گر",
  "حساب‌های معاملاتی ۱۰۰، ۲۰۰ و ۵۰۰ دلاری از کمپین بروکرها",
];

export default function ArenaPage() {
  // تسویه‌ی تنبل بازارهای نتیجه‌گرفته
  settlePolyDue().catch(() => {});

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          PREDICTION ARENA · POWERED BY POLYMARKET DATA
        </span>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">
          آرنای پیش‌بینی
        </h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          روی مهم‌ترین رویدادهای جهان — از انتخابات تا کریپتو — پیش‌بینی بله/خیر
          ثبت کنید. امتیاز فقط از درست‌فهمیدنِ سخت‌تر از بازار می‌آید؛ نفرات
          برتر وارد پراپ پیش‌بینی می‌شوند.
        </p>

        <div className="mt-10">
          <ArenaBoard />
        </div>

        <div className="mt-14 rounded-2xl border border-line bg-surface/40 p-6">
          <h2 className="text-sm font-bold">قوانین آرنا</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {PROP_RULES.map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
            <h2 className="text-sm font-bold text-gold">پراپ پیش‌بینی — شرایط ارزیابی ماهانه</h2>
            <ul className="mt-4 flex flex-col gap-2 text-xs leading-7 text-muted">
              {PROP_EVAL.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface/40 p-6">
            <h2 className="text-sm font-bold">جوایز قبول‌شدگان</h2>
            <ul className="mt-4 flex flex-col gap-2 text-xs leading-7 text-muted">
              {PROP_PRIZES.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold">★</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px] leading-5 text-muted">
              امتیاز و رتبه با پول خرید و فروش نمی‌شود؛ جایزه فقط بر اساس مهارت
              است. کردیت تنها ظرفیت پیش‌بینی بیشتر را باز می‌کند.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
