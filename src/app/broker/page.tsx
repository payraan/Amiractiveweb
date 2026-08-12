import type { Metadata } from "next";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Broker from "@/components/Broker";

export const metadata: Metadata = {
  title: "بروکر (کارگزاری) | نارمون",
  description:
    "بروکرهای همکار برای اجرای ربات معامله‌گر و دریافت حساب جایزه‌ی چالش پراپ.",
};

export default function BrokerPage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 pt-28">
        <section className="px-6 pb-4">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              PARTNER BROKERS
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-5xl">
              بروکر <span className="text-gold">(کارگزاری)</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted md:text-base">
              برای اجرای ربات معامله‌گر و همچنین دریافت حساب جایزه‌ی مسیر
              معاملاتی چالش، به یک حساب نزد بروکر همکار نیاز دارید. شرایط
              معاملاتی، اسپرد و روش برداشت تابع قوانین همان بروکر است، نه نارمون.
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-loss/30 bg-loss/5 p-5">
            <h3 className="text-[13px] font-bold text-loss">
              پیش از افتتاح حساب بخوانید
            </h3>
            <p className="mt-2 text-[12px] leading-7 text-muted">
              نارمون معرف بروکر است و در معاملات شما نقشی ندارد. مسئولیت انتخاب
              بروکر، رعایت قوانین آن و نتیجه‌ی معاملات تماماً با شماست. معامله در
              بازارهای مالی ریسک بالایی دارد و می‌تواند به از دست رفتن کل سرمایه
              منجر شود.
            </p>
          </div>
        </section>

        <Broker />
      </main>
      <Footer />
    </>
  );
}
