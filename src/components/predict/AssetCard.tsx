"use client";

import { useEffect, useRef, useState } from "react";
import type { Asset, MarketData, MarketPoint } from "@/lib/market";
import { errorText, type Player } from "@/components/predict/usePlayer";

function buildPath(series: MarketPoint[], w = 320, h = 96) {
  if (series.length < 2) return null;
  const ps = series.map((s) => s.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = max - min || 1;
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((s.p - min) / span) * (h - 10) - 5;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, min, max };
}

function useCountdown() {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const t = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          17,
          30,
          0
        )
      );
      if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
      const s = Math.floor((t.getTime() - now.getTime()) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setLeft(`${h}:${m}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

function fmt(n: number | null, asset: Asset) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: asset === "BTC" ? 0 : 2,
  });
}

export default function AssetCard({
  title,
  symbol,
  initial,
  player,
  alreadyPredicted,
  onPredicted,
}: {
  title: string;
  symbol: string;
  initial: MarketData;
  player: Player | null;
  alreadyPredicted: boolean;
  onPredicted: (asset: Asset) => void;
}) {
  const [data, setData] = useState<MarketData>(initial);
  const asset = initial.asset;
  const countdown = useCountdown();
  const [guess, setGuess] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/predict/market", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const next = asset === "BTC" ? j?.btc : j?.xau;
        if (next && typeof next.updatedAt === "number") setData(next);
      } catch {
        /* keep last */
      }
    };
    timer.current = setInterval(refresh, 60_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [asset]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, guess: Number(guess) }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(errorText(j.error));
        return;
      }
      setDone(true);
      onPredicted(asset);
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  const chart = buildPath(data.series);
  const up = (data.changePct ?? 0) >= 0;
  const gradId = `predict-grad-${asset}`;
  const locked = done || alreadyPredicted;

  return (
    <div className="frame-hover rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <span className="font-mono text-[11px] tracking-widest text-muted" dir="ltr">
            {symbol}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-2xl font-bold text-cream md:text-3xl" dir="ltr">
            ${fmt(data.price, asset)}
          </span>
          <span className={`font-mono text-xs ${up ? "text-gain" : "text-loss"}`} dir="ltr">
            {data.changePct == null ? "" : `${up ? "+" : ""}${data.changePct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      <div className="mt-5">
        {chart ? (
          <svg viewBox="0 0 320 96" className="w-full" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.2" />
                <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill={`url(#${gradId})`} />
            <path
              d={chart.line}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="1.8"
              pathLength={1}
              className="draw"
            />
          </svg>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-line text-xs text-muted">
            در حال دریافت داده‌ی نمودار…
          </div>
        )}
        {chart && (
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted" dir="ltr">
            <span>L ${fmt(chart.min, asset)}</span>
            <span>H ${fmt(chart.max, asset)}</span>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-raised/60 px-4 py-3">
        <span className="text-xs text-muted">بسته‌شدن پیش‌بینی امروز</span>
        <span className="font-mono text-sm font-bold text-gold" dir="ltr">
          {countdown}
        </span>
      </div>

      <div className="mt-5">
        {locked ? (
          <div className="rounded-xl border border-gain/40 bg-gain/10 px-4 py-4 text-center text-sm text-gain">
            پیش‌بینی شما برای امروز ثبت شد ✓
          </div>
        ) : !player ? (
          <div className="rounded-xl border border-line bg-raised/40 px-4 py-4 text-center text-xs leading-6 text-muted">
            برای ثبت پیش‌بینی، از پایین صفحه وارد شوید یا ثبت‌نام کنید.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder="پیش‌بینی قیمت فردا (USD)"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              className="w-full rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream placeholder:text-muted focus:border-gold focus:outline-none"
            />
            {err && <p className="text-xs leading-6 text-loss">{err}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !guess}
              className="no-zoom rounded-xl bg-gold py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
            >
              {busy ? "در حال ثبت…" : "ثبت پیش‌بینی"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
