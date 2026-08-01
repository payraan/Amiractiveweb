import Link from "next/link";
import Logo from "@/components/Logo";
import ProbabilityHorizon from "@/components/ProbabilityHorizon";
import { getCuratedMarkets } from "@/lib/poly";

export const dynamic = "force-dynamic";

export default async function Hero() {
  let marketCount = 0;

  try {
    const all = await getCuratedMarkets();
    marketCount = all.length;
  } catch {
    marketCount = 0;
  }

  return (
    <section className="relative overflow-hidden px-6 pb-40 pt-24 md:flex md:h-[calc(100svh-2.75rem)] md:min-h-[600px] md:flex-col md:justify-center md:pb-[24vh] md:pt-[8vh]">
      <ProbabilityHorizon />

      <div className="relative mx-auto max-w-3xl text-center">
        {/* نشان اعتماد با قاب نور */}
        <div className="rise flex justify-center">
          <div className="spin-frame">
          <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface/70 px-4 py-1.5 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
            </span>
            <span className="text-[11px] text-muted">
              دیتای زنده از پالی‌مارکت
            </span>
            {marketCount > 0 && (
              <>
                <span className="h-3 w-px bg-line" />
                <span className="font-mono text-[11px] text-gold" dir="ltr">
                  {marketCount} markets
                </span>
              </>
            )}
          </div>
          </div>
        </div>

        {/* لوگو با هاله */}
        <div
          className="rise relative mt-8 flex justify-center"
          style={{ animationDelay: "80ms" }}
        >
          <span
            className="pointer-events-none absolute inset-0 -z-10 mx-auto my-auto h-24 w-24 rounded-full bg-gold/25 blur-3xl"
            aria-hidden="true"
          />
          <Logo className="h-16 w-auto md:h-20" />
        </div>

        {/* تیترِ تک‌خطی */}
        <h1
          className="rise mt-8 font-display text-4xl font-black leading-[1.15] tracking-tight md:text-6xl"
          style={{ animationDelay: "160ms" }}
        >
          آینده را <span className="text-gold">پیش‌بینی</span> کن،{" "}
          <span className="text-gold">پراپ</span> بگیر
        </h1>

        <p
          className="rise mx-auto mt-6 max-w-lg text-sm leading-7 text-muted md:text-base"
          style={{ animationDelay: "240ms" }}
        >
          بازار پیش‌بینی فارسی، با دیتای زنده. امتیاز فقط از مهارت می‌آید — نه
          شانس، نه پول.
        </p>

        <div
          className="rise mt-9 flex flex-wrap items-center justify-center gap-4"
          style={{ animationDelay: "330ms" }}
        >
          <Link
            href="/trade"
            className="group flex items-center gap-3 rounded-full bg-gold py-2 pe-2 ps-7 font-display font-extrabold text-ink shadow-[0_10px_40px_rgba(232,196,106,0.28)] transition hover:bg-gold-deep hover:shadow-[0_10px_48px_rgba(232,196,106,0.4)]"
          >
            شروع رایگان
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/15 transition group-hover:bg-ink/25">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="h-4 w-4"
              >
                <path
                  d="M19 12H5M12 5l-7 7 7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>

          <Link
            href="/challenge"
            className="rounded-full border border-line px-8 py-4 text-cream transition hover:border-gold/60 hover:text-gold"
          >
            چلنج پراپ
          </Link>
        </div>
      </div>
    </section>
  );
}
