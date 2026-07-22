"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";

type Market = {
  id: string;
  question: string;
  eventTitle: string;
  endDate: string;
  yesPct: number;
  volume: number;
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
type Interval = "1d" | "1w" | "1m" | "max";

const INTERVALS: { id: Interval; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
  { id: "max", label: "ALL" },
];

const ERRORS: Record<string, string> = {
  not_authed: "برای ثبت پیش‌بینی وارد شوید.",
  already_predicted: "روی این بازار قبلاً پیش‌بینی ثبت کرده‌اید.",
  insufficient_credits: "سهم رایگان امروز تمام شده و کردیت کافی ندارید.",
  market_not_found: "این بازار دیگر فعال نیست.",
};

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function closesIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "بسته";
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

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

/* ── نمودار ─────────────────────────────────────────── */
function Chart({ points, height }: { points: PricePoint[]; height: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted"
        style={{ height }}
      >
        داده‌ی نمودار برای این بازه در دسترس نیست.
      </div>
    );
  }

  const W = 1000;
  const H = 320;
  const PAD = 18;
  const ps = points.map((x) => x.p);
  const rawMin = Math.min(...ps);
  const rawMax = Math.max(...ps);
  const pad = Math.max(0.02, (rawMax - rawMin) * 0.18);
  const min = Math.max(0, rawMin - pad);
  const max = Math.min(1, rawMax + pad);
  const span = max - min || 0.01;

  const xy = (i: number, p: number) => {
    const x = (i / (points.length - 1)) * W;
    const y = PAD + (1 - (p - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  };

  const coords = points.map((pt, i) => {
    const [x, y] = xy(i, pt.p);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${coords[0]} L ${coords.slice(1).join(" L ")}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;

  const idx = hover ?? points.length - 1;
  const cur = points[idx];
  const [cx, cy] = xy(idx, cur.p);
  const first = points[0].p;
  const delta = (cur.p - first) * 100;

  const rows = [max, (max + min) / 2, min];

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div className="relative">
      <div className="absolute end-3 top-2 z-10 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-gold" dir="ltr">
          {Math.round(cur.p * 100)}%
        </span>
        <span
          className={`font-mono text-[11px] ${delta >= 0 ? "text-gain" : "text-loss"}`}
          dir="ltr"
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}pts
        </span>
      </div>

      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="relative cursor-crosshair"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ height }}
          className="w-full"
          preserveAspectRatio="none"
        >
          {rows.map((g, i) => {
            const y = PAD + (1 - (g - min) / span) * (H - PAD * 2);
            return (
              <line
                key={i}
                x1="0"
                x2={W}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="3 7"
              />
            );
          })}
          <path d={area} fill="rgba(232,196,106,0.07)" />
          <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="1.8" />
          <line x1={cx} x2={cx} y1="0" y2={H} stroke="rgba(232,196,106,0.3)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="3.5" fill="var(--color-gold)" />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 start-2 flex flex-col justify-between py-2 font-mono text-[9px] text-muted">
          {rows.map((r, i) => (
            <span key={i} dir="ltr">
              {Math.round(r * 100)}%
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-between border-t border-line px-3 py-1.5 font-mono text-[9px] text-muted" dir="ltr">
        <span>
          {new Date(points[0].t * 1000).toLocaleDateString("fa-IR", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="text-cream">
          {new Date(cur.t * 1000).toLocaleString("fa-IR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>
          {new Date(points[points.length - 1].t * 1000).toLocaleDateString("fa-IR", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

/* ── ترمینال ─────────────────────────────────────────── */
export default function TradeTerminal({ initialId }: { initialId?: string }) {
  const { player, loading, refresh } = usePlayer();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [sel, setSel] = useState<string | null>(initialId ?? null);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [interval, setIntervalId] = useState<Interval>("1w");
  const [loadingChart, setLoadingChart] = useState(false);
  const [mine, setMine] = useState<Map<string, MyPred>>(new Map());
  const [freeLeft, setFreeLeft] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tab, setTab] = useState<"positions" | "history" | "markets">("markets");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch("/api/predict/poly-markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list: Market[] = j.markets ?? [];
        setMarkets(list);
        setSel((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const loadMine = useCallback(() => {
    fetch("/api/predict/poly-me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const map = new Map<string, MyPred>();
        for (const p of j.predictions ?? []) map.set(p.marketId, p);
        setMine(map);
        setFreeLeft(j.freeLeft ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (player) loadMine();
  }, [player, loadMine]);

  useEffect(() => {
    if (!sel) return;
    setLoadingChart(true);
    setErr(null);
    setOk(false);
    fetch(
      `/api/predict/poly-history?market=${encodeURIComponent(sel)}&interval=${interval}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j) => {
        setPoints(j.points ?? []);
        setLoadingChart(false);
      })
      .catch(() => setLoadingChart(false));
  }, [sel, interval]);

  const market = useMemo(() => markets.find((m) => m.id === sel) ?? null, [markets, sel]);

  // بازارهای هم‌رویداد — نردبان کناری
  const ladder = useMemo(() => {
    if (!market) return [];
    return markets
      .filter((m) => m.eventTitle === market.eventTitle)
      .sort((a, b) => b.yesPct - a.yesPct);
  }, [markets, market]);

  const cats = useMemo(() => {
    const present = Array.from(new Set(markets.map((m) => m.category)));
    return [
      { id: "all", label: "همه" },
      ...present.map((id) => ({
        id,
        label: markets.find((m) => m.category === id)?.categoryLabel ?? id,
      })),
    ];
  }, [markets]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return markets
      .filter((m) => (cat === "all" ? true : m.category === cat))
      .filter((m) =>
        needle
          ? m.question.toLowerCase().includes(needle) ||
            m.eventTitle.toLowerCase().includes(needle)
          : true
      )
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  }, [markets, q, cat]);

  const positions = Array.from(mine.values()).filter((p) => p.status === "open");
  const history = Array.from(mine.values()).filter((p) => p.status === "settled");

  async function place() {
    if (!market) return;
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/poly-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, choice: side }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(ERRORS[j.error] ?? "خطایی رخ داد.");
        return;
      }
      setOk(true);
      loadMine();
      refresh();
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  const my = market ? mine.get(market.id) : undefined;
  const sidePct = market
    ? side === "yes"
      ? market.yesPct
      : Math.round((100 - market.yesPct) * 10) / 10
    : 0;
  const reward = Math.max(1, Math.round(100 - sidePct));
  const risk = Math.max(1, Math.round(sidePct));

  return (
    <div className="rounded-xl border border-line bg-surface/40">
      {/* ── نوار بالا ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 font-mono text-[10px] font-bold text-gold">
            {market ? market.categoryLabel.slice(0, 2) : "··"}
          </span>
          <div className="min-w-0">
            <h1 className="line-clamp-1 text-sm font-bold" dir="ltr">
              {market?.question ?? "در حال بارگذاری…"}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] tracking-wide text-muted">
              <span className="rounded border border-line px-1.5 py-px">
                {market?.categoryLabel ?? "—"}
              </span>
              <span dir="ltr">RESOLVES {market ? faDate(market.endDate) : "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
              TOTAL VOL
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-cream" dir="ltr">
              {market ? fmtVol(market.volume) : "—"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
              YES
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-gain" dir="ltr">
              {market ? `${market.yesPct}%` : "—"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
              NO
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-loss" dir="ltr">
              {market ? `${Math.round((100 - market.yesPct) * 10) / 10}%` : "—"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
              CLOSES IN
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-gold" dir="ltr">
              {market ? closesIn(market.endDate) : "—"}
            </div>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {market && (
            <Link
              href={`/arena/m/${market.id}`}
              className="rounded-lg border border-line px-3 py-1.5 text-[10px] text-muted transition hover:border-gold/50 hover:text-gold"
            >
              اشتراک
            </Link>
          )}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTab("markets");
            }}
            placeholder="جستجوی بازار…"
            className="no-zoom w-44 rounded-lg border border-line bg-ink/60 px-3 py-1.5 text-[11px] outline-none transition focus:border-gold/60"
          />
        </div>
      </div>

      {/* ── بدنه ── */}
      <div className="grid lg:grid-cols-[1fr_220px_300px]">
        {/* نمودار */}
        <div className="border-b border-line lg:border-e lg:border-b-0">
          <div className="flex items-center gap-1 border-b border-line px-3 py-2">
            {INTERVALS.map((iv) => (
              <button
                key={iv.id}
                type="button"
                onClick={() => setIntervalId(iv.id)}
                className={`no-zoom rounded px-2.5 py-1 font-mono text-[10px] transition ${
                  interval === iv.id
                    ? "bg-gold/15 text-gold"
                    : "text-muted hover:text-cream"
                }`}
                dir="ltr"
              >
                {iv.label}
              </button>
            ))}
            <span className="ms-auto flex items-center gap-1.5 font-mono text-[9px] text-muted" dir="ltr">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
              </span>
              LIVE · POLYMARKET
            </span>
          </div>

          {loadingChart ? (
            <div className="flex h-[320px] items-center justify-center text-xs text-muted">
              در حال بارگذاری نمودار…
            </div>
          ) : (
            <Chart points={points} height={320} />
          )}
        </div>

        {/* نردبان رویداد */}
        <div className="border-b border-line lg:border-e lg:border-b-0">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-mono text-[10px] tracking-wider text-muted" dir="ltr">
              EVENT MARKETS
            </span>
            <span className="font-mono text-[10px] text-gold" dir="ltr">
              {ladder.length}
            </span>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {ladder.map((m) => {
              const active = m.id === sel;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSel(m.id)}
                  className={`no-zoom relative flex w-full items-center justify-between gap-2 px-3 py-2 text-start transition ${
                    active ? "bg-gold/10" : "hover:bg-raised/40"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 start-0 bg-gain/10"
                    style={{ width: `${m.yesPct}%` }}
                  />
                  <span className="relative line-clamp-1 flex-1 text-[10px]" dir="ltr">
                    {m.question.replace(/^Will (the price of )?/i, "")}
                  </span>
                  <span
                    className={`relative shrink-0 font-mono text-[11px] font-bold ${
                      m.yesPct >= 50 ? "text-gain" : "text-loss"
                    }`}
                    dir="ltr"
                  >
                    {m.yesPct}%
                  </span>
                </button>
              );
            })}
            {ladder.length === 0 && (
              <div className="py-10 text-center text-[10px] text-muted">—</div>
            )}
          </div>
        </div>

        {/* پنل سفارش */}
        <div>
          <div className="border-b border-line px-3 py-2">
            <span className="font-mono text-[10px] tracking-wider text-gold" dir="ltr">
              PLACE PREDICTION
            </span>
          </div>

          <div className="p-3">
            {!loading && !player ? (
              <>
                <p className="text-[10px] leading-5 text-muted">
                  برای ثبت پیش‌بینی وارد حساب شوید.
                </p>
                <div className="mt-3">
                  <AuthPanel onAuthed={() => refresh()} />
                </div>
              </>
            ) : my ? (
              <div className="rounded-lg border border-gold/40 bg-gold/5 p-4 text-center">
                <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
                  YOUR POSITION
                </div>
                <div
                  className={`mt-1.5 text-xl font-black ${
                    my.choice === "yes" ? "text-gain" : "text-loss"
                  }`}
                >
                  {my.choice === "yes" ? "بله" : "خیر"}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
                  entry {my.probPct}%
                </div>
                <div className="mt-3 border-t border-line pt-3 font-mono text-[11px]">
                  {my.status === "settled" ? (
                    <span
                      className={(my.points ?? 0) >= 0 ? "text-gain" : "text-loss"}
                      dir="ltr"
                    >
                      {(my.points ?? 0) >= 0 ? "+" : ""}
                      {my.points} pts
                    </span>
                  ) : (
                    <span className="text-muted">در انتظار نتیجه</span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSide("yes")}
                    className={`no-zoom rounded-lg border py-2.5 text-xs font-bold transition ${
                      side === "yes"
                        ? "border-gain bg-gain/15 text-gain"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    بله{" "}
                    <span className="font-mono text-[10px]" dir="ltr">
                      {market?.yesPct ?? 0}%
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("no")}
                    className={`no-zoom rounded-lg border py-2.5 text-xs font-bold transition ${
                      side === "no"
                        ? "border-loss bg-loss/15 text-loss"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    خیر{" "}
                    <span className="font-mono text-[10px]" dir="ltr">
                      {market ? Math.round((100 - market.yesPct) * 10) / 10 : 0}%
                    </span>
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-line bg-ink/40 p-3 font-mono text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Entry</span>
                    <span className="text-cream" dir="ltr">
                      {sidePct}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">To win</span>
                    <span className="text-gain" dir="ltr">
                      +{reward} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Risk</span>
                    <span className="text-loss" dir="ltr">
                      −{risk} pts
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1.5">
                    <span className="text-muted">Cost</span>
                    <span className={freeLeft > 0 ? "text-gain" : "text-cream"} dir="ltr">
                      {freeLeft > 0 ? "FREE" : "1◆"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy || !market}
                  onClick={place}
                  className={`no-zoom mt-3 w-full rounded-lg py-3 font-display text-sm font-extrabold transition disabled:opacity-50 ${
                    side === "yes"
                      ? "bg-gain text-ink hover:brightness-110"
                      : "bg-loss text-ink hover:brightness-110"
                  }`}
                >
                  {busy ? "…" : `ثبت ${side === "yes" ? "بله" : "خیر"}`}
                </button>

                <p className="mt-2 text-[9px] leading-4 text-muted">
                  امتیاز برد = ۱۰۰ منهای احتمال گزینه‌ی شما. گزینه‌ی کم‌احتمال‌تر،
                  پاداش بزرگ‌تر.
                </p>
              </>
            )}

            {err && <p className="mt-2 text-[10px] text-loss">{err}</p>}
            {ok && !err && <p className="mt-2 text-[10px] text-gain">ثبت شد ✓</p>}

            {player && (
              <div className="mt-3 flex justify-between border-t border-line pt-3 font-mono text-[10px]">
                <span className="text-muted" dir="ltr">
                  FREE {freeLeft}
                </span>
                <span className="text-cream" dir="ltr">
                  {player.credits}◆
                </span>
                <span className="text-gold" dir="ltr">
                  {player.totalPoints} pts
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── تب‌های پایین ── */}
      <div className="border-t border-line">
        <div className="flex items-center gap-1 border-b border-line px-3">
          {(
            [
              { id: "markets", label: "همه بازارها", n: list.length },
              { id: "positions", label: "پوزیشن‌های باز", n: positions.length },
              { id: "history", label: "تاریخچه", n: history.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`no-zoom border-b-2 px-3 py-2.5 text-[11px] font-bold transition ${
                tab === t.id
                  ? "border-gold text-gold"
                  : "border-transparent text-muted hover:text-cream"
              }`}
            >
              {t.label}
              <span className="ms-1.5 font-mono text-[9px] opacity-70" dir="ltr">
                {t.n}
              </span>
            </button>
          ))}

          {tab === "markets" && (
            <div className="ms-auto flex flex-wrap gap-1 py-1.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={`no-zoom rounded px-2.5 py-1 text-[10px] transition ${
                    cat === c.id
                      ? "bg-gold text-ink"
                      : "text-muted hover:text-cream"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {tab === "markets" &&
            (list.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                بازاری با این فیلتر پیدا نشد.
              </div>
            ) : (
              list.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSel(m.id)}
                  className={`no-zoom flex w-full items-center gap-3 px-4 py-2.5 text-start transition ${
                    m.id === sel
                      ? "bg-gold/10"
                      : i % 2
                        ? "bg-surface/25 hover:bg-raised/40"
                        : "hover:bg-raised/40"
                  }`}
                >
                  <span className="line-clamp-1 flex-1 text-[11px]" dir="ltr">
                    {m.question}
                  </span>
                  <span className="shrink-0 text-[9px] text-muted">{m.categoryLabel}</span>
                  <span className="w-16 shrink-0 text-end font-mono text-[10px] text-muted" dir="ltr">
                    {fmtVol(m.volume)}
                  </span>
                  <span className="w-14 shrink-0 text-end font-mono text-[10px] text-gold" dir="ltr">
                    {closesIn(m.endDate)}
                  </span>
                  <span
                    className={`w-12 shrink-0 text-end font-mono text-[11px] font-bold ${
                      m.yesPct >= 50 ? "text-gain" : "text-loss"
                    }`}
                    dir="ltr"
                  >
                    {m.yesPct}%
                  </span>
                  {mine.has(m.id) && (
                    <span className="shrink-0 font-mono text-[9px] text-gold" dir="ltr">
                      ●
                    </span>
                  )}
                </button>
              ))
            ))}

          {tab === "positions" &&
            (positions.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                پوزیشن بازی ندارید.
              </div>
            ) : (
              positions.map((p, i) => (
                <button
                  key={p.marketId}
                  type="button"
                  onClick={() => setSel(p.marketId)}
                  className={`no-zoom flex w-full items-center gap-3 px-4 py-2.5 text-start transition ${
                    i % 2 ? "bg-surface/25 hover:bg-raised/40" : "hover:bg-raised/40"
                  }`}
                >
                  <span className="line-clamp-1 flex-1 text-[11px]" dir="ltr">
                    {p.question}
                  </span>
                  <span
                    className={`w-12 shrink-0 text-end text-[11px] font-bold ${
                      p.choice === "yes" ? "text-gain" : "text-loss"
                    }`}
                  >
                    {p.choice === "yes" ? "بله" : "خیر"}
                  </span>
                  <span className="w-16 shrink-0 text-end font-mono text-[10px] text-muted" dir="ltr">
                    entry {p.probPct}%
                  </span>
                </button>
              ))
            ))}

          {tab === "history" &&
            (history.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                هنوز پیش‌بینی تسویه‌شده‌ای ندارید.
              </div>
            ) : (
              history.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    i % 2 ? "bg-surface/25" : ""
                  }`}
                >
                  <span className="line-clamp-1 flex-1 text-[11px]" dir="ltr">
                    {p.question}
                  </span>
                  <span
                    className={`w-12 shrink-0 text-end text-[11px] font-bold ${
                      p.choice === "yes" ? "text-gain" : "text-loss"
                    }`}
                  >
                    {p.choice === "yes" ? "بله" : "خیر"}
                  </span>
                  <span
                    className={`w-16 shrink-0 text-end font-mono text-[11px] font-bold ${
                      (p.points ?? 0) >= 0 ? "text-gain" : "text-loss"
                    }`}
                    dir="ltr"
                  >
                    {(p.points ?? 0) >= 0 ? "+" : ""}
                    {p.points}
                  </span>
                </div>
              ))
            ))}
        </div>
      </div>

      {/* ── نوار وضعیت ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2 font-mono text-[9px] text-muted">
        <span className="flex items-center gap-1.5" dir="ltr">
          <span className="h-1.5 w-1.5 rounded-full bg-gain" />
          LIVE
        </span>
        <span dir="ltr">{markets.length} MARKETS</span>
        <span dir="ltr">DATA · POLYMARKET</span>
        <Link href="/combos" className="ms-auto transition hover:text-gold">
          کمبو
        </Link>
        <Link href="/arena#challenge" className="transition hover:text-gold">
          چلنج پراپ
        </Link>
        <a
          href="https://t.me/Amiractive_support"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-gold"
        >
          پشتیبانی
        </a>
      </div>
    </div>
  );
}
