import Link from "next/link";
import Logo from "@/components/Logo";
import ProbabilityHorizon from "@/components/ProbabilityHorizon";
import { getCuratedMarkets } from "@/lib/poly";

export const dynamic = "force-dynamic";

export default async function Hero() {
  let market: { id: string; question: string; yesPct: number } | null = null;
  let marketCount = 0;

  try {
    const all = await getCuratedMarkets();
    marketCount = all.length;
    const pick = all.find((m) => m.yesPct >= 20 && m.yesPct <= 80) ?? all[0];
    if (pick) {
      market = { id: pick.id, question: pick.question, yesPct: pick.yesPct };
    }
  } catch {
    market = null;
  }

  const yes = market?.yesPct ?? 50;
  const yesWin = Math.max(1, Math.round(100 - yes));
  const noWin = Math.max(1, Math.round(yes));

  return (
    <section className="relative overflow-hidden px-6 pb-40 pt-36 md:pb-52 md:pt-44">
      <ProbabilityHorizon />

      <div className="relative mx-auto max-w-3xl text-center">
        {/* نشان اعتماد */}
        <div className="rise flex justify-center">
          <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface/60 px-4 py-1.5 backdrop-blur">
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

        {/* لوگو با هاله */}
        <div
          className="rise relative mt-12 flex justify-center"
          style={{ animationDelay: "80ms" }}
        >
          <span
            className="pointer-events-none absolute inset-0 -z-10 mx-auto my-auto h-24 w-24 rounded-full bg-gold/25 blur-3xl"
            aria-hidden="true"
          />
          <Logo className="h-20 w-auto md:h-24" />
        </div>

        <h1
          className="rise mt-12 font-display text-5xl font-black leading-[1.28] tracking-tight md:text-7xl"
          style={{ animationDelay: "160ms" }}
        >
          آینده را <span className="text-gold">پیش‌بینی</span> کن،
          <br />
          حساب <span className="text-gold">پراپ</span> بگیر.
        </h1>

        <p
          className="rise mx-auto mt-8 max-w-xl text-base leading-9 text-muted md:text-lg"
          style={{ animationDelay: "240ms" }}
        >
          بازار پیش‌بینی فارسی، با دیتای زنده. امتیاز فقط از مهارت می‌آید — نه
          شانس، نه پول.
        </p>

        <div
          className="rise mt-11 flex flex-wrap items-center justify-center gap-4"
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
            href="/arena#challenge"
            className="rounded-full border border-line px-8 py-4 text-cream transition hover:border-gold/60 hover:text-gold"
          >
            چلنج پراپ
          </Link>
        </div>

        {/* کارت بازار زنده */}
        {market && (
          <div
            className="rise mx-auto mt-20 max-w-md"
            style={{ animationDelay: "430ms" }}
          >
            <Link href={`/trade?market=${market.id}`} className="frame block p-6 text-start">
              <div className="flex items-center justify-between">
                <span
                  className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-muted"
                  dir="ltr"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
                  </span>
                  LIVE MARKET
                </span>
                <span className="font-mono text-[10px] text-muted" dir="ltr">
                  NOW
                </span>
              </div>

              <p className="mt-4 line-clamp-2 text-sm font-bold leading-7" dir="ltr">
                {market.question}
              </p>

              <div className="mt-5">
                <div className="flex justify-between font-mono text-[11px]" dir="ltr">
                  <span className="text-gain">Yes {yes}%</span>
                  <span className="text-loss">
                    No {Math.round((100 - yes) * 10) / 10}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-loss/25">
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{ width: `${yes}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <span className="rounded-lg border border-gain/40 py-2.5 text-center text-gain">
                  بله +{yesWin}
                </span>
                <span className="rounded-lg border border-loss/40 py-2.5 text-center text-loss">
                  خیر +{noWin}
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
