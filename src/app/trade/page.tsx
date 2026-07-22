import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TradeTerminal from "@/components/predict/TradeTerminal";
import { settlePolyDue } from "@/lib/poly";

export const metadata: Metadata = {
  title: "ترید پیش‌بینی | امیراکتیو",
  description:
    "ترمینال حرفه‌ای بازارهای پیش‌بینی: نمودار احتمال، فهرست زنده‌ی بازارها و ثبت سریع پیش‌بینی.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ market?: string }> };

export default async function TradePage({ searchParams }: Props) {
  settlePolyDue().catch(() => {});
  const { market } = await searchParams;

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
              PREDICTION TERMINAL
            </span>
            <h1 className="mt-3 font-display text-2xl font-black md:text-3xl">
              ترید <span className="text-gold">پیش‌بینی</span>
            </h1>
          </div>
          <p className="max-w-md text-[11px] leading-6 text-muted">
            نمای حرفه‌ای بازارها: نمودار احتمال با بازه‌های مختلف، جستجو و فیلتر
            زنده، و ثبت پیش‌بینی در یک کلیک.
          </p>
        </div>

        <TradeTerminal initialId={market} />
      </main>
      <Footer />
    </>
  );
}
