"use client";

import type { MarketData } from "@/lib/market";
import { usePlayer } from "@/components/predict/usePlayer";
import AssetCard from "@/components/predict/AssetCard";
import AuthPanel from "@/components/predict/AuthPanel";

export default function PredictBoard({
  btc,
  xau,
}: {
  btc: MarketData;
  xau: MarketData;
}) {
  const { player, predicted, freeRemaining, loading, refresh, setPlayer } = usePlayer();

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
            <p className="mt-4 text-[11px] leading-6 text-muted">
              امتیاز از دقت پیش‌بینی می‌آید و خرید و فروش نمی‌شود. کردیت فقط
              تایم‌فریم‌های کوتاه‌تر و پیش‌بینی بیشتر را باز می‌کند.
            </p>
          </div>
        ) : (
          <AuthPanel onAuthed={() => refresh()} />
        )}
      </div>
    </>
  );
}
