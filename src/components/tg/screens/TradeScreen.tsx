"use client";

import { EmptyState, ScreenTitle } from "@/components/tg/ui";
import { openExternal } from "@/components/tg/telegram";

// ترید (پالی‌مارکت) در مرحله‌ی بعد ساخته می‌شود. تا آن‌وقت این تب صریح
// می‌گوید چه خبر است، به‌جای اینکه خالی یا شکسته به نظر برسد.

export default function TradeScreen({ siteUrl }: { siteUrl: string }) {
  return (
    <div>
      <ScreenTitle title="ترید" subtitle="بازارهای رویداد جهانی — امتیازی" />
      <EmptyState
        title="این بخش هنوز به مینی‌اپ نیامده"
        hint="ترید فعلا در سایت است و با همین حساب کار می‌کند."
      />
      <button
        type="button"
        onClick={() => openExternal(`${siteUrl}/trade`)}
        className="mt-4 w-full rounded-xl border border-line py-3 text-xs font-bold text-cream transition hover:border-gold hover:text-gold"
      >
        باز کردن ترید در سایت ↗
      </button>
    </div>
  );
}
