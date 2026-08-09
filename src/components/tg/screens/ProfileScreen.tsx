"use client";

import { useResource } from "@/components/tg/useResource";
import { ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { IconExternal } from "@/components/tg/icons";
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
};

const fa = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const num = (n: number) => n.toLocaleString("en-US");

function Metric({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: string;
  tone?: "cream" | "gold" | "gain" | "loss";
}) {
  const c = {
    cream: "text-cream",
    gold: "text-gold",
    gain: "text-gain",
    loss: "text-loss",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-3 py-3 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div dir="ltr" className={`mt-1 font-mono text-[15px] font-bold ${c}`}>
        {value}
      </div>
    </div>
  );
}

export default function ProfileScreen({ siteUrl }: { siteUrl: string }) {
  const { data: p, error, reload } = useResource<Profile>("/api/profile");

  if (error) return <ErrorState message="اطلاعات پروفایل نیامد." onRetry={reload} />;

  if (!p) {
    return (
      <div>
        <ScreenTitle title="پروفایل" />
        <Skeleton className="h-24" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const me = p.player;
  const initial = (me.displayName || "؟").trim().charAt(0);

  return (
    <div>
      <ScreenTitle title="پروفایل" />

      <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface/40 p-4">
        {/* آواتار از حرف اول نام — بدون نیاز به تصویر و بدون حالت خالی */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-xl font-black text-gold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-cream">
            {me.displayName}
          </div>
          {me.username && (
            <div dir="ltr" className="mt-0.5 text-right font-mono text-[11px] text-muted">
              @{me.username}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                me.telegramLinked ? "bg-gain" : "bg-loss"
              }`}
            />
            <span className="text-[10px] text-muted">
              {me.telegramLinked ? "تلگرام وصل است" : "تلگرام وصل نیست"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Metric label="MOON" value={num(me.credits)} tone="gold" />
        <Metric label="تتر" value={`$${me.usdtBalance.toFixed(2)}`} tone="gain" />
        <Metric
          label="امتیاز"
          value={num(me.totalPoints)}
          tone={me.totalPoints >= 0 ? "gain" : "loss"}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Metric label="استریک" value={`${me.streak} روز`} />
        <Metric label="عضویت" value={fa(me.createdAt)} />
      </div>

      {/* نشان‌ها، کارنامه و نمودارها هنوز فقط در سایت‌اند. عمدا با openLink
          باز می‌شود تا از قاب مینی‌اپ بیرون برود، نه داخلش. */}
      <button
        type="button"
        onClick={() => openExternal(`${siteUrl}/profile`)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface/40 py-3.5 text-xs font-bold text-cream transition active:border-gold active:text-gold"
      >
        نشان‌ها و کارنامه‌ی کامل در سایت
        <IconExternal />
      </button>
    </div>
  );
}
