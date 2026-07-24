"use client";

import { useState } from "react";
import type { MarketData } from "@/lib/market";
import type { Player, PredictedKey } from "@/components/predict/usePlayer";
import { TIMEFRAMES, volScaleFor, isAssetOpen } from "@/lib/game";

const CAT_ICON: Record<string, string> = {
  crypto: "M9 4v16M9 4h4.5a3 3 0 010 6H9m0 0h5a3 3 0 010 6H9M11 2v2m3-2v2M11 20v2m3-2v2",
  forex: "M4 18h16M7 15l3-4 3 3 4-6",
  metal: "M12 3l7 4v10l-7 4-7-4V7z",
  stock: "M4 19h16M6 16V9m5 7V5m5 11v-6",
};

function fmt(n: number | null, decimals: number): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Spark({ series }: { series: { t: number; p: number }[] }) {
  if (series.length < 2) return null;
  const W = 300;
  const H = 56;
  const ps = series.map((s) => s.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = max - min || 1;
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - 4 - ((s.p - min) / span) * (H - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = ps[ps.length - 1] >= ps[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none">
      <path
        d={`M ${pts[0]} L ${pts.slice(1).join(" L ")}`}
        fill="none"
        stroke={up ? "var(--color-gain)" : "var(--color-loss)"}
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function AssetCard({
  data,
  player,
  predicted,
  freeRemaining,
  onPredicted,
}: {
  data: MarketData;
  player: Player | null;
  predicted: PredictedKey[];
  freeRemaining: Record<string, number>;
  onPredicted: () => void;
}) {
  const [tfId, setTfId] = useState<string>("24h");
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const asset = data.asset;
  const marketOpen = isAssetOpen(asset);
  const volScale = volScaleFor(data.dailyVolPct);
  const isPredicted = predicted.some(
    (p) => p.asset === asset && p.timeframe === tfId
  );
  const up = (data.changePct ?? 0) >= 0;

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, timeframe: tfId, guess: Number(guess) }),
      });
      const j = await res.json();
      if (!j.ok) {
        const map: Record<string, string> = {
          not_authed: "برای ثبت پیش‌بینی وارد شوید.",
          already_predicted: "برای این تایم‌فریم قبلاً پیش‌بینی ثبت کرده‌اید.",
          insufficient_credits: "کردیت کافی ندارید.",
          daily_limit: "سقف مجاز امروز این تایم‌فریم پر شده است.",
          market_closed: "بازار این دارایی الان بسته است.",
          bad_guess: "قیمت واردشده معتبر نیست.",
        };
        setMsg({ text: map[j.error] ?? "خطایی رخ داد.", ok: false });
        return;
      }
      setGuess("");
      setMsg({ text: "پیش‌بینی ثبت شد ✓", ok: true });
      onPredicted();
    } catch {
      setMsg({ text: "ارتباط با سرور برقرار نشد.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                d={CAT_ICON[data.category] ?? CAT_ICON.crypto}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold">{data.label}</h2>
            <span
              className="font-mono text-[11px] tracking-widest text-muted"
              dir="ltr"
            >
              {asset} / USD
            </span>
          </div>
        </div>

        <div className="text-end">
          <span
            className="flex items-center justify-end gap-2 font-mono text-2xl font-bold text-cream md:text-3xl"
            dir="ltr"
          >
            {marketOpen && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
              </span>
            )}
            {fmt(data.price, data.decimals)}
          </span>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 font-mono text-xs ${
              up ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
            }`}
            dir="ltr"
          >
            {data.changePct == null
              ? "—"
              : `${up ? "+" : ""}${data.changePct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-ink/30 px-3 py-2">
        <Spark series={data.series} />
        <div className="flex justify-between font-mono text-[9px] text-muted" dir="ltr">
          <span>24h</span>
          <span>
            vol {data.dailyVolPct == null ? "—" : `${data.dailyVolPct.toFixed(2)}%`} ·
            scale ×{volScale}
          </span>
        </div>
      </div>

      {!marketOpen && (
        <p className="mt-4 rounded-xl border border-loss/30 bg-loss/5 px-4 py-3 text-[11px] text-muted">
          بازار این دارایی در حال حاضر بسته است؛ راند جدید با بازگشایی بازار
          فعال می‌شود.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIMEFRAMES.map((t) => {
          const active = t.id === tfId;
          const left = freeRemaining[t.id] ?? 0;
          const paid = left <= 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTfId(t.id)}
              className={`no-zoom flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition ${
                active
                  ? "border-gold/60 bg-gold/10 text-gold shadow-[0_0_18px_rgba(232,196,106,0.18)]"
                  : "border-line text-muted hover:border-gold/30 hover:text-cream"
              }`}
            >
              {t.label}
              <span
                className={`font-mono text-[10px] ${paid ? "" : "text-gain"}`}
                dir="ltr"
              >
                {paid ? `${t.cost}◆` : "رایگان"}
              </span>
            </button>
          );
        })}
      </div>

      {player ? (
        isPredicted ? (
          <p className="mt-5 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-xs text-muted">
            پیش‌بینی این تایم‌فریم ثبت شده — منتظر تسویه بمانید.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              inputMode="decimal"
              placeholder={`قیمت پیش‌بینی‌شده (${data.label})`}
              className="no-zoom rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm outline-none transition focus:border-gold/60"
              dir="ltr"
            />
            <button
              type="button"
              disabled={busy || !guess || !marketOpen}
              onClick={submit}
              className="no-zoom rounded-xl bg-gold py-3.5 font-display font-extrabold text-ink shadow-[0_8px_24px_rgba(232,196,106,0.25)] transition hover:bg-gold-deep hover:shadow-[0_8px_32px_rgba(232,196,106,0.35)] disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? "…" : "ثبت پیش‌بینی"}
            </button>
          </div>
        )
      ) : (
        <p className="mt-5 text-center text-[11px] text-muted">
          برای ثبت پیش‌بینی وارد حساب شوید.
        </p>
      )}

      {msg && (
        <p
          className={`mt-3 text-center text-[11px] ${
            msg.ok ? "text-gain" : "text-loss"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
