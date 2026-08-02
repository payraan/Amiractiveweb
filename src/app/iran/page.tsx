import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import IranTerminal from "@/components/iran/IranTerminal";

export const metadata: Metadata = {
  title: "بازار ایران | نارمون",
  description:
    "پیش‌بینی روی رویدادهای واقعی ایران — اقتصاد، ورزش، اجتماعی. برد از استخر شرط‌ها، با برداشت مستقیم به کیف پول.",
};

export const dynamic = "force-dynamic";

export default function IranPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 px-4 pb-16 pt-28 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              IRAN MARKET
            </span>
            <h1 className="mt-3 font-display text-3xl font-black md:text-4xl">
              بازار <span className="text-gold">ایران</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted">
              روی رویدادهایی که واقعاً برایت مهم‌اند پیش‌بینی کن. بازارها را خود
              کاربران پیشنهاد می‌دهند و پس از بررسی منتشر می‌شوند.
            </p>
          </div>
          <IranTerminal />
        </div>
      </main>
      <Footer />
    </>
  );
}
