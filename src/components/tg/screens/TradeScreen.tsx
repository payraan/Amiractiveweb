"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, EmptyState, ScreenTitle, Skeleton, SearchBar } from "@/components/tg/ui";
import { matchesQuery, displayTitle } from "@/lib/search";
import { haptic } from "@/components/tg/telegram";
import TradeDetail, { type PolyMarket } from "@/components/tg/screens/TradeDetail";
import { remaining, closingSoon } from "@/lib/dates";

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
  questionFa?: string | null;
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

// همان قاعده‌ی بازار ایران: نوار داغ وقتی معنا دارد که فهرست آن‌قدر بلند
// باشد که بازارهای بزرگ زیرش گم شوند، وگرنه فقط فهرست را دو بار نشان
// می‌دهد و فضای عمودی می‌خورد.
const HOT_COUNT = 4;
const HOT_MIN_MARKETS = 10;
const SEARCH_MIN = 8;

export default function TradeScreen() {
  const [cat, setCat] = useState("all");
  // مثل بازار ایران: پیش‌فرض «نزدیک به پایان» است تا فهرست، ترتیبِ نوار
  // داغ را تکرار نکند و دو بخش مکمل هم باشند.
  const [sort, setSort] = useState<SortId>("closing");
  const [hideDone, setHideDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // کارنامه ته صفحه بود، زیر چهارصد کارت — یعنی عملا وجود نداشت. حالا یک
  // کلید دوحالته است که جای همان کادر «رایگان امروز» می‌نشیند، پس دیدنِ
  // نتایج یک لمس فاصله دارد و ارتفاع صفحه هم عوض نشده.
  const [view, setView] = useState<"markets" | "mine">("markets");

  const markets = useResource<{ markets: PolyMarket[] }>("/api/predict/poly-markets");
  const me = useResource<Me>("/api/predict/poly-me");

  const list = markets.data?.markets ?? null;
  const mine = me.data?.predictions ?? [];
  const doneIds = new Set(mine.map((p) => p.marketId));
  const openPreds = mine.filter((p) => p.points === null);
  const settledPreds = mine.filter((p) => p.points !== null);
  const totalPoints = settledPreds.reduce((sum, p) => sum + (p.points ?? 0), 0);

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
    // عنوان رویداد هم جست‌وجو می‌شود: کاربر «F1» را از عنوان رویداد به یاد
    // می‌آورد، نه از متن کامل پرسش.
    out = out.filter((m) =>
      matchesQuery(q, m.question, m.eventTitle, m.questionFa ?? undefined)
    );
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

  // نوار داغ از همان فهرستِ فیلترشده، تا با دسته‌ی انتخابی بخواند.
  const hot =
    shown && shown.length >= HOT_MIN_MARKETS
      ? [...shown].sort((a, b) => b.volume - a.volume).slice(0, HOT_COUNT)
      : [];

  return (
    <div>
      <ScreenTitle title="ترید" subtitle="بازارهای رویداد جهانی، امتیازی" />

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
          <span className="block text-[12px] font-bold">بازارها</span>
          <span className="mt-0.5 block text-[9px] opacity-80">
            {me.data ? `${me.data.freeLeft} پیش‌بینی رایگان امروز` : "\u00a0"}
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
            {mine.length > 0 ? `${mine.length} مورد` : "هنوز خالی"}
          </span>
        </button>
      </div>

      {view === "markets" && (list?.length ?? 0) >= SEARCH_MIN && (
        <SearchBar value={q} onChange={setQ} placeholder="جست‌وجو در بازارها…" />
      )}

      {view === "markets" && (
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
      )}

      {view === "markets" && (
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
      )}

      {/* داغ‌ترین‌ها — پرحجم‌ترین بازارهای همین دسته، افقی. */}
      {view === "markets" && !markets.error && hot.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-gold">🔥 داغ‌ترین‌ها</span>
            <span className="text-[9px] text-muted">بیشترین حجم معامله</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
            {hot.map((m) => (
              <article
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic.press();
                  setOpenId(m.id);
                }}
                className="w-[168px] shrink-0 cursor-pointer rounded-xl border border-gold/25 bg-gradient-to-bl from-gold/[0.07] to-surface/50 p-2.5 transition active:border-gold/60"
              >
                <p
                  dir="auto"
                  className="line-clamp-2 text-start text-[10.5px] font-bold leading-[1.6] text-cream"
                >
                  {displayTitle(m.question, m.questionFa)}
                </p>
                <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-loss/30">
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{ width: `${m.yesPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted">
                  <span dir="ltr" className="font-mono font-bold text-gain">
                    {Math.round(m.yesPct)}%
                  </span>
                  <span>بله</span>
                  <span className="opacity-40">·</span>
                  <span dir="ltr" className="font-mono text-cream">
                    ${compact(m.volume)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {view === "markets" && markets.error && (
        <ErrorState message="بازارها نیامدند." onRetry={markets.reload} />
      )}

      {view === "markets" && !markets.error && list === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {view === "markets" && !markets.error && shown?.length === 0 && (
        <EmptyState title="بازاری در این دسته نیست" hint="دسته‌ی دیگری را ببینید." />
      )}

      {view === "markets" && !markets.error && shown && shown.length > 0 && (
        <div className="flex flex-col gap-2.5">
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
                className="cursor-pointer rounded-xl border border-line bg-surface/40 p-3 transition active:border-gold/50"
              >
                <div className="flex items-start gap-2.5">
                  {/* هر دو طرف نشان داده می‌شود، نه فقط «بله».
                      یک بازار پیش‌بینی دو گزینه دارد و نشان دادن یکی، نصف
                      اطلاعات را پنهان می‌کند — کاربر باید ۱۰۰ منهای عدد را
                      در ذهنش حساب می‌کرد. */}
                  <div className="min-w-[46px] shrink-0 text-center leading-none">
                    <div dir="ltr" className="font-mono text-[16px] font-black text-gain">
                      {Math.round(m.yesPct)}%
                    </div>
                    <div className="mt-0.5 text-[8px] text-gain/70">بله</div>
                    <div
                      dir="ltr"
                      className="mt-1.5 font-mono text-[13px] font-bold text-loss"
                    >
                      {100 - Math.round(m.yesPct)}%
                    </div>
                    <div className="mt-0.5 text-[8px] text-loss/70">خیر</div>
                  </div>
                  {/* dir="auto" نه rtl و نه ltr.
                      عنوان پالی‌مارکت انگلیسی است و داخل ظرف rtl، الگوریتم
                      دوطرفه‌ی یونیکد علامت پایانی را اول جمله می‌گذارد:
                      «?Will George Russell…». ولی ltrِ ثابت هم جواب نیست،
                      چون عنوان‌های فارسی‌شده (و فیکسچرهای فارسی) را چپ‌چین
                      می‌کند. auto از روی اولین حرفِ جهت‌دار تصمیم می‌گیرد و
                      هر دو حالت را درست می‌چیند. */}
                  <p
                    dir="auto"
                    className="line-clamp-2 flex-1 text-start text-[12px] font-bold leading-[1.7] text-cream"
                  >
                    {displayTitle(m.question, m.questionFa)}
                  </p>
                </div>

                <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-loss/30">
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{ width: `${m.yesPct}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] text-muted">
                  {done && (
                    <span className="rounded-full border border-gain/40 bg-gain/10 px-1.5 py-px text-[8.5px] font-bold text-gain">
                      ثبت شده
                    </span>
                  )}
                  {m.endDate && (
                    <>
                      <span className={closingSoon(m.endDate) ? "font-bold text-gold" : ""}>
                        {remaining(m.endDate)}
                      </span>
                      <span className="opacity-40">·</span>
                    </>
                  )}
                  <span>{m.categoryLabel}</span>
                  <span className="opacity-40">·</span>
                  <span>
                    حجم{" "}
                    <span dir="ltr" className="font-mono text-cream">
                      ${compact(m.volume)}
                    </span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {view === "mine" && (
        <>
          {mine.length === 0 ? (
            <EmptyState
              title="هنوز پیش‌بینی‌ای ثبت نکرده‌اید"
              hint="از تب بازارها یکی را انتخاب کنید."
            />
          ) : (
            <>
              {/* خلاصه اول: کسی که کارنامه‌اش را باز می‌کند، اول می‌خواهد
                  بداند در مجموع جلوست یا عقب، نه اینکه ردیف‌ها را جمع بزند. */}
              <div className="mb-4 flex gap-2">
                <div className="flex-1 rounded-xl border border-line bg-surface/40 p-3 text-center">
                  <div dir="ltr" className="font-mono text-[16px] font-black text-cream">
                    {openPreds.length}
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">در جریان</div>
                </div>
                <div className="flex-1 rounded-xl border border-line bg-surface/40 p-3 text-center">
                  <div dir="ltr" className="font-mono text-[16px] font-black text-cream">
                    {settledPreds.length}
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">تسویه‌شده</div>
                </div>
                <div className="flex-1 rounded-xl border border-line bg-surface/40 p-3 text-center">
                  <div
                    dir="ltr"
                    className={`font-mono text-[16px] font-black ${
                      totalPoints > 0 ? "text-gain" : totalPoints < 0 ? "text-loss" : "text-cream"
                    }`}
                  >
                    {totalPoints > 0 ? "+" : ""}
                    {totalPoints}
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">امتیاز</div>
                </div>
              </div>

              {openPreds.length > 0 && (
                <>
                  <h3 className="mb-2 text-[11px] font-bold text-cream">در جریان</h3>
                  <div className="mb-5 flex flex-col gap-1.5">
                    {openPreds.map((p, i) => (
                      <PredRow key={`o${i}`} p={p} />
                    ))}
                  </div>
                </>
              )}

              {settledPreds.length > 0 && (
                <>
                  <h3 className="mb-2 text-[11px] font-bold text-cream">تسویه‌شده</h3>
                  <div className="flex flex-col gap-1.5">
                    {settledPreds.map((p, i) => (
                      <PredRow key={`s${i}`} p={p} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}

/** یک ردیف کارنامه — در جریان یا تسویه‌شده. */
function PredRow({ p }: { p: MyPrediction }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div dir="auto" className="truncate text-start text-[11.5px] text-cream">
          {displayTitle(p.question, p.questionFa)}
        </div>
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
  );
}
