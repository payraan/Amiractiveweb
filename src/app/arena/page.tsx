import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ArenaBoard from "@/components/predict/ArenaBoard";
import ChallengePanel from "@/components/predict/ChallengePanel";
import { settlePolyDue, POLY_FREE_PER_DAY, POLY_EXTRA_COST } from "@/lib/poly";
import { settleCombosDue, COMBO_FREE_PER_DAY, COMBO_COST } from "@/lib/combos";

export const metadata: Metadata = {
  title: "آرنای پیش‌بینی | نارمون",
  description:
    "روی مهم‌ترین رویدادهای جهان پیش‌بینی بله/خیر ثبت کنید، بر اساس سختی پیش‌بینی امتیاز بگیرید و در پراپ پیش‌بینی نارمون جایزه ببرید.",
};

export const dynamic = "force-dynamic";

const PROP_RULES = [
  `ورود رایگان است: هر روز ${POLY_FREE_PER_DAY} پیش‌بینی رایگان دارید و پیش‌بینی‌های بیشتر هر کدام ${POLY_EXTRA_COST} کردیت.`,
  "امتیاز بر اساس سختی پیش‌بینی است: برد = ۱۰۰ منهای احتمال گزینه‌ی شما، باخت = منهای همان احتمال. مثال: برد روی گزینه‌ی ۲۰٪ یعنی +۸۰، باخت یعنی −۲۰.",
  "این یعنی انتخاب گزینه‌های واضح امتیازی نمی‌سازد؛ فقط فهمیدن بهتر از بازار، امتیاز مثبت می‌آورد.",
  "بازارها و احتمال‌ها به‌صورت زنده از پالی‌مارکت — بزرگ‌ترین بازار پیش‌بینی جهان — می‌آیند و پس از اعلام نتیجه‌ی رسمی تسویه می‌شوند.",
  "روی هر بازار فقط یک بار می‌توانید پیش‌بینی ثبت کنید و پس از ثبت قابل تغییر نیست.",
  "هر شخص فقط مجاز به یک حساب است؛ پیش‌بینی‌های آینه‌ای یا هماهنگ بین چند حساب، به حذف چلنج و مصادره‌ی ورودی منجر می‌شود.",
  "جوایز چلنج پس از بررسی پشتیبانی و احراز یکتایی حساب پرداخت می‌شوند.",
  `کمبو: می‌توانید ۲ تا ۵ انتخاب را در یک تیکت ترکیب کنید؛ تیکت فقط وقتی برنده است که همه‌ی انتخاب‌ها درست باشند. هر روز ${COMBO_FREE_PER_DAY} کمبوی رایگان دارید و کمبوهای بعدی هر کدام ${COMBO_COST} کردیت است.`,
  "امتیاز کمبو در لیدربورد لحاظ می‌شود اما در ارزیابی چلنج پراپ محاسبه نمی‌شود؛ ارزیابی پراپ فقط بر پایه‌ی پیش‌بینی‌های تکی است.",
];

export default function ArenaPage() {
  // تسویه‌ی تنبل بازارهای نتیجه‌گرفته
  settlePolyDue().catch(() => {});
  settleCombosDue().catch(() => {});

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          PREDICTION ARENA · POWERED BY POLYMARKET DATA
        </span>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">
          آرنای <span className="text-gold">پیش‌بینی</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          روی مهم‌ترین رویدادهای جهان — از انتخابات تا کریپتو — پیش‌بینی بله/خیر
          ثبت کنید. امتیاز فقط از درست‌فهمیدنِ سخت‌تر از بازار می‌آید؛ نفرات
          برتر وارد پراپ پیش‌بینی می‌شوند.
        </p>

        <div className="mt-10">
          <ArenaBoard />
        </div>

        <div className="mt-14 rounded-2xl border border-line bg-surface/40 p-6 transition-all duration-300 hover:scale-[1.01] hover:border-gold/60 hover:shadow-[0_0_24px_rgba(232,196,106,0.12)]">
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

        <div id="challenge" className="mt-14 scroll-mt-10">
          <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
            PREDICTION PROP CHALLENGE
          </span>
          <h2 className="mt-3 font-display text-2xl font-black">چلنج پراپ پیش‌بینی</h2>
          <p className="mt-3 max-w-2xl text-xs leading-7 text-muted">
            حساب پراپ خود را انتخاب کنید، با کردیت فعالش کنید و در ۳۰ روز با
            پیش‌بینی‌های همین آرنا هدف پوینتی را بزنید — بدون عبور از حد افت و
            سقف ضرر روزانه. پاس کنید، جایزه‌ی واقعی بگیرید.
          </p>
          <div className="mt-6">
            <ChallengePanel />
          </div>
        </div>

      </main>
      <Footer />
    </>
  );
}
