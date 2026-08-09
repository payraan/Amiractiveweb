"use client";

import { useResource } from "@/components/tg/useResource";
import { Card, ErrorState, ScreenTitle, Skeleton, Stat } from "@/components/tg/ui";
import { openExternal } from "@/components/tg/telegram";

// پروفایل — از همان /api/profile سایت.

type Profile = {
  player: {
    username: string | null;
    displayName: string;
    credits: number;
    totalPoints: number;
    streak: number;
    usdtBalance: number;
    createdAt: string;
    telegramLinked: boolean;
  };
  wallet?: { deposited: number; withdrawn: number };
};

const fa = (iso: string) =>
  new Date(iso).toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function ProfileScreen({ siteUrl }: { siteUrl: string }) {
  const { data: p, error, reload } = useResource<Profile>("/api/profile");

  if (error) return <ErrorState message="اطلاعات پروفایل نیامد." onRetry={reload} />;

  if (!p) {
    return (
      <div>
        <ScreenTitle title="پروفایل" />
        <Skeleton className="h-20" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const me = p.player;

  return (
    <div>
      <ScreenTitle title="پروفایل" />

      <Card>
        <div className="text-sm font-bold text-cream">{me.displayName}</div>
        {me.username && (
          <div dir="ltr" className="mt-1 text-right font-mono text-[11px] text-muted">
            @{me.username}
          </div>
        )}
        <div className="mt-2 text-[10px] text-muted">عضویت از {fa(me.createdAt)}</div>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="MOON" value={String(me.credits)} tone="gold" />
        <Stat label="تتر" value={`$${me.usdtBalance.toFixed(2)}`} tone="gain" />
        <Stat
          label="امتیاز"
          value={String(me.totalPoints)}
          tone={me.totalPoints >= 0 ? "gain" : "loss"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="استریک" value={`${me.streak} روز`} />
        <Stat
          label="تلگرام"
          value={me.telegramLinked ? "وصل" : "وصل نیست"}
          tone={me.telegramLinked ? "gain" : "loss"}
        />
      </div>

      {/* نشان‌ها، کارنامه و نمودارها هنوز فقط در سایت‌اند. لینک بیرونی عمدا
          با openLink باز می‌شود تا از قاب مینی‌اپ بیرون برود، نه داخلش. */}
      <button
        type="button"
        onClick={() => openExternal(`${siteUrl}/profile`)}
        className="mt-5 w-full rounded-xl border border-line py-3 text-xs font-bold text-cream transition hover:border-gold hover:text-gold"
      >
        نشان‌ها و کارنامه‌ی کامل در سایت ↗
      </button>
    </div>
  );
}
