import type { Metadata } from "next";
import Nav from "@/components/Nav";
import IranTerminal from "@/components/iran/IranTerminal";

export const metadata: Metadata = {
  title: "بازار ایران | نارمون",
  description:
    "پیش‌بینی روی رویدادهای واقعی ایران در حوزه‌ی اقتصاد، ورزش و اجتماع. برد از استخر شرط‌ها، با برداشت مستقیم به کیف پول.",
};

export const dynamic = "force-dynamic";

export default function IranPage() {
  return (
    // چیدمان عیناً مثل /trade: تمام‌صفحه، بدون هیرو و فوتر، تا ترمینال
    // بازار ایران و ترمینال بازار خارجی یک حس واحد بدهند.
    <>
      <Nav />
      <main className="min-h-screen px-3 pb-8 pt-24 md:px-5">
        <IranTerminal />
      </main>
    </>
  );
}
