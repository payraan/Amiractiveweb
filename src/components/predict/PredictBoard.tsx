"use client";

import { useState } from "react";
import type { MarketData, Asset } from "@/lib/market";
import { usePlayer, type Player } from "@/components/predict/usePlayer";
import AssetCard from "@/components/predict/AssetCard";
import AuthPanel from "@/components/predict/AuthPanel";

export default function PredictBoard({
  btc,
  xau,
}: {
  btc: MarketData;
  xau: MarketData;
}) {
  const { player, predicted, loading, refresh, setPredicted } = usePlayer();
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const active = player ?? localPlayer;

  const markPredicted = (asset: Asset) =>
    setPredicted((prev) => (prev.includes(asset) ? prev : [...prev, asset]));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <AssetCard
          title="بیت‌کوین"
          symbol="BTC / USD"
          initial={btc}
          player={active}
          alreadyPredicted={predicted.includes("BTC")}
          onPredicted={markPredicted}
        />
        <AssetCard
          title="طلا (انس جهانی)"
          symbol="XAU / USD"
          initial={xau}
          player={active}
          alreadyPredicted={predicted.includes("XAU")}
          onPredicted={markPredicted}
        />
      </div>

      <div className="mt-8 max-w-md">
        {loading ? null : active ? (
          <div className="rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted">حساب شما</div>
                <div className="font-display text-lg font-extrabold">
                  {active.displayName}
                </div>
              </div>
              <div className="text-end">
                <div className="text-xs text-muted">امتیاز کل</div>
                <div className="font-mono text-2xl font-bold text-gold" dir="ltr">
                  {active.totalPoints}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AuthPanel
            onAuthed={(p) => {
              setLocalPlayer(p);
              refresh();
            }}
          />
        )}
      </div>
    </>
  );
}
