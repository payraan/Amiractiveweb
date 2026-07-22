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
  { id: "1d", label: "۱ روز" },
  { id: "1w", label: "۱ هفته" },
  { id: "1m", label: "۱ ماه" },
  { id: "max", label: "همه" },
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
  if (d >= 1) return `${d} روز`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h} ساعت`;
  return `${Math.max(1, Math.floor(ms / 60_000))} دقیقه`;
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

/* ── نمودار تعاملی با کراس‌هر ─────────────────────────── */
function Chart({ points }: { points: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (points.length < 2) {
    return (
      <div className="flex h-[280px] items-center justify-center text-xs text-muted">
        داده‌ی نمودار برای این بازه در دسترس نیست.
      </div>
    );
  }

  const W = 1000;
  const H = 280;
  const PAD = 16;
  const ps = points.map((x) => x.p);
  const rawMin = Math.min(...ps);
  const rawMax = Math.max(...ps);
  const pad = Math.max(0.02, (rawMax - rawMin) * 0.15);
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

  const gridVals = [min, min + span / 2, max];

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="font-mono text-3xl font-bold text-gold" dir="ltr">
          {Math.round(cur.p * 100)}%
        </span>
        <span className="text-[11px] text-muted">
          {hover === null ? "احتمال فعلی «بله»" : "احتمال در نقطه‌ی انتخابی"}
        </span>
        <span className="ms-auto font-mono text-[10px] text-muted" dir="ltr">
          {new Date(cur.t * 1000).toLocaleString("fa-IR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="relative cursor-crosshair"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[280px] w-full" preserveAspectRatio="none">
          {gridVals.map((g, i) => {
            const y = PAD + (1 - (g - min) / span) * (H - PAD * 2);
            return (
              <line
                key={i}
                x1="0"
                x2={W}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 6"
              />
            );
          })}
          <path d={area} fill="rgba(232,196,106,0.08)" />
          <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="2" />
          <line x1={cx} x2={cx} y1="0" y2={H} stroke="rgba(232,196,106,0.35)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="4" fill="var(--color-gold)" />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 start-0 flex flex-col justify-between py-1 font-mono text-[9px] text-muted">
          <span dir="ltr">{Math.round(max * 100)}%</span>
          <span dir="ltr">{Math.round(((max + min) / 2) * 100)}%</span>
          <span dir="ltr">{Math.round(min * 100)}%</span>
        </div>
      </div>

      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted" dir="ltr">
        <span>
          {new Date(points[0].t * 1000).toLocaleDateString("fa-IR", {
            month: "short",
            day: "numeric",
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

  const market = useMemo(
    () => markets.find((m) => m.id === sel) ?? null,
    [markets, sel]
  );

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

  async function place(choice: "yes" | "no") {
    if (!market) return;
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/poly-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, choice }),
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
  const yesWin = market ? Math.max(1, Math.round(100 - market.yesPct)) : 0;
  const noWin = market ? Math.max(1, Math.round(market.yesPct)) : 0;
  const open = Array.from(mine.values()).filter((p) => p.status === "open");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* ستون اصلی */}
      <div className="flex flex-col gap-5">
        {/* هدر بازار */}
        <div className="rounded-2xl border border-line bg-surface/50 p-5">
          {market ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] text-muted">
                  {market.categoryLabel}
                </span>
                <span className="font-mono text-[10px] text-muted" dir="ltr">
                  {market.eventTitle}
                </span>
                <Link
                  href={`/arena/m/${market.id}`}
                  className="ms-auto text-[10px] text-muted transition hover:text-gold"
                >
                  اشتراک‌گذاری ↗
                </Link>
              </div>

              <h2 className="mt-3 text-lg font-black leading-8" dir="ltr">
                {market.question}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-center sm:grid-cols-4">
                <div>
                  <div className="text-[10px] text-muted">احتمال بله</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-gain" dir="ltr">
                    {market.yesPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">احتمال خیر</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-loss" dir="ltr">
                    {Math.round((100 - market.yesPct) * 10) / 10}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">حجم رویداد</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-cream" dir="ltr">
                    {fmtVol(market.volume)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">تا بسته‌شدن</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-gold">
                    {closesIn(market.endDate)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-muted">
              در حال بارگذاری بازارها…
            </div>
          )}
        </div>

        {/* نمودار */}
        <div className="rounded-2xl border border-line bg-surface/50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold">
              نمودار <span className="text-gold">احتمال</span>
            </h3>
            <div className="flex gap-1.5">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.id}
                  type="button"
                  onClick={() => setIntervalId(iv.id)}
                  className={`no-zoom rounded-lg border px-3 py-1 text-[10px] transition ${
                    interval === iv.id
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-line text-muted hover:border-gold/40 hover:text-cream"
                  }`}
                >
                  {iv.label}
                </button>
              ))}
            </div>
          </div>

          {loadingChart ? (
            <div className="flex h-[280px] items-center justify-center text-xs text-muted">
              در حال بارگذاری نمودار…
            </div>
          ) : (
            <Chart points={points} />
          )}
        </div>

        {/* فهرست بازارها */}
        <div className="rounded-2xl border border-line bg-surface/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold">بازارها</h3>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی بازار…"
              className="no-zoom w-full rounded-xl border border-line bg-ink/50 px-4 py-2 text-xs outline-none transition focus:border-gold/60 sm:w-64"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`no-zoom rounded-full border px-3.5 py-1 text-[11px] font-bold transition ${
                  cat === c.id
                    ? "border-gold bg-gold text-ink"
                    : "border-line text-muted hover:border-gold/40 hover:text-cream"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[380px] overflow-y-auto rounded-xl border border-line">
            {list.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted">
                بازاری با این فیلتر پیدا نشد.
              </div>
            ) : (
              list.map((m, i) => {
                const active = m.id === sel;
                const done = mine.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSel(m.id)}
                    className={`no-zoom flex w-full items-center gap-3 px-4 py-3 text-start transition ${
                      active
                        ? "bg-gold/10"
                        : i % 2
                          ? "bg-surface/30 hover:bg-raised/40"
                          : "hover:bg-raised/40"
                    }`}
                  >
                    <span
                      className={`h-8 w-1 shrink-0 rounded-full ${
                        active ? "bg-gold" : "bg-transparent"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-xs font-bold" dir="ltr">
                        {m.question}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                        <span>{m.categoryLabel}</span>
                        <span>·</span>
                        <span>{closesIn(m.endDate)}</span>
                        {done && <span className="text-gold">· ثبت‌شده</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block font-mono text-xs font-bold text-gain" dir="ltr">
                        {m.yesPct}%
                      </span>
                      <span className="block font-mono text-[9px] text-muted" dir="ltr">
                        {fmtVol(m.volume)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* پنل سفارش */}
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-line bg-surface/60 p-5 lg:sticky lg:top-24">
          <h3 className="font-mono text-[11px] tracking-[0.3em] text-gold" dir="ltr">
            PLACE PREDICTION
          </h3>

          {!loading && !player ? (
            <div className="mt-4">
              <p className="text-[11px] leading-6 text-muted">
                برای ثبت پیش‌بینی وارد حساب شوید.
              </p>
              <div className="mt-4">
                <AuthPanel onAuthed={() => refresh()} />
              </div>
            </div>
          ) : (
            <>
              {player && (
                <div className="mt-4 flex justify-between rounded-xl border border-line bg-ink/40 px-4 py-3 text-[11px]">
                  <span className="text-muted">
                    رایگان امروز:{" "}
                    <b className="font-mono text-gain" dir="ltr">
                      {freeLeft}
                    </b>
                  </span>
                  <span className="text-muted">
                    کردیت:{" "}
                    <b className="font-mono text-cream" dir="ltr">
                      {player.credits}◆
                    </b>
                  </span>
                </div>
              )}

              {market && (
                <>
                  <p className="mt-4 line-clamp-2 text-[11px] leading-6 text-muted" dir="ltr">
                    {market.question}
                  </p>

                  {my ? (
                    <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 px-4 py-4 text-center">
                      <div className="text-[11px] text-muted">پیش‌بینی ثبت‌شده</div>
                      <div
                        className={`mt-1 text-lg font-black ${
                          my.choice === "yes" ? "text-gain" : "text-loss"
                        }`}
                      >
                        {my.choice === "yes" ? "بله" : "خیر"}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
                        entry {my.probPct}%
                      </div>
                      <div className="mt-3 border-t border-line pt-3 text-[11px]">
                        {my.status === "settled" ? (
                          <span
                            className={`font-mono font-bold ${
                              (my.points ?? 0) >= 0 ? "text-gain" : "text-loss"
                            }`}
                            dir="ltr"
                          >
                            {(my.points ?? 0) >= 0 ? "+" : ""}
                            {my.points}
                          </span>
                        ) : (
                          <span className="text-muted">در انتظار نتیجه</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => place("yes")}
                        className="no-zoom flex items-center justify-between rounded-xl border border-gain/50 px-4 py-3.5 text-sm font-bold text-gain transition hover:bg-gain hover:text-ink disabled:opacity-50"
                      >
                        <span>بله</span>
                        <span className="font-mono text-[11px]" dir="ltr">
                          {market.yesPct}% → +{yesWin}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => place("no")}
                        className="no-zoom flex items-center justify-between rounded-xl border border-loss/50 px-4 py-3.5 text-sm font-bold text-loss transition hover:bg-loss hover:text-ink disabled:opacity-50"
                      >
                        <span>خیر</span>
                        <span className="font-mono text-[11px]" dir="ltr">
                          {Math.round((100 - market.yesPct) * 10) / 10}% → +{noWin}
                        </span>
                      </button>

                      <div className="mt-2 flex justify-between text-[10px] text-muted">
                        <span>هزینه</span>
                        <span className="font-mono" dir="ltr">
                          {freeLeft > 0 ? "رایگان" : "1◆"}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted">
                        <span>سررسید</span>
                        <span>{faDate(market.endDate)}</span>
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-muted">
                        امتیاز برد = ۱۰۰ منهای احتمال گزینه‌ی شما. هرچه گزینه
                        کم‌احتمال‌تر باشد، پاداش بیشتر است.
                      </p>
                    </div>
                  )}

                  {err && <p className="mt-3 text-[11px] text-loss">{err}</p>}
                  {ok && !err && (
                    <p className="mt-3 text-[11px] text-gain">پیش‌بینی ثبت شد ✓</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {open.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface/50 p-5">
            <h3 className="text-sm font-bold">پوزیشن‌های باز</h3>
            <div className="mt-3 flex flex-col gap-2">
              {open.slice(0, 8).map((p) => (
                <button
                  key={p.marketId}
                  type="button"
                  onClick={() => setSel(p.marketId)}
                  className="no-zoom flex items-center justify-between gap-2 rounded-xl border border-line bg-ink/30 px-3 py-2.5 text-start text-[11px] transition hover:border-gold/50"
                >
                  <span className="line-clamp-1 flex-1 text-muted" dir="ltr">
                    {p.question}
                  </span>
                  <span
                    className={`shrink-0 font-bold ${
                      p.choice === "yes" ? "text-gain" : "text-loss"
                    }`}
                  >
                    {p.choice === "yes" ? "بله" : "خیر"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
