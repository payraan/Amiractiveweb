"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, ScreenTitle, Skeleton, SearchBar } from "@/components/tg/ui";
import { matchesQuery } from "@/lib/search";
import { haptic } from "@/components/tg/telegram";
import PulseDetail, { type PulseMarket } from "@/components/tg/screens/PulseDetail";
import { CATEGORIES } from "@/lib/assets";
import { TIMEFRAMES } from "@/lib/game";

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

/** از چند دارایی به بعد فیلد جست‌وجو نشان داده شود. */
const SEARCH_MIN = 8;

export default function PulseScreen() {
  const [cat, setCat] = useState<string>("crypto");
  const [openId, setOpenId] = useState<string | null>(null);
  // بازه پیش از دارایی انتخاب می‌شود — همان ترتیبی که در ذهن کاربر اتفاق
  // می‌افتد. قبلا تایم‌فریم فقط *بعد* از باز کردن دارایی دیده می‌شد، پس
  // برای عوض کردن بازه باید هر بار به عقب برمی‌گشت.
  const [timeframe, setTimeframe] = useState<string>("24h");
  const [q, setQ] = useState("");

  const markets = useResource<{ markets: PulseMarket[] }>(
    `/api/predict/market?category=${cat}`
  );
  const me = useResource<Me>("/api/predict/me");

  const all = markets.data?.markets ?? null;
  // نام فارسی و تیکر لاتین هر دو: کاربر ممکن است «بیت‌کوین» بزند یا «btc».
  const list = all ? all.filter((m) => matchesQuery(q, m.label, m.asset)) : null;
  const open = list?.find((m) => m.asset === openId) ?? null;

  if (open) {
    return (
      <PulseDetail
        market={open}
        me={me.data}
        initialTf={timeframe as Parameters<typeof PulseDetail>[0]["initialTf"]}
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
        subtitle="قیمت آینده را پیش‌بینی کن؛ امتیاز بر اساس دقت تحلیل محاسبه می‌شود، نه شانس"
      />

      {/* ── بازه‌ی پیش‌بینی ────────────────────────────────────
          هزینه‌ی هر بازه روی خودِ دکمه است. قبلا کاربر تا وارد دارایی
          نمی‌شد نمی‌فهمید بازه‌ی یک‌ساعته چهار MOON می‌گیرد. */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] text-muted">بازه‌ی پیش‌بینی</span>
          {/* ⚠️ player جدا از data بررسی می‌شود: روت برای نشستِ نامعتبر
              `{ok:true, player:null}` برمی‌گرداند، پس `me.data` صادق است و
              خواندن `player.credits` کل صفحه را سفید می‌کند. */}
          {me.data?.player && (
            <span className="font-mono text-[10px] text-muted" dir="ltr">
              {me.data.player.credits} MOON
            </span>
          )}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {TIMEFRAMES.map((t) => {
            const on = t.id === timeframe;
            const free = me.data?.freeRemaining?.[t.id] ?? 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  haptic.tap();
                  setTimeframe(t.id);
                }}
                className={`flex-1 shrink-0 rounded-xl border px-2 py-1.5 text-center transition ${
                  on
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-line bg-surface/40 text-muted"
                }`}
              >
                <span className={`block text-[11px] ${on ? "font-bold" : ""}`}>
                  {t.label}
                </span>
                {/* «MOON ۱» به‌جای «۱ MOON» در می‌آمد: عدد و واژه‌ی لاتین
                    داخل ظرف rtl دو اجرای جدا می‌شوند و جایشان عوض می‌شود.
                    فقط همین بخش ltr می‌شود، نه کل دکمه — برچسب فارسی بالای
                    آن باید rtl بماند. */}
                <span
                  dir={free > 0 ? undefined : "ltr"}
                  className="mt-0.5 block text-[8.5px] opacity-80"
                >
                  {free > 0 ? `${free} رایگان` : `${t.cost} MOON`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {(all?.length ?? 0) >= SEARCH_MIN && (
        <SearchBar value={q} onChange={setQ} placeholder="جست‌وجوی دارایی…" />
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
            // «ثبت‌شده» حالا مخصوص همین بازه است، نه هر بازه‌ای.
            //
            // قبلا کاربری که ۲۴ ساعته را ثبت کرده بود، روی بازه‌ی یک‌ساعته
            // هم «ثبت‌شده» می‌دید و فکر می‌کرد کاری از دستش برنمی‌آید —
            // در حالی که هر بازه پیش‌بینی جداگانه‌ی خودش را دارد.
            const done = (me.data?.predicted ?? []).some(
              (p) => p.asset === m.asset && p.timeframe === timeframe
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
                  {done ? (
                    <span className="mt-0.5 inline-block rounded-full border border-gold/30 bg-gold/10 px-1.5 text-[8.5px] text-gold">
                      پیش‌بینی ثبت شده
                    </span>
                  ) : (
                    <span
                      className="block truncate font-mono text-[10px] text-muted"
                      dir="ltr"
                    >
                      {m.asset} / USD
                    </span>
                  )}
                </span>
                <Spark series={m.series} up={up} />
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * نمودار روند — شکل حرکت، نه عدد.
 *
 * «۲.۱٪ منفی» یک عدد است؛ اینکه قیمت آرام پایین آمده یا سقوط کرده و
 * برگشته، یک قضاوت. برای بازی‌ای که تمامش درباره‌ی جهت قیمت است، این
 * مهم‌ترین چیزی بود که در فهرست جا افتاده بود.
 *
 * از ۲۸۸ نقطه فقط ۲۴ تا نمونه‌برداری می‌شود: در ۴۶ پیکسل عرض، بیشترش
 * نه دیده می‌شود و نه ارزش پردازش دارد.
 */
function Spark({ series, up }: { series?: { p: number }[]; up: boolean }) {
  if (!series || series.length < 4) return <span className="w-[46px] shrink-0" />;

  const step = Math.max(1, Math.floor(series.length / 24));
  const pts = series.filter((_, i) => i % step === 0).map((s) => s.p);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * 46;
      const y = 18 - ((p - min) / span) * 16;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width="46"
      height="20"
      viewBox="0 0 46 20"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "var(--color-gain)" : "var(--color-loss)"}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
