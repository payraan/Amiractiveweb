"use client";

import { useState } from "react";
import type { MarketData } from "@/lib/market";
import { usePlayer } from "@/components/predict/usePlayer";
import AssetCard from "@/components/predict/AssetCard";
import AuthPanel from "@/components/predict/AuthPanel";
import ShareCard from "@/components/predict/ShareCard";
import type { GameResult } from "@/components/predict/usePlayer";

export default function PredictBoard({
  btc,
  xau,
}: {
  btc: MarketData;
  xau: MarketData;
}) {
  const { player, predicted, freeRemaining, results, loading, refresh, logout } =
    usePlayer();
  const [shareCard, setShareCard] = useState<GameResult | null>(null);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <AssetCard
          title="بیت‌کوین"
          symbol="BTC / USD"
          initial={btc}
          player={player}
          predicted={predicted}
          freeRemaining={freeRemaining}
          onPredicted={refresh}
        />
        <AssetCard
          title="طلا (انس جهانی)"
          symbol="XAU / USD"
          initial={xau}
          player={player}
          predicted={predicted}
          freeRemaining={freeRemaining}
          onPredicted={refresh}
        />
      </div>

      <div className="mt-8 max-w-md">
        {loading ? null : player ? (
          <div className="rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted">حساب شما</div>
                <div className="font-display text-lg font-extrabold">
                  {player.displayName}
                </div>
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
            <p className="mt-4 text-[11px] leading-6 text-muted">
              امتیاز از دقت پیش‌بینی می‌آید و خرید و فروش نمی‌شود. کردیت فقط
              تایم‌فریم‌های کوتاه‌تر و پیش‌بینی بیشتر را باز می‌کند.
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <a
                href="#credits"
                className="text-xs text-muted transition hover:text-gold"
              >
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
        ) : (
          <AuthPanel onAuthed={() => refresh()} />
        )}
      </div>

      {player && results.length > 0 && (
        <div className="mt-8 max-w-2xl">
          <h3 className="mb-3 text-sm font-bold">نتایج اخیر شما</h3>
          <div className="overflow-hidden rounded-2xl border border-line">
            {results.map((r, i) => {
              const win = (r.points ?? 0) >= 0;
              const label = r.asset === "BTC" ? "بیت‌کوین" : "طلا";
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                    i % 2 ? "bg-surface/30" : "bg-surface/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{label}</span>
                    <span className="text-muted">{r.timeframe}</span>
                  </span>
                  <span className="font-mono text-muted" dir="ltr">
                    {r.errorPct == null ? "—" : `خطا ${r.errorPct.toFixed(2)}٪`}
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold ${win ? "text-gain" : "text-loss"}`}
                      dir="ltr"
                    >
                      {(r.points ?? 0) >= 0 ? "+" : ""}
                      {r.points ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShareCard(r)}
                      className="no-zoom rounded-lg border border-gold/40 px-3 py-1 text-[10px] text-gold transition hover:bg-gold hover:text-ink"
                    >
                      کارت
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shareCard && player && (
        <ShareCard
          name={player.displayName}
          result={shareCard}
          onClose={() => setShareCard(null)}
        />
      )}
    </>
  );
}
