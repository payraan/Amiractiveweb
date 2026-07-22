import Link from "next/link";
import Logo from "@/components/Logo";
import { getCuratedMarkets } from "@/lib/poly";

export const dynamic = "force-dynamic";

export default async function Hero() {
  let market: { question: string; yesPct: number } | null = null;
  try {
    const all = await getCuratedMarkets();
    const pick = all.find((m) => m.yesPct >= 20 && m.yesPct <= 80) ?? all[0];
    if (pick) market = { question: pick.question, yesPct: pick.yesPct };
  } catch {
    market = null;
  }

  const yes = market?.yesPct ?? 50;
  const yesWin = Math.max(1, Math.round(100 - yes));
  const noWin = Math.max(1, Math.round(yes));

  return (
    <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-40 text-center">
      <div className="rise flex justify-center">
        <Logo className="h-16 w-auto md:h-20" />
      </div>

      <h1
        className="rise mt-10 font-display text-4xl font-black leading-[1.35] md:text-6xl"
        style={{ animationDelay: "120ms" }}
      >
        آینده را <span className="text-gold">پیش‌بینی</span> کن،
        <br />
        حساب <span className="text-gold">پراپ</span> بگیر.
      </h1>

      <p
        className="rise mx-auto mt-8 max-w-xl text-base leading-9 text-muted"
        style={{ animationDelay: "220ms" }}
      >
        بازار پیش‌بینی فارسی، با دیتای زنده. امتیاز فقط از مهارت می‌آید — نه
        شانس، نه پول.
      </p>

      <div
        className="rise mt-10 flex flex-wrap justify-center gap-4"
        style={{ animationDelay: "320ms" }}
      >
        <Link
          href="/trade"
          className="rounded-xl bg-gold px-8 py-4 font-display font-extrabold text-ink shadow-[0_8px_32px_rgba(232,196,106,0.25)] transition hover:bg-gold-deep hover:shadow-[0_8px_40px_rgba(232,196,106,0.35)]"
        >
          شروع رایگان
        </Link>
        <Link
          href="/arena#challenge"
          className="rounded-xl border border-line px-8 py-4 text-cream transition hover:border-gold hover:text-gold"
        >
          چلنج پراپ
        </Link>
      </div>

      {market && (
        <div
          className="rise mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface/50 p-6 text-start backdrop-blur transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_40px_rgba(232,196,106,0.10)]"
          style={{ animationDelay: "420ms" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="flex items-center gap-2 font-mono text-[10px] text-muted"
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

          <div className="mt-4">
            <div className="flex justify-between font-mono text-[11px]" dir="ltr">
              <span className="text-gain">Yes {yes}%</span>
              <span className="text-loss">
                No {Math.round((100 - yes) * 10) / 10}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-loss/25">
              <div
                className="h-full rounded-full bg-gain transition-all duration-700"
                style={{ width: `${yes}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px]">
            <span className="rounded-lg border border-gain/40 py-2 text-center text-gain">
              بله +{yesWin}
            </span>
            <span className="rounded-lg border border-loss/40 py-2 text-center text-loss">
              خیر +{noWin}
            </span>
          </div>
        </div>
      )}

      <div
        className="rise mt-14 flex justify-center"
        style={{ animationDelay: "520ms" }}
        aria-hidden="true"
      >
        <span className="flex h-9 w-6 items-start justify-center rounded-full border border-line pt-2">
          <span className="h-1.5 w-1 animate-bounce rounded-full bg-gold" />
        </span>
      </div>
    </section>
  );
}
