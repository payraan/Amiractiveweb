"use client";

import { CREDIT_PACKS, SUPPORT_TG } from "@/lib/game";

function buyLink(credits: number, priceUsdt: number) {
  const msg = `سلام، می‌خواهم بسته‌ی ${credits} کردیت (${priceUsdt} تتر) را برای بازی پیش‌بینی امیراکتیو خریداری کنم.`;
  return `${SUPPORT_TG}?text=${encodeURIComponent(msg)}`;
}

export default function CreditStore() {
  return (
    <section id="credits" className="scroll-mt-10">
      <h2 className="font-display text-xl font-black">خرید کردیت</h2>
      <p className="mt-2 max-w-xl text-xs leading-6 text-muted">
        کردیت، تایم‌فریم‌های کوتاه‌تر و پیش‌بینی‌های بیشتر را باز می‌کند. کردیت
        فقط قابلیت می‌خرد، نه امتیاز و نه رتبه — جایگاه شما همیشه با مهارت
        ساخته می‌شود.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREDIT_PACKS.map((pack) => {
          const perCredit = pack.priceUsdt / pack.credits;
          return (
            <div
              key={pack.id}
              className={`card-hover relative flex flex-col rounded-2xl border p-5 ${
                pack.badge
                  ? "border-gold/50 bg-surface/70 backdrop-blur"
                  : "border-line bg-surface/40"
              }`}
            >
              {pack.badge && (
                <span className="absolute -top-3 right-5 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-ink">
                  {pack.badge}
                </span>
              )}

              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-gold" dir="ltr">
                  {pack.credits}
                </span>
                <span className="text-sm text-muted">◆ کردیت</span>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold" dir="ltr">
                  {pack.priceUsdt}
                </span>
                <span className="text-xs text-muted">تتر (USDT)</span>
              </div>

              <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
                ~{perCredit.toFixed(2)} USDT / credit
              </div>

              <a
                href={buyLink(pack.credits, pack.priceUsdt)}
                target="_blank"
                rel="noopener noreferrer"
                className={`no-zoom mt-5 block rounded-xl py-3 text-center font-display text-sm font-extrabold transition ${
                  pack.badge
                    ? "bg-gold text-ink hover:bg-gold-deep"
                    : "border border-line text-cream hover:border-gold hover:text-gold"
                }`}
              >
                خرید
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-raised/40 p-5">
        <h3 className="text-sm font-bold">چطور خرید کنم؟</h3>
        <ol className="mt-3 flex flex-col gap-2 text-xs leading-6 text-muted">
          <li>۱. بسته‌ی موردنظر را انتخاب و روی «خرید» بزنید.</li>
          <li>۲. به پشتیبانی تلگرام هدایت می‌شوید و آدرس کیف پول تتر را می‌گیرید.</li>
          <li>۳. مبلغ را با تتر (شبکه TRC20) پرداخت و رسید تراکنش را ارسال کنید.</li>
          <li>۴. پس از تأیید، کردیت شما به‌صورت دستی و سریع شارژ می‌شود.</li>
        </ol>
      </div>
    </section>
  );
}
