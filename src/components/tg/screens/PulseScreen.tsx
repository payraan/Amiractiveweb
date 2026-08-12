"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";
import PulseDetail, { type PulseMarket } from "@/components/tg/screens/PulseDetail";
import { CATEGORIES } from "@/lib/assets";

// نبض بازار در مینی‌اپ — همان بازی سایت، روی همان روت‌ها.
//
// هیچ روت اختصاصی ساخته نشد: /api/predict/market و /api/predict/me و
// /api/predict/submit هر دو سطح را می‌پذیرند، پس اقتصاد بازی یکی می‌ماند و
// دو پیاده‌سازی که دیر یا زود از هم جدا شوند نداریم.

export type Me = {
  player: { credits: number; totalPoints: number; streak: number };
  predicted: { asset: string; timeframe: string }[];
  // سهمیه‌ی رایگان به تفکیک تایم‌فریم است، نه یک عدد کلی — فقط ۲۴ ساعته
  // سهمیه‌ی رایگان دارد و بقیه همیشه MOON می‌گیرند.
  freeRemaining: Record<string, number>;
};

export default function PulseScreen() {
  const [cat, setCat] = useState<string>("crypto");
  const [openId, setOpenId] = useState<string | null>(null);

  const markets = useResource<{ markets: PulseMarket[] }>(
    `/api/predict/market?category=${cat}`
  );
  const me = useResource<Me>("/api/predict/me");

  const list = markets.data?.markets ?? null;
  const open = list?.find((m) => m.asset === openId) ?? null;

  if (open) {
    return (
      <PulseDetail
        market={open}
        me={me.data}
        onBack={() => setOpenId(null)}
        onDone={() => {
          me.reload();
          markets.reload();
        }}
      />
    );
  }

  return (
    <div>
      <ScreenTitle
        title="نبض بازار"
        subtitle="قیمت آینده را پیش‌بینی کنید؛ امتیاز بر اساس دقت تحلیل محاسبه می‌شود، نه شانس"
      />

      {me.data && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface/40 px-4 py-3">
          <span className="text-[11px] text-muted">
            رایگان امروز (۲۴ ساعته):{" "}
            <b className="text-gold">{me.data.freeRemaining?.["24h"] ?? 0}</b>
          </span>
          <span className="font-mono text-[11px] text-muted" dir="ltr">
            {me.data.player.credits} MOON
          </span>
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => {
          const on = c.id === cat;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setCat(c.id);
              }}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-[11px] transition ${
                on
                  ? "border-gold/60 bg-gold/10 font-bold text-gold"
                  : "border-line text-muted"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {markets.error && (
        <ErrorState message="بازارها نیامدند." onRetry={markets.reload} />
      )}

      {!list && !markets.error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      )}

      {list && (
        <div className="space-y-2">
          {list.map((m) => {
            const up = (m.changePct ?? 0) >= 0;
            const done = (me.data?.predicted ?? []).some(
              (p) => p.asset === m.asset
            );
            return (
              <button
                key={m.asset}
                type="button"
                onClick={() => {
                  haptic.tap();
                  setOpenId(m.asset);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/40 p-3 text-start transition active:bg-surface/70"
              >
                <AssetBadge id={m.asset} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-cream">
                    {m.label}
                  </span>
                  <span
                    className="block truncate font-mono text-[10px] text-muted"
                    dir="ltr"
                  >
                    {m.asset} / USD
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-mono text-[13px] text-cream" dir="ltr">
                    {m.price == null
                      ? "—"
                      : m.price.toLocaleString("en-US", {
                          maximumFractionDigits: m.decimals,
                        })}
                  </span>
                  <span
                    className={`block font-mono text-[10px] ${up ? "text-gain" : "text-loss"}`}
                    dir="ltr"
                  >
                    {m.changePct == null
                      ? ""
                      : `${up ? "+" : ""}${m.changePct.toFixed(2)}%`}
                  </span>
                </span>
                {done && (
                  <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] text-gold">
                    ثبت‌شده
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** همان نشان رنگیِ کارت دارایی در سایت — تیکر، بدون درخواست به CDN بیرونی. */
export function AssetBadge({ id }: { id: string }) {
  let hue = 0;
  for (let i = 0; i < id.length; i++) hue = (hue * 31 + id.charCodeAt(i)) % 360;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-[9px] font-bold"
      style={{
        borderColor: `hsl(${hue} 70% 55% / 0.45)`,
        background: `hsl(${hue} 70% 50% / 0.12)`,
        color: `hsl(${hue} 80% 72%)`,
      }}
      dir="ltr"
      aria-hidden
    >
      {id.replace(/[^A-Za-z0-9]/g, "").slice(0, 4)}
    </span>
  );
}
