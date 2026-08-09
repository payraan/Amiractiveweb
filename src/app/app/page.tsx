import type { Metadata } from "next";
import MiniApp from "@/components/tg/MiniApp";

export const metadata: Metadata = {
  title: "نارمون | مینی‌اپ",
  description: "بازارهای پیش‌بینی نارمون داخل تلگرام.",
  // این صفحه فقط داخل تلگرام معنا دارد و محتوایی برای جست‌وجو ندارد.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AppPage() {
  return <MiniApp />;
}
