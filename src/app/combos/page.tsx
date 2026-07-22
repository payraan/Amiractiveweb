import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ComboBuilder from "@/components/predict/ComboBuilder";
import { settleCombosDue } from "@/lib/combos";

export const metadata: Metadata = {
  title: "کمبو | امیراکتیو",
  description:
    "چند پیش‌بینی را در یک تیکت ترکیب کنید؛ اگر همه درست باشند امتیاز چندبرابر می‌گیرید.",
};

export const dynamic = "force-dynamic";

export default function CombosPage() {
  settleCombosDue().catch(() => {});

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          COMBO TICKETS
        </span>
        <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">
          کمبو <span className="text-gold">پیش‌بینی</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-8 text-muted">
          چند پیش‌بینی را در یک تیکت جمع کنید. سخت‌تر است، اما اگر همه درست
          دربیایند، امتیاز به‌مراتب بزرگ‌تری می‌گیرید.
        </p>

        <div className="mt-10">
          <ComboBuilder />
        </div>
      </main>
      <Footer />
    </>
  );
}
