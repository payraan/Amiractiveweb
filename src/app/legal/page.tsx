import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Legal from "@/components/Legal";

export const metadata: Metadata = {
  title: "قوانین و مقررات | نارمون",
  description:
    "شرایط استفاده، افشای ریسک و سلب مسئولیت نارمون، شامل قواعد بازار ایران، کیف پول تتر و چالش پراپ.",
};

export default function LegalPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="pt-20">
        <Legal />
      </main>
      <Footer />
    </>
  );
}
