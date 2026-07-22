"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type Leg = {
  marketId: string;
  question: string;
  choice: "yes" | "no";
  probPct: number;
};

type Ticket = {
  id: number;
  probPct: number;
  legsCount: number;
  charged: number;
  points: number | null;
  status: string;
  legs: { question: string; choice: string; probPct: number; result: string | null }[];
};

const MIN_LEGS = 2;
const MAX_LEGS = 5;
const COMBO_COST = 2;

const ERRORS: Record<string, string> = {
  not_authed: "برای ثبت کمبو وارد حساب شوید.",
  too_few_legs: `کمبو حداقل به ${MIN_LEGS} انتخاب نیاز دارد.`,
  too_many_legs: `کمبو حداکثر ${MAX_LEGS} انتخاب می‌پذیرد.`,
  duplicate_market: "از هر بازار فقط یک بار می‌توانید در یک کمبو استفاده کنید.",
  insufficient_credits: "کمبوی رایگان امروز مصرف شده و کردیت کافی ندارید.",
  market_unavailable: "یکی از بازارهای انتخابی دیگر فعال نیست.",
};

function winPoints(n: number, prob: number): number {
  return Math.max(1, Math.round(100 * n * (1 - prob)));
}
function losePoints(n: number, prob: number): number {
  return -Math.max(1, Math.round(100 * n * prob));
}

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const STEPS = [
  {
    n: "۱",
    title: "چند بازار انتخاب کنید",
    body: "بین ۲ تا ۵ بازار را از فهرست پایین انتخاب کنید و برای هرکدام بله یا خیر بزنید.",
  },
  {
    n: "۲",
    title: "همه در یک تیکت جمع می‌شوند",
    body: "انتخاب‌های شما یک تیکت واحد می‌سازند. شانس برد تیکت، حاصل‌ضرب شانس تک‌تک انتخاب‌هاست.",
  },
  {
    n: "۳",
    title: "برد فقط با درست‌بودن همه",
    body: "اگر همه‌ی انتخاب‌ها درست باشند، امتیاز بزرگی می‌گیرید. حتی یک اشتباه یعنی باخت کل تیکت.",
  },
];

