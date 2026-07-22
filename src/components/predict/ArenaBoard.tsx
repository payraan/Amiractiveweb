"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";

type Market = {
  id: string;
  question: string;
  eventTitle: string;
  endDate: string;
  yesPct: number;
  category: string;
  categoryLabel: string;
};

type MyPred = {
  marketId: string;
  question: string;
  choice: string;
  probPct: number;
  points: number | null;
  status: string;
};

type PricePoint = { t: number; p: number };

const CATEGORY_TABS: { id: string; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "crypto", label: "کریپتو" },
  { id: "politics", label: "سیاست" },
  { id: "sports", label: "ورزش" },
  { id: "economy", label: "اقتصاد" },
  { id: "tech", label: "تکنولوژی" },
  { id: "geo", label: "ژئوپلیتیک" },
  { id: "other", label: "سایر" },
];

const ERRORS: Record<string, string> = {
  not_authed: "برای ثبت پیش‌بینی وارد شوید.",
  already_predicted: "برای این بازار قبلاً پیش‌بینی ثبت کرده‌اید.",
  insufficient_credits: "سهم رایگان امروز تمام شده و کردیت کافی ندارید.",
  market_not_found: "این بازار دیگر فعال نیست.",
};

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function Spark({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[90px] items-center justify-center text-[10px] text-muted">
        داده‌ی نمودار کافی نیست.
      </div>
    );
  }
  const W = 300;
  const H = 90;
  const ps = points.map((x) => x.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = max - min || 0.01;
  const coords = points.map((pt, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - 8 - ((pt.p - min) / span) * (H - 20);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${coords[0]} L ${coords.slice(1).join(" L ")}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const last = points[points.length - 1].p;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full" preserveAspectRatio="none">
        <path d={area} fill="rgba(232,196,106,0.08)" />
        <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted" dir="ltr">
        <span>Yes {Math.round(min * 100)}%–{Math.round(max * 100)}%</span>
        <span className="text-gold">now {Math.round(last * 100)}%</span>
      </div>
    </div>
  );
}

export default function ArenaBoard() {
  const { player, loading, refresh, logout } = usePlayer();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [mine, setMine] = useState<Map<string, MyPred>>(new Map());
  const [freeLeft, setFreeLeft] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);
  const [openChart, setOpenChart] = useState<string | null>(null);
  const [hist, setHist] = useState<Map<string, PricePoint[]>>(new Map());

  const loadMarkets = () => {
    fetch("/api/predict/poly-markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setMarkets(j.markets ?? []);
        setLoadingMarkets(false);
      })
      .catch(() => setLoadingMarkets(false));
  };

  const loadMine = () => {
    fetch("/api/predict/poly-me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const map = new Map<string, MyPred>();
        for (const p of j.predictions ?? []) map.set(p.marketId, p);
        setMine(map);
        setFreeLeft(j.freeLeft ?? 0);
      })
      .catch(() => {});
  };

  useEffect(loadMarkets, []);
  useEffect(() => {
    if (player) loadMine();
  }, [player]);

  function toggleChart(marketId: string) {
    if (openChart === marketId) {
      setOpenChart(null);
      return;
    }
    setOpenChart(marketId);
    if (!hist.has(marketId)) {
      fetch(`/api/predict/poly-history?market=${encodeURIComponent(marketId)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((j) => {
          setHist((prev) => {
            const next = new Map(prev);
            next.set(marketId, j.points ?? []);
            return next;
          });
        })
        .catch(() => {});
    }
  }

  async function submit(marketId: string, choice: "yes" | "no") {
    setErr(null);
    setBusy(marketId);
    try {
      const res = await fetch("/api/predict/poly-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, choice }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr({ id: marketId, text: ERRORS[j.error] ?? "خطایی رخ داد." });
        return;
      }
      loadMine();
      refresh();
    } catch {
      setErr({ id: marketId, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(null);
    }
  }

  const present = new Set(markets.map((m) => m.category));
  const tabs = CATEGORY_TABS.filter((t) => t.id === "all" || present.has(t.id));
  const shown = cat === "all" ? markets : markets.filter((m) => m.category === cat);
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const settled = Array.from(mine.values()).filter((p) => p.status === "settled");

  return (
    <>
      {!loading && !player && (
        <div className="mb-8 max-w-md">
          <AuthPanel
            onAuthed={() => {
              refresh();
              window.dispatchEvent(new Event("amir:authed"));
            }}
          />
        </div>
      )}

      {player && (
        <div className="mb-8 max-w-md rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur transition-all duration-300 hover:scale-[1.01] hover:border-gold/50 hover:shadow-[0_0_24px_rgba(232,196,106,0.10)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted">حساب شما</div>
              <div className="font-display text-lg font-extrabold">{player.displayName}</div>
            </div>
            <div className="flex gap-6 text-end">
              <div>
                <div className="text-xs text-muted">کردیت</div>
                <div className="font-mono text-2xl font-bold text-cream" dir="ltr">
                  {player.credits}◆
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">امتیاز</div>
                <div className="font-mono text-2xl font-bold text-gold" dir="ltr">
                  {player.totalPoints}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted">
            پیش‌بینی رایگان امروز:{" "}
            <b className="font-mono text-gain" dir="ltr">{freeLeft}</b>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <a href="/predict#credits" className="text-xs text-muted transition hover:text-gold">
              خرید کردیت
            </a>
            <button
              type="button"
              onClick={logout}
              className="no-zoom text-xs text-muted transition hover:text-loss"
            >
              خروج از حساب
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setCat(t.id);
              setPage(1);
            }}
            className={`no-zoom rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              cat === t.id
                ? "border-gold bg-gold text-ink"
                : "border-line text-muted hover:border-gold/40 hover:text-cream"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingMarkets ? (
        <div className="py-16 text-center text-xs text-muted">در حال دریافت بازارها…</div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted">
          بازاری در این دسته فعال نیست.
        </div>
      ) : (
        <>
        <div className="grid gap-5 md:grid-cols-2">
          {paged.map((m) => {
            const my = mine.get(m.id);
            const yesWin = Math.max(1, Math.round(100 - m.yesPct));
            const noWin = Math.max(1, Math.round(m.yesPct));
            return (
              <div
                key={m.id}
                className="flex flex-col rounded-2xl border border-line bg-surface/50 p-5 transition-all duration-300 hover:scale-[1.02] hover:border-gold/60 hover:shadow-[0_0_24px_rgba(232,196,106,0.12)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] text-muted">
                    {m.categoryLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleChart(m.id)}
                    className={`no-zoom flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] transition ${
                      openChart === m.id
                        ? "border-gold/60 text-gold"
                        : "border-line text-muted hover:text-gold"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M3 17l5-6 4 3 6-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    نمودار
                  </button>
                </div>

                <h3 className="mt-3 min-h-[3rem] text-sm font-bold leading-7" dir="ltr">
                  {m.question}
                </h3>

                <div className="mt-3">
                  <div className="flex justify-between font-mono text-[11px]" dir="ltr">
                    <span className="text-gain">Yes {m.yesPct}%</span>
                    <span className="text-loss">No {Math.round((100 - m.yesPct) * 10) / 10}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-loss/25">
                    <div
                      className="h-full rounded-full bg-gain"
                      style={{ width: `${m.yesPct}%` }}
                    />
                  </div>
                </div>

                {openChart === m.id && (
                  <div className="mt-3 rounded-xl border border-line bg-ink/40 p-3">
                    {hist.has(m.id) ? (
                      <Spark points={hist.get(m.id) ?? []} />
                    ) : (
                      <div className="flex h-[90px] items-center justify-center text-[10px] text-muted">
                        در حال بارگذاری نمودار…
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 text-[10px] text-muted">
                  بسته‌شدن بازار: {faDate(m.endDate)} · <span className="font-mono" dir="ltr">{m.eventTitle}</span>
                </div>

                {my ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-xs">
                    <span>
                      انتخاب شما:{" "}
                      <b className={my.choice === "yes" ? "text-gain" : "text-loss"}>
                        {my.choice === "yes" ? "بله" : "خیر"}
                      </b>
                    </span>
                    {my.status === "settled" ? (
                      <b
                        className={`font-mono ${(my.points ?? 0) >= 0 ? "text-gain" : "text-loss"}`}
                        dir="ltr"
                      >
                        {(my.points ?? 0) >= 0 ? "+" : ""}
                        {my.points}
                      </b>
                    ) : (
                      <span className="text-muted">در انتظار نتیجه</span>
                    )}
                  </div>
                ) : player ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => submit(m.id, "yes")}
                      className="no-zoom rounded-xl border border-gain/40 py-2.5 text-sm font-bold text-gain transition hover:bg-gain hover:text-ink disabled:opacity-50"
                    >
                      بله <span className="font-mono text-[10px]" dir="ltr">+{yesWin}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => submit(m.id, "no")}
                      className="no-zoom rounded-xl border border-loss/40 py-2.5 text-sm font-bold text-loss transition hover:bg-loss hover:text-ink disabled:opacity-50"
                    >
                      خیر <span className="font-mono text-[10px]" dir="ltr">+{noWin}</span>
                    </button>
                  </div>
                ) : null}

                {err && err.id === m.id && (
                  <p className="mt-2 text-[11px] text-loss">{err.text}</p>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="no-zoom rounded-lg border border-line px-4 py-2 text-muted transition hover:border-gold hover:text-gold disabled:opacity-40"
            >
              صفحه قبل
            </button>
            <span className="font-mono text-muted" dir="ltr">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="no-zoom rounded-lg border border-line px-4 py-2 text-muted transition hover:border-gold hover:text-gold disabled:opacity-40"
            >
              صفحه بعد
            </button>
          </div>
        )}
        </>
      )}

      {settled.length > 0 && (
        <div className="mt-10 max-w-2xl">
          <h3 className="mb-3 text-sm font-bold">نتایج پیش‌بینی‌های شما</h3>
          <div className="overflow-hidden rounded-2xl border border-line">
            {settled.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                  i % 2 ? "bg-surface/30" : "bg-surface/50"
                }`}
              >
                <span className="line-clamp-1 flex-1" dir="ltr">{p.question}</span>
                <b
                  className={`font-mono ${(p.points ?? 0) >= 0 ? "text-gain" : "text-loss"}`}
                  dir="ltr"
                >
                  {(p.points ?? 0) >= 0 ? "+" : ""}
                  {p.points}
                </b>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
