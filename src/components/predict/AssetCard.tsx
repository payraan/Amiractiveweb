"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketData } from "@/lib/market";
import {
  TIMEFRAMES,
  nextClose,
  isAssetOpen,
  type Asset,
  type TimeframeId,
} from "@/lib/game";
import { errorText, type Player, type PredictedKey } from "@/components/predict/usePlayer";
import LiveChart from "@/components/predict/LiveChart";

function useCountdown(target: Date | null) {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setLeft(`${h}:${m}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function fmt(n: number | null, asset: Asset) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: asset === "BTC" ? 0 : 2 });
}

export default function AssetCard({
  title,
  symbol,
  initial,
  player,
  predicted,
  freeRemaining,
  onPredicted,
}: {
  title: string;
  symbol: string;
  initial: MarketData;
  player: Player | null;
  predicted: PredictedKey[];
  freeRemaining: Record<string, number>;
  onPredicted: () => void;
}) {
  const [data, setData] = useState<MarketData>(initial);
  const asset = initial.asset;
  const [tfId, setTfId] = useState<TimeframeId>("24h");
  const [guess, setGuess] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const marketOpen = isAssetOpen(asset);
  const tfMeta = TIMEFRAMES.find((t) => t.id === tfId)!;
  const closeAt = useMemo(() => nextClose(tfMeta.hours), [tfMeta.hours]);
  const countdown = useCountdown(closeAt);

  const isPredicted = predicted.some((p) => p.asset === asset && p.timeframe === tfId);
  const freeLeft = freeRemaining[tfId] ?? 0;
  const isFree = tfMeta.freeFirst > 0 && freeLeft > 0;
  const cost = isFree ? 0 : tfMeta.cost;
  const canAfford = !player ? false : cost === 0 || player.credits >= cost;

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
        body: JSON.stringify({ asset, timeframe: tfId, guess: Number(guess) }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(errorText(j.error));
        return;
      }
      setGuess("");
      onPredicted();
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  const up = (data.changePct ?? 0) >= 0;

  return (
    <div className="frame-hover rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            {asset === "BTC" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M9 4v16M9 4h4.5a3 3 0 010 6H9m0 0h5a3 3 0 010 6H9M11 2v2m3-2v2M11 20v2m3-2v2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M4.5 15.5l1.8-4.5h4.4l1.8 4.5H4.5zM11.5 15.5l1.8-4.5h4.4l1.8 4.5h-8zM8 10.5l1.8-4.5h4.4l-.9 2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold">{title}</h2>
            <span className="font-mono text-[11px] tracking-widest text-muted" dir="ltr">
              {symbol}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-2 font-mono text-2xl font-bold text-cream md:text-3xl" dir="ltr">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
            </span>
            ${fmt(data.price, asset)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${
              up ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
            }`}
            dir="ltr"
          >
            {data.changePct == null ? "—" : `${up ? "+" : ""}${data.changePct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <LiveChart asset={asset} interval={tfId} />
      </div>

      {!marketOpen ? (
        <div className="mt-5 rounded-xl border border-line bg-raised/40 px-4 py-6 text-center text-sm text-muted">
          بازار طلا در تعطیلات آخر هفته بسته است. راند بعدی از یکشنبه‌شب آغاز می‌شود.
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIMEFRAMES.map((t) => {
              const active = t.id === tfId;
              const paid = t.freeFirst === 0 || (freeRemaining[t.id] ?? 0) === 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTfId(t.id);
                    setErr(null);
                  }}
                  className={`no-zoom flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs transition ${
                    active
                      ? "border-gold/60 bg-gold/10 text-gold shadow-[0_0_18px_rgba(232,196,106,0.18)]"
                      : "border-line text-muted hover:border-gold/30 hover:text-cream"
                  }`}
                >
                  <span className="font-bold">{t.label}</span>
                  <span className={`font-mono text-[10px] ${paid ? "" : "text-gain"}`} dir="ltr">
                    {paid ? `${t.cost}◆` : "رایگان"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-raised/60 px-4 py-3">
            <span className="flex items-center gap-2 text-xs text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          بسته‌شدن راند
        </span>
            <span className="font-mono text-sm font-bold text-gold" dir="ltr">
              {countdown}
            </span>
          </div>

          <div className="mt-4">
            {isPredicted ? (
              <div className="rounded-xl border border-gain/40 bg-gain/10 px-4 py-4 text-center text-sm text-gain">
                پیش‌بینی شما برای این راند ثبت شد ✓
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
                  placeholder="پیش‌بینی قیمت (USD)"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream placeholder:text-muted focus:border-gold focus:outline-none"
                />
                {err && <p className="text-xs leading-6 text-loss">{err}</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !guess || !canAfford}
                  className="no-zoom rounded-xl bg-gold py-3.5 font-display font-extrabold text-ink shadow-[0_8px_24px_rgba(232,196,106,0.25)] transition hover:bg-gold-deep hover:shadow-[0_8px_32px_rgba(232,196,106,0.35)] disabled:opacity-50 disabled:shadow-none"
                >
                  {busy
                    ? "در حال ثبت…"
                    : !canAfford
                    ? "کردیت کافی ندارید"
                    : cost === 0
                    ? `ثبت پیش‌بینی · رایگان (${freeLeft} باقی‌مانده)`
                    : `ثبت پیش‌بینی · ${cost} کردیت`}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