export default function ComboBuilder() {
  const { player, loading, refresh } = usePlayer();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [freeLeft, setFreeLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/predict/poly-markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setMarkets(j.markets ?? []);
        setLoadingMarkets(false);
      })
      .catch(() => setLoadingMarkets(false));
  }, []);

  const loadTickets = () => {
    fetch("/api/predict/combo-me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setTickets(j.tickets ?? []);
        setFreeLeft(j.freeLeft ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (player) loadTickets();
  }, [player]);

  function pick(m: Market, choice: "yes" | "no") {
    setErr(null);
    setLegs((prev) => {
      const existing = prev.find((l) => l.marketId === m.id);
      const without = prev.filter((l) => l.marketId !== m.id);
      if (existing && existing.choice === choice) return without;
      if (without.length >= MAX_LEGS) {
        setErr(`حداکثر ${MAX_LEGS} انتخاب در یک کمبو مجاز است.`);
        return prev;
      }
      return [
        ...without,
        {
          marketId: m.id,
          question: m.question,
          choice,
          probPct:
            choice === "yes" ? m.yesPct : Math.round((100 - m.yesPct) * 10) / 10,
        },
      ];
    });
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/combo-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs: legs.map((l) => ({ marketId: l.marketId, choice: l.choice })),
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(ERRORS[j.error] ?? "ثبت کمبو ناموفق بود.");
        return;
      }
      setLegs([]);
      loadTickets();
      refresh();
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  const cats = [
    { id: "all", label: "همه" },
    ...Array.from(new Set(markets.map((m) => m.category))).map((id) => ({
      id,
      label: markets.find((m) => m.category === id)?.categoryLabel ?? id,
    })),
  ];
  const filtered = cat === "all" ? markets : markets.filter((m) => m.category === cat);
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const prob = legs.reduce((acc, l) => acc * (l.probPct / 100), 1);
  const win = legs.length ? winPoints(legs.length, prob) : 0;
  const lose = legs.length ? losePoints(legs.length, prob) : 0;
  const chosen = (id: string): "yes" | "no" | null =>
    legs.find((l) => l.marketId === id)?.choice ?? null;

  return (
    <>
      {/* توضیح ساده */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-line bg-surface/40 p-5 transition-all duration-300 hover:scale-[1.02] hover:border-gold/60 hover:shadow-[0_0_24px_rgba(232,196,106,0.12)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 font-mono text-sm font-bold text-gold">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-bold">{s.title}</h3>
            <p className="mt-2 text-[11px] leading-6 text-muted">{s.body}</p>
          </div>
        ))}
      </div>

      {/* مثال عددی */}
      <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <h3 className="text-sm font-bold text-gold">یک مثال ساده</h3>
        <p className="mt-2 text-xs leading-7 text-muted">
          فرض کنید ۳ بازار را انتخاب می‌کنید که هرکدام{" "}
          <b className="font-mono text-cream" dir="ltr">50%</b> شانس دارند. شانس
          برد تیکت شما می‌شود{" "}
          <b className="font-mono text-cream" dir="ltr">
            50% × 50% × 50% = 12.5%
          </b>{" "}
          — سخت‌تر، ولی به همان نسبت پرامتیازتر: برد یعنی{" "}
          <b className="font-mono text-gain" dir="ltr">+263</b> و باخت یعنی{" "}
          <b className="font-mono text-loss" dir="ltr">−38</b>. هرچه ترکیب
          سخت‌تر باشد، پاداشش بزرگ‌تر است.
        </p>
        <p className="mt-3 text-[11px] leading-6 text-muted">
          هر روز <b className="text-gain">۱ کمبوی رایگان</b> دارید؛ کمبوهای بعدی
          هر کدام{" "}
          <b className="font-mono text-cream" dir="ltr">
            {COMBO_COST}◆
          </b>{" "}
          کردیت. امتیاز کمبو در لیدربورد ثبت می‌شود اما در ارزیابی چلنج پراپ
          محاسبه نمی‌شود.
        </p>
      </div>

      {!loading && !player && (
        <div className="mt-8 max-w-md">
          <AuthPanel onAuthed={() => refresh()} />
        </div>
      )}

      {player && (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface/50 px-5 py-4 text-xs">
          <span>
            <span className="text-muted">حساب: </span>
            <b>{player.displayName}</b>
          </span>
          <span>
            <span className="text-muted">کمبوی رایگان امروز: </span>
            <b className="font-mono text-gain" dir="ltr">
              {freeLeft}
            </b>
          </span>
          <span>
            <span className="text-muted">کردیت: </span>
            <b className="font-mono text-cream" dir="ltr">
              {player.credits}◆
            </b>
          </span>
        </div>
      )}

      {/* انتخاب بازارها */}
      <div className="mt-10">
        <h2 className="text-sm font-bold">
          بازارها را انتخاب کنید{" "}
          <span className="font-mono text-gold" dir="ltr">
            ({legs.length}/{MAX_LEGS})
          </span>
        </h2>
        <p className="mt-1 text-[11px] text-muted">
          روی «بله» یا «خیر» هر بازار بزنید تا به تیکت اضافه شود. برای حذف، دوباره
          همان گزینه را بزنید.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCat(c.id);
                setPage(1);
              }}
              className={`no-zoom rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                cat === c.id
                  ? "border-gold bg-gold text-ink"
                  : "border-line text-muted hover:border-gold/40 hover:text-cream"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loadingMarkets ? (
          <div className="py-16 text-center text-xs text-muted">
            در حال دریافت بازارها…
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {paged.map((m) => {
                const c = chosen(m.id);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col rounded-2xl border bg-surface/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(232,196,106,0.12)] ${
                      c ? "border-gold/60" : "border-line hover:border-gold/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] text-muted">
                        {m.categoryLabel}
                      </span>
                      <span className="text-[10px] text-muted">
                        سررسید: {faDate(m.endDate)}
                      </span>
                    </div>

                    <h3 className="mt-3 min-h-[2.5rem] text-sm font-bold leading-6" dir="ltr">
                      {m.question}
                    </h3>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => pick(m, "yes")}
                        className={`no-zoom rounded-xl border py-2.5 text-sm font-bold transition ${
                          c === "yes"
                            ? "border-gain bg-gain text-ink"
                            : "border-gain/40 text-gain hover:bg-gain/10"
                        }`}
                      >
                        بله{" "}
                        <span className="font-mono text-[10px]" dir="ltr">
                          {m.yesPct}%
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => pick(m, "no")}
                        className={`no-zoom rounded-xl border py-2.5 text-sm font-bold transition ${
                          c === "no"
                            ? "border-loss bg-loss text-ink"
                            : "border-loss/40 text-loss hover:bg-loss/10"
                        }`}
                      >
                        خیر{" "}
                        <span className="font-mono text-[10px]" dir="ltr">
                          {Math.round((100 - m.yesPct) * 10) / 10}%
                        </span>
                      </button>
                    </div>
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
      </div>

      {/* تیکت‌های قبلی */}
      {tickets.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-sm font-bold">کمبوهای شما</h2>
          <div className="flex flex-col gap-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-line bg-surface/50 p-4 transition-all duration-300 hover:border-gold/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      className="rounded-full border border-gold/40 px-2.5 py-0.5 font-mono text-[10px] text-gold"
                      dir="ltr"
                    >
                      {t.legsCount} LEGS
                    </span>
                    <span className="text-muted">
                      شانس ترکیبی:{" "}
                      <b className="font-mono" dir="ltr">
                        {t.probPct.toFixed(1)}%
                      </b>
                    </span>
                  </span>
                  {t.status === "open" ? (
                    <span className="text-[11px] text-muted">در انتظار نتیجه</span>
                  ) : (
                    <b
                      className={`font-mono text-sm ${
                        (t.points ?? 0) >= 0 ? "text-gain" : "text-loss"
                      }`}
                      dir="ltr"
                    >
                      {(t.points ?? 0) >= 0 ? "+" : ""}
                      {t.points}
                    </b>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {t.legs.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="line-clamp-1 flex-1 text-muted" dir="ltr">
                        {l.question}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          l.choice === "yes" ? "text-gain" : "text-loss"
                        }`}
                      >
                        {l.choice === "yes" ? "بله" : "خیر"}
                      </span>
                      <span className="w-4 shrink-0 text-center">
                        {l.result === "won" ? (
                          <span className="text-gain">✓</span>
                        ) : l.result === "lost" ? (
                          <span className="text-loss">✕</span>
                        ) : (
                          <span className="text-muted">·</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تری پایین */}
      {legs.length > 0 && (
        <>
          <div className="h-36" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-ink/95 backdrop-blur">
            <div className="mx-auto max-w-5xl px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {legs.map((l) => (
                  <button
                    key={l.marketId}
                    type="button"
                    onClick={() =>
                      setLegs((prev) => prev.filter((x) => x.marketId !== l.marketId))
                    }
                    className="no-zoom flex max-w-[240px] items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-[10px] transition hover:border-loss hover:text-loss"
                  >
                    <span
                      className={`shrink-0 font-bold ${
                        l.choice === "yes" ? "text-gain" : "text-loss"
                      }`}
                    >
                      {l.choice === "yes" ? "بله" : "خیر"}
                    </span>
                    <span className="line-clamp-1 text-muted" dir="ltr">
                      {l.question}
                    </span>
                    <span className="shrink-0">✕</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]">
                  <span className="text-muted">
                    شانس برد تیکت:{" "}
                    <b className="font-mono text-cream" dir="ltr">
                      {(prob * 100).toFixed(1)}%
                    </b>
                  </span>
                  <span className="text-muted">
                    اگر همه درست:{" "}
                    <b className="font-mono text-gain" dir="ltr">
                      +{win}
                    </b>
                  </span>
                  <span className="text-muted">
                    اگر اشتباه:{" "}
                    <b className="font-mono text-loss" dir="ltr">
                      {lose}
                    </b>
                  </span>
                  <span className="text-muted">
                    هزینه:{" "}
                    {freeLeft > 0 ? (
                      <b className="text-gain">رایگان</b>
                    ) : (
                      <b className="font-mono text-cream" dir="ltr">
                        {COMBO_COST}◆
                      </b>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {err && <span className="text-[11px] text-loss">{err}</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setLegs([]);
                      setErr(null);
                    }}
                    className="no-zoom rounded-lg border border-line px-4 py-2 text-xs text-muted transition hover:border-loss hover:text-loss"
                  >
                    پاک‌کردن
                  </button>
                  <button
                    type="button"
                    disabled={busy || legs.length < MIN_LEGS || !player}
                    onClick={submit}
                    className="no-zoom rounded-xl bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink shadow-[0_8px_24px_rgba(232,196,106,0.25)] transition hover:bg-gold-deep disabled:opacity-50 disabled:shadow-none"
                  >
                    {busy
                      ? "…"
                      : !player
                        ? "ابتدا وارد شوید"
                        : legs.length < MIN_LEGS
                          ? `حداقل ${MIN_LEGS} انتخاب`
                          : "ثبت کمبو"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {legs.length === 0 && (
        <p className="mt-8 text-[11px] text-muted">
          پس از انتخاب اولین بازار، نوار تیکت در پایین صفحه ظاهر می‌شود.{" "}
          <Link href="/arena" className="text-gold transition hover:text-gold-deep">
            بازگشت به آرنای پیش‌بینی
          </Link>
        </p>
      )}
    </>
  );
}
