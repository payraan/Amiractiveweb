import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WalletPanel from "@/components/wallet/WalletPanel";

export const metadata: Metadata = {
  title: "کیف پول | نارمون",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function WalletPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 px-4 pb-16 pt-28 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              WALLET
            </span>
            <h1 className="mt-3 font-display text-3xl font-black">
              کیف <span className="text-gold">پول</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted">
              واریز و برداشت تتر، و تاریخچه‌ی کامل تراکنش‌ها.
            </p>
          </div>
          <WalletPanel />
        </div>
      </main>
      <Footer />
    </>
  );
}
