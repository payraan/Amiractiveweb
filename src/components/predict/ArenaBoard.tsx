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
};

type MyPred = {
  marketId: string;
  question: string;
  choice: string;
  probPct: number;
  points: number | null;
  status: string;
};

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

export default function ArenaBoard() {
  const { player, loading, refresh } = usePlayer();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [mine, setMine] = useState<Map<string, MyPred>>(new Map());
  const [freeLeft, setFreeLeft] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

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

  const settled = Array.from(mine.values()).filter((p) => p.status === "settled");

  return (
    <>
      {player && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface/50 px-5 py-4 text-xs">
          <span>
            <span className="text-muted">پیش‌بینی رایگان امروز: </span>
            <b className="font-mono text-gain" dir="ltr">{freeLeft}</b>
          </span>
          <span>
            <span className="text-muted">کردیت: </span>
            <b className="font-mono text-cream" dir="ltr">{player.credits}◆</b>
          </span>
          <span>
            <span className="text-muted">امتیاز کل: </span>
            <b className="font-mono text-gold" dir="ltr">{player.totalPoints}</b>
          </span>
        </div>
      )}

      {loadingMarkets ? (
        <div className="py-16 text-center text-xs text-muted">در حال دریافت بازارها…</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {markets.map((m) => {
            const my = mine.get(m.id);
            const yesWin = Math.max(1, Math.round(100 - m.yesPct));
            const noWin = Math.max(1, Math.round(m.yesPct));
            return (
              <div
                key={m.id}
                className="flex flex-col rounded-2xl border border-line bg-surface/50 p-5"
              >
                <span className="font-mono text-[10px] tracking-wide text-muted" dir="ltr">
                  {m.eventTitle}
                </span>
                <h3 className="mt-2 min-h-[3rem] text-sm font-bold leading-7" dir="ltr">
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

                <div className="mt-2 text-[10px] text-muted">
                  بسته‌شدن بازار: {faDate(m.endDate)}
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
      )}

      {!loading && !player && (
        <div className="mt-10 max-w-md">
          <AuthPanel onAuthed={() => refresh()} />
        </div>
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
