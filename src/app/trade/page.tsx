import type { Metadata } from "next";
import Nav from "@/components/Nav";
import TradeTerminal from "@/components/predict/TradeTerminal";
import { settlePolyDue } from "@/lib/poly";

export const metadata: Metadata = {
  title: "ترید پیش‌بینی | نارمون",
  description:
    "ترمینال حرفه‌ای بازارهای پیش‌بینی: نمودار احتمال، نردبان بازارهای رویداد و ثبت سریع پیش‌بینی.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ market?: string }> };

export default async function TradePage({ searchParams }: Props) {
  settlePolyDue().catch(() => {});
  const { market } = await searchParams;

  return (
    <>
      <Nav />
      <main className="min-h-screen px-3 pb-8 pt-24 md:px-5">
        <TradeTerminal initialId={market} />
      </main>
    </>
  );
}
