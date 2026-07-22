import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MarketView from "@/components/predict/MarketView";
import { getCuratedMarkets, findMarket } from "@/lib/poly";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const market = findMarket(await getCuratedMarkets(), id);
  const title = market
    ? `${market.question} | آرنای پیش‌بینی امیراکتیو`
    : "آرنای پیش‌بینی | امیراکتیو";
  const description = market
    ? `Yes ${market.yesPct}% — روی این بازار پیش‌بینی ثبت کنید و بر اساس مهارت امتیاز بگیرید.`
    : "روی مهم‌ترین رویدادهای جهان پیش‌بینی بله/خیر ثبت کنید.";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MarketPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          PREDICTION MARKET
        </span>
        <div className="mt-6">
          <MarketView id={id} />
        </div>
      </main>
      <Footer />
    </>
  );
}
