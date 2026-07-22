import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LoginClient from "@/components/LoginClient";

export const metadata: Metadata = {
  title: "ورود / ثبت‌نام | امیراکتیو",
  description:
    "با یک حساب، به همه‌ی بخش‌های امیراکتیو دسترسی دارید: آرنای پیش‌بینی، نبض بازار و لیدربورد.",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-md px-6 pb-24 pt-32">
        <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
          ACCOUNT
        </span>
        <h1 className="mt-4 font-display text-3xl font-black">ورود / ثبت‌نام</h1>
        <p className="mt-3 text-xs leading-7 text-muted">
          با یک حساب، به همه‌ی بخش‌ها دسترسی دارید: آرنای پیش‌بینی، نبض بازار،
          چلنج پراپ و لیدربورد.
        </p>
        <div className="mt-8">
          <LoginClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
