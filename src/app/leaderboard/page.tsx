import type { Metadata } from "next";
import Link from "next/link";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/predict/Leaderboard";

export const metadata: Metadata = {
  title: "لیدربورد پیش‌بینی | نارمون",
  description:
    "رتبه‌بندی دقیق‌ترین پیش‌بینی‌کننده‌های بیت‌کوین و طلا. نفرات برتر ماهانه، اشتراک ربات و حساب معاملاتی جایزه می‌گیرند.",
};

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          LEADERBOARD
        </span>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">
          رتبه‌بندی پیش‌بینی‌کننده‌ها
        </h1>
        <p className="mt-4 max-w-xl leading-8 text-muted">
          امتیازها فقط از دقت پیش‌بینی می‌آید. نفرات برتر لیدربورد ماهانه،
          اشتراک ربات معامله‌گر و حساب‌های معاملاتی جایزه می‌گیرند — رقابت بر
          پایه‌ی مهارت است، نه شانس.
        </p>

        <div className="mt-10">
          <Leaderboard defaultRange="monthly" />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
          <span>می‌خواهید بالا بروید؟</span>
          <Link href="/predict" className="text-gold transition hover:text-gold-deep">
            همین حالا پیش‌بینی کنید
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
