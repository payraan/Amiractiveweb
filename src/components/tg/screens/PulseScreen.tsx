"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import {
  Card,
  EmptyState,
  ErrorState,
  ScreenTitle,
  Skeleton,
  SearchBar,
} from "@/components/tg/ui";
import { ASSETS } from "@/lib/assets";
import { matchesQuery } from "@/lib/search";
import { haptic } from "@/components/tg/telegram";
import PulseDetail, { type PulseMarket } from "@/components/tg/screens/PulseDetail";
import { CATEGORIES } from "@/lib/assets";
import { TIMEFRAMES } from "@/lib/game";
import { remaining } from "@/lib/dates";

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
  /** کارنامه‌ی کامل — باز و تسویه‌شده با هم. `points === null` یعنی باز. */
  mine: {
    id: number;
    asset: string;
    timeframe: string;
    guess: number;
    settlePrice: number | null;
    errorPct: number | null;
    points: number | null;
    createdAt: string;
    settleAt: string;
  }[];
  pulse: { points: number; settled: number; open: number };
};

/** از چند دارایی به بعد فیلد جست‌وجو نشان داده شود. */
const SEARCH_MIN = 8;

export default function PulseScreen({
  openAsset = null,
}: {
  /** دارایی‌ای که لینک عمیق اعلان نتیجه به آن اشاره می‌کند. */
  openAsset?: string | null;
}) {
  // ⚠️ دسته هم از خودِ دارایی گرفته می‌شود، نه پیش‌فرض «کریپتو». بدون این،
  // لینک اعلانِ یک دارایی فارکس باز می‌شد ولی چون فهرست فقط کریپتو را
  // می‌آورد، دارایی پیدا نمی‌شد و کاربر روی صفحه‌ی معمولی می‌افتاد — یعنی
  // دکمه بی‌صدا کار نمی‌کرد.
  const [cat, setCat] = useState<string>(
    (openAsset && ASSETS.find((a) => a.id === openAsset)?.category) || "crypto"
  );
  // فقط مقدار اولیه: اگر هر رندر اعمال می‌شد، کاربر بعد از بستنِ دارایی
  // دوباره داخلش پرت می‌شد و هرگز نمی‌توانست برگردد.
  const [openId, setOpenId] = useState<string | null>(openAsset);
  // بازه پیش از دارایی انتخاب می‌شود — همان ترتیبی که در ذهن کاربر اتفاق
  // می‌افتد. قبلا تایم‌فریم فقط *بعد* از باز کردن دارایی دیده می‌شد، پس
  // برای عوض کردن بازه باید هر بار به عقب برمی‌گشت.
  const [timeframe, setTimeframe] = useState<string>("24h");
  const [q, setQ] = useState("");
  // ⚠️ ترید این را داشت و نبض بازار نداشت. کاربری که پیش‌بینی ثبت می‌کرد
  // هیچ راهی نداشت ببیند ثبت شده یا نه، و فکر می‌کرد کار نکرده.
  const [view, setView] = useState<"markets" | "mine">("markets");

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

      <div className="mb-4 flex gap-2 rounded-xl border border-line bg-surface/40 p-1">
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setView("markets");
          }}
          className={`flex-1 rounded-lg px-3 py-2 text-center transition ${
            view === "markets" ? "bg-gold text-ink" : "text-muted"
          }`}
        >
          <span className="block text-[12px] font-bold">دارایی‌ها</span>
          <span className="mt-0.5 block text-[9px] opacity-80">
            {me.data ? `${me.data.freeRemaining?.["24h"] ?? 0} رایگان امروز` : "\u00a0"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setView("mine");
          }}
          className={`flex-1 rounded-lg px-3 py-2 text-center transition ${
            view === "mine" ? "bg-gold text-ink" : "text-muted"
          }`}
        >
          <span className="block text-[12px] font-bold">پیش‌بینی‌های من</span>
          <span className="mt-0.5 block text-[9px] opacity-80">
            {(me.data?.mine?.length ?? 0) > 0
              ? `${me.data!.mine.length} مورد`
              : "هنوز خالی"}
          </span>
        </button>
      </div>

      {view === "mine" && (
        <MyPulse
          me={me.data}
          onOpen={(asset, tf) => {
            setTimeframe(tf);
            setOpenId(asset);
          }}
        />
      )}

      {view === "markets" && (
      <>

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
      </>
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

// ── کارنامه‌ی نبض بازار ──────────────────────────────────────
//
// ⚠️ مجموع امتیازِ نشان‌داده‌شده اینجا **فقط نبض بازار** است، نه
// `total_points` پروفایل. آن یکی جمع هر سه بازی است (نبض بازار + ترید +
// کمبو) و نشان‌دادنش اینجا یعنی کاربر عددی می‌بیند که با فهرست زیرش
// نمی‌خواند — همان سردرگمی‌ای که مالک گزارش کرد.
function MyPulse({
  me,
  onOpen,
}: {
  me: Me | null;
  /** باز کردن همان دارایی و تایم‌فریمِ همان پیش‌بینی. */
  onOpen: (asset: string, timeframe: string) => void;
}) {
  if (!me) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const mine = me.mine ?? [];
  const open = mine.filter((p) => p.points === null);
  const settled = mine.filter((p) => p.points !== null);
  const pts = me.pulse?.points ?? 0;

  const fa = (n: number) => n.toLocaleString("fa-IR");
  const num = (n: number) =>
    n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
              : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const tfLabel = (id: string) =>
    TIMEFRAMES.find((t) => t.id === id)?.label ?? id;
  const assetLabel = (id: string) =>
    ASSETS.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <p
            className={`font-mono text-xl font-black ${
              pts > 0 ? "text-gain" : pts < 0 ? "text-loss" : "text-cream"
            }`}
          >
            {pts > 0 ? "+" : ""}
            {fa(pts)}
          </p>
          <p className="mt-1 text-[10px] text-muted">امتیاز نبض بازار</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-xl font-black text-cream">
            {fa(settled.length)}
          </p>
          <p className="mt-1 text-[10px] text-muted">تسویه‌شده</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-xl font-black text-cream">
            {fa(open.length)}
          </p>
          <p className="mt-1 text-[10px] text-muted">در جریان</p>
        </Card>
      </div>

      {/* ⚠️ حالت خالی اجباری است: فهرستی که فقط با داده رندر شود، برای
          کاربر تازه یعنی «این قابلیت وجود ندارد». */}
      {!mine.length ? (
        <EmptyState
          title="هنوز پیش‌بینی‌ای ثبت نکرده‌ای"
          hint="از تب «دارایی‌ها» یک دارایی را باز کن و قیمت آینده‌اش را حدس بزن."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((p) => {
            const done = p.points !== null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  haptic.tap();
                  onOpen(p.asset, p.timeframe);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface/40 p-4 text-start transition active:bg-surface/70"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-cream">
                    {assetLabel(p.asset)}
                    <span className="mr-1.5 text-[10px] font-normal text-muted">
                      {tfLabel(p.timeframe)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted" dir="ltr">
                    حدس {num(p.guess)}
                    {p.settlePrice !== null && ` → ${num(p.settlePrice)}`}
                  </p>
                  {p.errorPct !== null && (
                    <p className="mt-0.5 text-[10px] text-muted">
                      خطا: {p.errorPct.toFixed(2)}٪
                    </p>
                  )}
                </div>
                {done ? (
                  <span
                    className={`shrink-0 font-mono text-sm font-black ${
                      (p.points ?? 0) > 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {(p.points ?? 0) > 0 ? "+" : ""}
                    {fa(p.points ?? 0)}
                  </span>
                ) : (
                  // ⚠️ «در جریان» به‌تنهایی کافی نیست: کاربر نمی‌داند یک
                  // ساعت دیگر باید سر بزند یا فردا. `settleAt` از همان
                  // روتی می‌آید که کارنامه را می‌دهد.
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
                    {remaining(p.settleAt, "exact")}
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
