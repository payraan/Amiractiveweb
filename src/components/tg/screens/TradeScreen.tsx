"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, EmptyState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";
import TradeDetail, { type PolyMarket } from "@/components/tg/screens/TradeDetail";

// ترید — بازارهای رویداد پالی‌مارکت، از همان روت‌های سایت.
//
// این بخش امتیازی است نه پولی: تتر اینجا جابه‌جا نمی‌شود. MOON فقط وقتی خرج
// می‌شود که سهمیه‌ی رایگان روزانه تمام شده باشد.

type MyPrediction = {
  marketId: string;
  question: string;
  choice: string;
  probPct: number;
  points: number | null;
  status: string;
};

type Me = { freeLeft: number; predictions: MyPrediction[] };

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(Math.round(n));

const SORTS = [
  { id: "hot", label: "پرحجم‌ترین" },
  { id: "closing", label: "نزدیک به پایان" },
  { id: "close", label: "نزدیک به ۵۰٪" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

export default function TradeScreen() {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<SortId>("hot");
  const [hideDone, setHideDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const markets = useResource<{ markets: PolyMarket[] }>("/api/predict/poly-markets");
  const me = useResource<Me>("/api/predict/poly-me");

  const list = markets.data?.markets ?? null;
  const mine = me.data?.predictions ?? [];
  const doneIds = new Set(mine.map((p) => p.marketId));

  const open = list?.find((m) => m.id === openId) ?? null;
  if (open) {
    return (
      <TradeDetail
        market={open}
        freeLeft={me.data?.freeLeft ?? 0}
        already={doneIds.has(open.id)}
        onBack={() => setOpenId(null)}
        onDone={() => {
          setOpenId(null);
          me.reload();
        }}
      />
    );
  }

  // دسته‌ها از خودِ داده ساخته می‌شوند، نه با import از poly.ts — آن فایل به
  // db و در نتیجه pg وابسته است و در باندل کلاینت جا نمی‌شود. کامپوننت ترید
  // سایت هم دقیقا همین کار را می‌کند.
  const cats = Array.from(new Set((list ?? []).map((m) => m.category))).map((id) => ({
    id,
    label: (list ?? []).find((m) => m.category === id)?.categoryLabel ?? id,
  }));

  const shown = (() => {
    if (!list) return null;
    let out = cat === "all" ? [...list] : list.filter((m) => m.category === cat);
    if (hideDone) out = out.filter((m) => !doneIds.has(m.id));
    return out.sort((a, b) => {
      if (sort === "closing") {
        return (
          new Date(a.endDate ?? 0).getTime() - new Date(b.endDate ?? 0).getTime()
        );
      }
      // نزدیک به ۵۰٪ یعنی بازاری که خودِ بازار هم مطمئن نیست — جایی که
      // اختلاف‌نظر بیشترین است و امتیاز دو طرف نزدیک به هم.
      if (sort === "close") {
        return Math.abs(a.yesPct - 50) - Math.abs(b.yesPct - 50);
      }
      return b.volume - a.volume;
    });
  })();

  return (
    <div>
      <ScreenTitle title="ترید" subtitle="بازارهای رویداد جهانی — امتیازی" />

      {me.data && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface/40 px-4 py-3">
          <span className="text-[11px] text-muted">پیش‌بینی رایگان امروز</span>
          <span
            dir="ltr"
            className={`font-mono text-[13px] font-bold ${
              me.data.freeLeft > 0 ? "text-gain" : "text-muted"
            }`}
          >
            {me.data.freeLeft}
          </span>
        </div>
      )}

      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {[{ id: "all", label: "همه" }, ...cats].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              haptic.tap();
              setCat(c.id);
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] transition ${
              cat === c.id
                ? "border-gold bg-gold text-ink font-bold"
                : "border-line bg-surface/40 text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {SORTS.map((sOpt) => (
            <button
              key={sOpt.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setSort(sOpt.id);
              }}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
                sort === sOpt.id
                  ? "border-gold/60 bg-gold/10 text-gold font-bold"
                  : "border-line bg-surface/40 text-muted"
              }`}
            >
              {sOpt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setHideDone((v) => !v);
          }}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
            hideDone
              ? "border-gain/60 bg-gain/10 text-gain font-bold"
              : "border-line bg-surface/40 text-muted"
          }`}
        >
          ثبت‌نشده
        </button>
      </div>

      {markets.error && (
        <ErrorState message="بازارها نیامدند." onRetry={markets.reload} />
      )}

      {!markets.error && list === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {!markets.error && shown?.length === 0 && (
        <EmptyState title="بازاری در این دسته نیست" hint="دسته‌ی دیگری را ببین." />
      )}

      {!markets.error && shown && shown.length > 0 && (
        <div className="flex flex-col gap-3">
          {shown.map((m) => {
            const done = doneIds.has(m.id);
            return (
              <article
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic.press();
                  setOpenId(m.id);
                }}
                className="cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface/40 transition active:border-gold/50"
              >
                <div className="p-4">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[9.5px] text-muted">
                      {m.categoryLabel}
                    </span>
                    {done && (
                      <span className="rounded-full border border-gain/40 bg-gain/10 px-2 py-0.5 text-[9.5px] font-bold text-gain">
                        ثبت شده
                      </span>
                    )}
                    <span className="ms-auto text-[10px] text-muted">
                      حجم{" "}
                      <span dir="ltr" className="font-mono text-cream">
                        ${compact(m.volume)}
                      </span>
                    </span>
                  </div>

                  <p className="text-[13.5px] font-bold leading-[1.9] text-cream">
                    {m.question}
                  </p>

                  <div className="mt-3.5 flex h-7 w-full overflow-hidden rounded-lg bg-raised">
                    <div
                      className="flex items-center bg-gain/25 px-2"
                      style={{ width: `${Math.max(14, Math.min(86, m.yesPct))}%` }}
                    >
                      <span dir="ltr" className="font-mono text-[10px] font-bold text-gain">
                        {m.yesPct}%
                      </span>
                    </div>
                    <div className="flex flex-1 items-center justify-end bg-loss/15 px-2">
                      <span dir="ltr" className="font-mono text-[10px] font-bold text-loss">
                        {Math.round((100 - m.yesPct) * 10) / 10}%
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {mine.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-bold text-cream">
            پیش‌بینی‌های اخیر تو
          </h3>
          <div className="flex flex-col gap-1.5">
            {mine.slice(0, 10).map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface/30 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-cream">{p.question}</div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {p.choice === "yes" ? "بله" : "خیر"} در{" "}
                    <span dir="ltr" className="font-mono">
                      {p.probPct}%
                    </span>
                  </div>
                </div>
                {p.points === null ? (
                  <span className="shrink-0 text-[10px] text-muted">در جریان</span>
                ) : (
                  <span
                    dir="ltr"
                    className={`shrink-0 font-mono text-[12px] font-bold ${
                      p.points >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {p.points >= 0 ? "+" : ""}
                    {p.points}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
