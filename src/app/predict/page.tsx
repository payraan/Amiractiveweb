import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PredictCycle from "@/components/predict/PredictCycle";
import PredictBoard from "@/components/predict/PredictBoard";
import Leaderboard from "@/components/predict/Leaderboard";
import CreditStore from "@/components/predict/CreditStore";
import { getAllMarket } from "@/lib/market";
import { settleDueRounds } from "@/lib/settle";

export const metadata: Metadata = {
  title: "پیش‌بینی قیمت بیت‌کوین و طلا | امیراکتیو",
  description:
    "قیمت فردای بیت‌کوین و طلا را پیش‌بینی کنید، بر اساس دقت امتیاز بگیرید و در لیدربورد امیراکتیو بالا بروید — رایگان.",
};

export const dynamic = "force-dynamic";

const SCORE_ROWS = [
  { label: "خطای زیر ۰.۱٪", value: "+۱۰۰", tone: "text-gain" },
  { label: "خطای زیر ۰.۵٪", value: "+۵۰", tone: "text-gain" },
  { label: "خطای زیر ۱٪", value: "+۲۵", tone: "text-gain" },
  { label: "خطای زیر ۲٪", value: "+۵", tone: "text-gain" },
  { label: "خطای بالای ۲٪", value: "−۱۰", tone: "text-loss" },
  { label: "خطای بالای ۵٪", value: "−۲۵", tone: "text-loss" },
];

const RULES_TEXT = [
  "هر روز برای بیت‌کوین و طلا راند پیش‌بینی برگزار می‌شود. کافی است حدس خود از قیمت آینده را وارد کنید.",
  "چهار تایم‌فریم دارید: ۲۴ ساعته (رایگان، تا ۲ بار در روز)، و ۱۲، ۴ و ۱ ساعته که با کردیت باز می‌شوند. تایم‌فریم ۱ ساعته روزی یک بار.",
  "پس از بسته‌شدن راند، قیمت واقعی همان لحظه ثبت می‌شود و بر اساس دقت شما امتیاز می‌گیرید یا از دست می‌دهید.",
  "امتیاز در همه‌ی تایم‌فریم‌ها یکسان است؛ تایم‌فریم کوتاه‌تر فقط چالش بیشتری برای دقت شماست.",
  "امتیاز فقط از دقت شما می‌آید و با پول خرید و فروش نمی‌شود؛ همین امتیاز، جایگاه شما در لیدربورد را می‌سازد.",
  "کردیت با تتر (USDT) و از طریق پشتیبانی خریداری می‌شود و تنها قابلیت‌ها را باز می‌کند (تایم‌فریم کوتاه‌تر و پیش‌بینی بیشتر) — نه رتبه و نه جایزه.",
  "نفرات برتر لیدربورد ماهانه، اشتراک ربات و حساب‌های معاملاتی جایزه می‌گیرند. رقابت بر پایه‌ی مهارت است، نه شانس.",
  "بازار طلا در تعطیلات آخر هفته بسته است؛ در این روزها فقط راندهای بیت‌کوین فعال‌اند.",
];

export default async function PredictPage() {
  // lazy settlement: settle any due rounds on page load (no external cron needed)
  settleDueRounds().catch(() => {});
  const { btc, xau } = await getAllMarket();

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          PREDICTION GAME
        </span>

        <h1 className="mt-4 max-w-2xl text-balance font-display text-3xl font-black leading-[1.4] md:text-5xl md:leading-[1.3]">
          قیمت فردا را <span className="text-gold">پیش‌بینی کن</span>
        </h1>

        <p className="mt-4 max-w-xl leading-8 text-muted">
          هر روز یک راند برای بیت‌کوین و یک راند برای طلا. تا ساعت ۲۱:۰۰ تهران
          حدس خودت را ثبت کن؛ فردا همان ساعت، قیمت واقعی ثبت می‌شود و
          دقیق‌ترین‌ها امتیاز می‌گیرند.
        </p>

        <div className="mt-10">
          <PredictCycle />
        </div>

        <div className="mt-8">
          <PredictBoard btc={btc} xau={xau} />
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-surface/40 p-6">
          <h2 className="text-sm font-bold">امتیازدهی بر اساس دقت</h2>
          <p className="mt-2 text-[11px] leading-6 text-muted">
            هرچه پیش‌بینی به قیمت واقعی نزدیک‌تر باشد، امتیاز بیشتر؛ خطای زیاد
            امتیاز منفی دارد. این امتیازها در همه‌ی تایم‌فریم‌ها یکسان است.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {SCORE_ROWS.map((r) => (
              <div
                key={r.label}
                className="rounded-xl border border-line bg-raised/50 px-4 py-3 text-center"
              >
                <div className="text-[11px] text-muted">{r.label}</div>
                <div className={`mt-1 font-mono text-lg font-extrabold ${r.tone}`} dir="ltr">
                  {r.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface/40 p-6">
          <h2 className="text-sm font-bold">قوانین بازی به زبان ساده</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {RULES_TEXT.map((t, i) => (
              <li key={i} className="flex gap-3 text-xs leading-7 text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-[11px] text-muted">
            <span>سوالی دارید؟</span>
            <a
              href="https://t.me/Amiractive_support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold transition hover:text-gold-deep"
            >
              پشتیبانی در تلگرام
            </a>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 font-display text-xl font-black">لیدربورد</h2>
          <Leaderboard defaultRange="monthly" limit={10} />
        </div>

        <div className="mt-12">
          <CreditStore />
        </div>
      </main>
      <Footer />
    </>
  );
}
