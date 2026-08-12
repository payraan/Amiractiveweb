"use client";

import { useEffect, useState } from "react";
import { showBackButton, haptic } from "@/components/tg/telegram";

// واریز تتر — آدرس از همان /api/wallet می‌آید که کیف پول قبلا گرفته.
//
// آدرس واریز برای هر بازیکن ثابت است (درگاه به ازای همان client_id همیشه
// همان آدرس را برمی‌گرداند)، پس نیازی به گرفتن دوباره‌اش نیست.

export default function DepositScreen({
  address,
  network,
  gatewayReady,
  telegramLinked = true,
  onBack,
}: {
  address: string | null;
  network: string;
  gatewayReady: boolean;
  telegramLinked?: boolean;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => showBackButton(onBack), [onBack]);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      haptic.error();
    }
  }

  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-black text-cream">واریز تتر</h2>
      <p className="mb-4 text-[11px] text-muted">
        شبکه‌ی {network}؛ پس از تأیید شبکه، موجودی خودکار شارژ می‌شود
      </p>

      {!telegramLinked ? (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5 text-center">
          <p className="text-sm font-bold text-gold">اول تلگرامت را وصل کن</p>
          <p className="mt-2 text-[11px] leading-6 text-muted">
            هر عملیات مالی به حساب تلگرام وصل‌شده نیاز دارد. اگر از مینی‌اپ آمده‌ای
            این خودکار انجام شده؛ وگرنه از صفحه‌ی دعوت در سایت وصلش کن.
          </p>
        </div>
      ) : !gatewayReady ? (
        <div className="rounded-2xl border border-loss/40 bg-loss/5 p-5 text-center">
          <p className="text-sm font-bold text-loss">درگاه پرداخت فعال نیست</p>
          <p className="mt-2 text-[11px] leading-6 text-muted">
            کمی بعد دوباره امتحان کن.
          </p>
        </div>
      ) : !address ? (
        <div className="rounded-2xl border border-line bg-surface/40 p-5 text-center">
          <p className="text-[11px] text-muted">آدرس واریز در دسترس نیست.</p>
        </div>
      ) : (
        <>
          {/* هشدار قبل از آدرس، نه بعدش: کاربر آدرس را که دید کپی می‌کند و
              دیگر پایین را نمی‌خواند. */}
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
            <p className="text-[11.5px] leading-6 text-gold">
              فقط <b>تتر (USDT)</b> روی شبکه‌ی <b>{network}</b> بفرست.
            </p>
            <p className="mt-1.5 text-[11px] leading-6 text-muted">
              ارز دیگر یا شبکه‌ی دیگر، برگشت‌ناپذیر از بین می‌رود.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface/40 p-4">
            <div className="text-[10px] text-muted">آدرس واریز شما</div>
            <div
              dir="ltr"
              className="mt-2 break-all rounded-xl bg-ink/60 p-3 text-left font-mono text-[12px] leading-6 text-cream"
            >
              {address}
            </div>
            <button
              type="button"
              onClick={copy}
              className={`mt-3 w-full rounded-xl py-3 font-display text-sm font-extrabold transition ${
                copied ? "bg-gain text-ink" : "bg-gold text-ink"
              }`}
            >
              {copied ? "کپی شد ✓" : "کپی آدرس"}
            </button>
          </div>

          <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-surface/30 p-4 text-[11px] leading-6 text-muted">
            <li>— این آدرس مخصوص حساب توست و همیشه ثابت می‌ماند.</li>
            <li>— شارژ پس از تأیید شبکه خودکار انجام می‌شود؛ نیازی به خبر دادن نیست.</li>
            <li>— بسته به شلوغی شبکه، تأیید چند دقیقه طول می‌کشد.</li>
          </ul>
        </>
      )}
    </div>
  );
}
