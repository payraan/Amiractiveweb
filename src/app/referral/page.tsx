import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ReferralDashboard from "@/components/predict/ReferralDashboard";

export const metadata: Metadata = {
  title: "دعوت دوستان | امیراکتیو",
  description:
    "دوستان‌تان را دعوت کنید؛ آن‌ها کردیت هدیه می‌گیرند و شما از هر شارژشان پورسانت کردیتی دریافت می‌کنید.",
};

export const dynamic = "force-dynamic";

export default function ReferralPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          REFERRAL PROGRAM
        </span>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">
          دعوت <span className="text-gold">دوستان</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          لینک اختصاصی‌تان را بفرستید. دوست‌تان کردیت هدیه می‌گیرد و شما از هر
          شارژ او پورسانت کردیتی دریافت می‌کنید — بدون سقف.
        </p>

        <div className="mt-10">
          <ReferralDashboard />
        </div>
      </main>
      <Footer />
    </>
  );
}
