"use client";

import { useEffect, useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { remaining, closingSoon } from "@/lib/dates";
import {
  BackLink, EmptyState, ErrorState, ScreenTitle, Skeleton, Stat } from "@/components/tg/ui";
import { haptic, showBackButton } from "@/components/tg/telegram";

// ── کارنامه‌ی پیش‌بینی‌های بازار ایران، نسخه‌ی مینی‌اپ ─────────
//
// همان روت سایت (`/api/ir/my-bets`) — هیچ روت اختصاصی مینی‌اپی ساخته
// نمی‌شود. تفاوت فقط در چیدمان است: اینجا عمودی و تک‌ستونی، چون صفحه باریک
// است و جدول چهارستونی سایت اینجا خوانده نمی‌شود.

type Bet = {
  marketId: number;
  question: string;
  marketStatus: string;
  closesAt: string;
  voidReason: string | null;
  side: string;
  stake: number;
  demoStake: number;
  status: string;
  payout: number | null;
  net: number | null;
  createdAt: string;
};

type Res = {
  bets: Bet[];
  summary: {
    total: number;
    open: number;
    won: number;
    lost: number;
    lockedStake: number;
    settledStake: number;
    settledReturn: number;
    net: number;
  };
};

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "open", label: "در جریان" },
  { id: "closed", label: "تمام‌شده" },
] as const;

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const signed = (n: number) =>
  `${n >= 0 ? "+" : "−"}$${money(Math.abs(n))}`;

function statusOf(b: Bet): { label: string; cls: string } {
  if (b.status === "won") return { label: "برنده", cls: "text-gain" };
  if (b.status === "lost") return { label: "نتیجه‌ی دیگر", cls: "text-loss" };
  if (b.status === "refunded") return { label: "برگشت خورد", cls: "text-muted" };
  if (b.marketStatus === "settling")
    return { label: "نتیجه ثبت شد، در پنجره‌ی اعتراض", cls: "text-gold" };
  if (b.marketStatus === "locked") return { label: "بسته، منتظر نتیجه", cls: "text-gold" };
  // ⚠️ «در جریان» به‌تنهایی کافی نیست: کاربر نمی‌داند یک ساعت دیگر باید سر
  // بزند یا سه هفته. `closesAt` از قبل در همین روت برمی‌گشت و فقط نمایش
  // داده نمی‌شد.
  return {
    label: remaining(b.closesAt, "exact"),
    cls: closingSoon(b.closesAt) ? "font-bold text-gold" : "text-cream",
  };
}

function voidReasonText(reason: string | null): string {
  if (reason === "low_odds")
    return "بازار باطل شد چون ضریب برنده زیر حد مجاز افتاد — کل مبلغ بدون کسر کارمزد برگشت.";
  if (reason === "no_winners")
    return "هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرده بود — کل مبلغ برگشت.";
  return "بازار باطل شد و کل مبلغ برگشت.";
}

export default function MyBetsScreen({
  onBack,
  onOpenMarket,
}: {
  onBack: () => void;
  onOpenMarket: (id: number) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const { data, error, reload } = useResource<Res>(
    `/api/ir/my-bets?filter=${filter}`
  );

  useEffect(() => showBackButton(onBack), [onBack]);

  return (
    <div>
      <BackLink label={"بازگشت به بازار ایران"} onClick={onBack} />
      <ScreenTitle
        title="پیش‌بینی‌های من"
        subtitle="هرچه گذاشته‌ای و هرچه گرفته‌ای، دقیق"
      />

      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              haptic.tap();
              setFilter(f.id);
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] transition ${
              filter === f.id
                ? "border-gold bg-gold font-bold text-ink"
                : "border-line bg-surface/40 text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message="کارنامه‌ات نیامد." onRetry={reload} />}

      {!error && !data && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {data && (
        <>
          {data.summary.total > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Stat label="در جریان" value={`$${money(data.summary.lockedStake)}`} />
              <Stat
                label="جمع تمام‌شده"
                value={`$${money(data.summary.settledStake)}`}
              />
              <Stat
                label="جمع دریافتی"
                value={`$${money(data.summary.settledReturn)}`}
              />
              <Stat
                label="سود خالص"
                value={signed(data.summary.net)}
                tone={
                  data.summary.net > 0
                    ? "gain"
                    : data.summary.net < 0
                      ? "loss"
                      : undefined
                }
              />
            </div>
          )}

          {data.bets.length === 0 ? (
            <EmptyState
              title={
                filter === "all"
                  ? "هنوز پیش‌بینی نکرده‌ای"
                  : "در این دسته چیزی نیست"
              }
              hint={
                filter === "all"
                  ? "از بازار ایران یک بازار انتخاب کن و اولین پیش‌بینی‌ات را ثبت کن."
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {data.bets.map((b) => {
                const st = statusOf(b);
                return (
                  <button
                    key={`${b.marketId}-${b.createdAt}`}
                    type="button"
                    onClick={() => {
                      haptic.tap();
                      onOpenMarket(b.marketId);
                    }}
                    className="w-full rounded-2xl border border-line bg-surface/40 p-4 text-right"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 flex-1 text-[12px] leading-6 text-cream">
                        {b.question}
                      </p>
                      <span className={`shrink-0 text-[10px] font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <div
                      dir="ltr"
                      className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]"
                    >
                      <span className={b.side === "yes" ? "text-gain" : "text-loss"}>
                        {b.side === "yes" ? "بله" : "خیر"}
                      </span>
                      <span className="text-muted">اصل ${money(b.stake)}</span>
                      {/* سهم بونوس جدا، چون اصلش قابل برداشت نیست */}
                      {b.demoStake > 0 && (
                        <span className="text-gold/80">
                          (${money(b.demoStake)} هدیه)
                        </span>
                      )}
                      {b.payout !== null && (
                        <span className="text-muted">
                          دریافتی ${money(b.payout)}
                        </span>
                      )}
                      {b.net !== null && (
                        <span
                          className={`font-bold ${
                            b.net > 0
                              ? "text-gain"
                              : b.net < 0
                                ? "text-loss"
                                : "text-muted"
                          }`}
                        >
                          {signed(b.net)}
                        </span>
                      )}
                    </div>

                    {b.status === "refunded" && (
                      <p className="mt-1.5 text-[10px] leading-5 text-muted">
                        {voidReasonText(b.voidReason)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
