import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ProposeForm from "@/components/iran/ProposeForm";

export const metadata: Metadata = {
  title: "پیشنهاد بازار | بازار ایران نارمون",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProposePage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 px-4 pb-16 pt-28 md:px-6">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-black">
            پیشنهاد <span className="text-gold">بازار جدید</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted">
            رویدادی هست که دوست داری مردم رویش پیش‌بینی کنند؟ پیشنهادش بده.
          </p>
        </div>
        <ProposeForm />
      </main>
      <Footer />
    </>
  );
}
