import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PredictCycle from "@/components/predict/PredictCycle";
import PredictBoard from "@/components/predict/PredictBoard";
import { getAllMarket } from "@/lib/market";

export const metadata: Metadata = {
  title: "پیش‌بینی قیمت بیت‌کوین و طلا | امیراکتیو",
  description:
    "قیمت فردای بیت‌کوین و طلا را پیش‌بینی کنید، بر اساس دقت امتیاز بگیرید و در لیدربورد امیراکتیو بالا بروید — رایگان.",
};

export const dynamic = "force-dynamic";

const RULES = [
  { label: "خطای زیر ۰.۱٪", value: "۱۰۰ امتیاز" },
  { label: "خطای زیر ۰.۵٪", value: "۵۰ امتیاز" },
  { label: "خطای زیر ۱٪", value: "۲۵ امتیاز" },
  { label: "شرکت در راند", value: "۵ امتیاز" },
];

export default async function PredictPage() {
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
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {RULES.map((r) => (
              <div
                key={r.label}
                className="rounded-xl border border-line bg-raised/50 px-4 py-3 text-center"
              >
                <div className="text-[11px] text-muted">{r.label}</div>
                <div className="mt-1 font-display text-sm font-extrabold text-gold">
                  {r.value}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-6 text-muted">
            روزهای متوالی، امتیاز استریک اضافه می‌آورد. لیدربورد هفتگی هر هفته
            صفر می‌شود تا رقابت و جایزه‌ها همیشه تازه بمانند — بازی کاملاً
            رایگان است.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
