import type { Metadata } from "next";
import Link from "next/link";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ChallengePanel from "@/components/predict/ChallengePanel";

export const metadata: Metadata = {
  title: "چلنج پراپ | نارمون",
  description:
    "مهارت پیش‌بینی‌ات را ثابت کن و حساب معاملاتی یا حساب پیش‌بینی با پرداخت واقعی بگیر. قوانین کامل، به زبان ساده.",
};

const STEPS = [
  {
    n: "۱",
    t: "حساب بساز و کردیت بگیر",
    d: "ثبت‌نام رایگان است و ۱۰ کردیت هدیه می‌گیری. کردیت بیشتر را می‌توانی بخری، یا از پاداش عضویت گروه و دعوت دوستان و فعالیت در بازارها به دست بیاوری.",
  },
  {
    n: "۲",
    t: "چلنج را انتخاب و شروع کن",
    d: "ورودی چلنج از کردیتت کسر می‌شود. از همان لحظه ۳۰ روز وقت داری و قوانین همان لحظه قفل می‌شوند — وسط راه عوض نمی‌شوند.",
  },
  {
    n: "۳",
    t: "در ترید پیش‌بینی ثبت کن",
    d: "پیش‌بینی‌هایت را از پنل ترید ثبت می‌کنی. لازم نیست جای جدیدی بروی؛ همان بازارهایی که همیشه بازی می‌کنی، حالا در ارزیابی چلنج هم حساب می‌شوند.",
  },
  {
    n: "۴",
    t: "قبول شو و جایزه بگیر",
    d: "پس از رسیدن به هدف و بررسی انسانی، جایزه‌ات را می‌گیری: حساب معاملاتی واقعی نزد بروکر همکار، یا حساب پیش‌بینی با پرداخت کریپتویی.",
  },
];

const RULES = [
  {
    t: "هدف: ۳۰۰ پوینت",
    d: "باید در مجموع ۳۰۰ پوینت مثبت جمع کنی. پوینت از دقت پیش‌بینی می‌آید، نه از تعداد.",
  },
  {
    t: "حداکثر افت: ۱۵۰ پوینت",
    d: "اگر از بالاترین امتیازی که رسیده‌ای ۱۵۰ پوینت پایین بیایی، چلنج تمام می‌شود. این همان چیزی است که مدیریت ریسک را می‌سنجد.",
  },
  {
    t: "سقف ضرر روزانه: ۶۰ پوینت",
    d: "در یک روز نمی‌توانی بیش از ۶۰ پوینت از دست بدهی. جلوی تصمیم‌های احساسی بعد از یک باخت را می‌گیرد.",
  },
  {
    t: "حداقل ۲۵ پیش‌بینی در ۷ روز مختلف",
    d: "نمی‌توانی همه را در یک روز بزنی. باید در چند روز مختلف فعال باشی تا معلوم شود مهارت است نه شانس.",
  },
  {
    t: "قانون ثبات: ۳۵٪",
    d: "هیچ روزی نباید بیش از ۳۵٪ کل سودت را ساخته باشد. یعنی با یک روز خوش‌شانس قبول نمی‌شوی؛ باید مستمر خوب باشی.",
  },
  {
    t: "فقط پیش‌بینی‌های ۲۵٪ تا ۷۵٪",
    d: "شرط‌بستن روی گزینه‌های خیلی بعید یا خیلی محتمل مهارت نشان نمی‌دهد، پس در ارزیابی حساب نمی‌شود.",
  },
  {
    t: "سقف ۵۰ پیش‌بینی محاسبه‌شده",
    d: "فقط ۵۰ پیش‌بینی نخست شمرده می‌شود. یعنی خرید کردیت بیشتر، شانس قبولی نمی‌خرد.",
  },
  {
    t: "مهلت ۳۰ روز",
    d: "از لحظه‌ی شروع. اگر در ۳۰ روز به هدف نرسی، چلنج تمام می‌شود.",
  },
];

export default function ChallengePage() {
  return (
    <>
      <CandleField />
      <Nav />
      <main className="relative z-10 pt-28">
        <section className="px-6 pb-8">
          <div className="mx-auto max-w-4xl text-center">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
              PROP CHALLENGE
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-5xl">
              چلنج <span className="text-gold">پراپ</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted md:text-base">
              اینجا جایی است که مهارت پیش‌بینی‌ات را ثابت می‌کنی و در ازایش
              حساب واقعی می‌گیری. نه قرعه‌کشی است، نه شانس — یک آزمون با
              قوانین روشن که از قبل می‌دانی چیست.
            </p>
          </div>

          {/* چطور کار می‌کند */}
          <div className="mx-auto mt-12 max-w-4xl">
            <h2 className="font-display text-xl font-extrabold">چطور کار می‌کند</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="rounded-2xl border border-line bg-surface/40 p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-xs text-gold">
                      {s.n}
                    </span>
                    <h3 className="text-[13px] font-bold text-cream">{s.t}</h3>
                  </div>
                  <p className="mt-2.5 text-[12px] leading-7 text-muted">{s.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* قوانین */}
          <div className="mx-auto mt-10 max-w-4xl">
            <h2 className="font-display text-xl font-extrabold">
              قوانین، به زبان ساده
            </h2>
            <p className="mt-2 text-[12px] leading-7 text-muted">
              همه‌ی تیرها قوانین یکسان دارند؛ فقط ورودی و جایزه فرق می‌کند.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {RULES.map((r) => (
                <div
                  key={r.t}
                  className="rounded-2xl border border-line bg-surface/40 p-5"
                >
                  <h3 className="text-[13px] font-bold text-gold">{r.t}</h3>
                  <p className="mt-2 text-[12px] leading-7 text-muted">{r.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* چرا این قوانین */}
          <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-gold/30 bg-gold/5 p-6">
            <h2 className="font-display text-lg font-extrabold text-gold">
              چرا این‌قدر سخت‌گیرانه؟
            </h2>
            <p className="mt-3 text-[13px] leading-8 text-muted">
              چون جایزه واقعی است و باید به کسی برسد که واقعاً مهارت دارد. سامانه‌ی
              امتیازدهی نارمون طوری تنظیم شده که حدس کورکورانه به‌طور میانگین
              امتیاز منفی بگیرد. قانون ثبات جلوی قبولی با یک روز خوش‌شانس را
              می‌گیرد، و سقف ۵۰ پیش‌بینی باعث می‌شود خرید کردیت بیشتر هیچ مزیتی
              نسازد. نتیجه این است که قبولی در این چلنج یعنی چیزی، نه اینکه فقط
              پول داده‌ای.
            </p>
          </div>

          {/* تیرها */}
          <div className="mx-auto mt-12 max-w-6xl">
            <h2 className="font-display text-xl font-extrabold">انتخاب چلنج</h2>
            <div className="mt-5">
              <ChallengePanel />
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl text-center">
            <p className="text-[12px] leading-7 text-muted">
              پیش‌بینی‌های چلنج را از پنل ترید ثبت می‌کنی.
            </p>
            <Link
              href="/trade"
              className="mt-4 inline-block rounded-full bg-gold px-8 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
            >
              رفتن به پنل ترید
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
