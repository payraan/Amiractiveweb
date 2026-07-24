"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketData } from "@/lib/market";
import { CATEGORIES, type AssetCategory } from "@/lib/assets";
import { TIMEFRAMES, thresholdsFor, volScaleFor } from "@/lib/game";
import { usePlayer } from "@/components/predict/usePlayer";
import AssetCard from "@/components/predict/AssetCard";
import AuthPanel from "@/components/predict/AuthPanel";
import ShareCard from "@/components/predict/ShareCard";
import type { GameResult } from "@/components/predict/usePlayer";

export default function PredictBoard() {
  const { player, predicted, freeRemaining, results, loading, refresh, logout } =
    usePlayer();
  const [shareCard, setShareCard] = useState<GameResult | null>(null);
  const [cat, setCat] = useState<AssetCategory>("crypto");
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  const load = useCallback((c: AssetCategory) => {
    setLoadingMarkets(true);
    fetch(`/api/predict/market?category=${c}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list: MarketData[] = j.markets ?? [];
        setMarkets(list);
        setSel((cur) => {
          if (cur && list.some((m) => m.asset === cur)) return cur;
          return list[0]?.asset ?? null;
        });
        setLoadingMarkets(false);
      })
      .catch(() => setLoadingMarkets(false));
  }, []);

  useEffect(() => {
    load(cat);
    const id = setInterval(() => load(cat), 60_000);
    return () => clearInterval(id);
  }, [cat, load]);

  const selected = markets.find((m) => m.asset === sel) ?? null;
  const volScale = volScaleFor(selected?.dailyVolPct);

  return (
    <>
      {/* کتگوری‌ها */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCat(c.id);
              setSel(null);
            }}
            className={`no-zoom rounded-full border px-5 py-2 text-xs font-bold transition ${
              cat === c.id
                ? "border-gold bg-gold text-ink"
                : "border-line text-muted hover:border-gold/40 hover:text-cream"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* انتخاب دارایی */}
      {loadingMarkets && markets.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted">
          در حال دریافت قیمت‌ها…
        </div>
      ) : (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {markets.map((m) => {
            const active = m.asset === sel;
            const rising = (m.changePct ?? 0) >= 0;
            return (
              <button
                key={m.asset}
                type="button"
                onClick={() => setSel(m.asset)}
                className={`no-zoom flex shrink-0 flex-col items-start gap-0.5 rounded-xl border px-4 py-2.5 text-start transition ${
                  active
                    ? "border-gold/60 bg-gold/10"
                    : "border-line hover:border-gold/40"
                }`}
              >
                <span
                  className={`text-xs font-bold ${active ? "text-gold" : "text-cream"}`}
                >
                  {m.label}
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px]" dir="ltr">
                  <span className="text-muted">
                    {m.price == null
                      ? "—"
                      : m.price.toLocaleString("en-US", {
                          maximumFractionDigits: m.decimals,
                        })}
                  </span>
                  <span className={rising ? "text-gain" : "text-loss"}>
                    {m.changePct == null
                      ? ""
                      : `${rising ? "+" : ""}${m.changePct.toFixed(1)}%`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* کارت دارایی انتخاب‌شده */}
      {selected && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AssetCard
            data={selected}
            player={player}
            predicted={predicted}
            freeRemaining={freeRemaining}
            onPredicted={refresh}
          />

          {/* جدول امتیاز همین دارایی */}
          <div className="rounded-2xl border border-line bg-surface/40 p-6">
            <h3 className="text-sm font-bold">
              امتیازدهی <span className="text-gold">{selected.label}</span>
            </h3>
            <p className="mt-2 text-[11px] leading-6 text-muted">
              آستانه‌ها بر اساس نوسان واقعی این دارایی تنظیم شده‌اند (ضریب{" "}
              <span className="font-mono text-cream" dir="ltr">
                ×{volScale}
              </span>
              )، تا گرفتن امتیاز روی همه‌ی دارایی‌ها به یک اندازه مهارت بخواهد.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[380px] text-center text-[11px]">
                <thead>
                  <tr className="text-muted">
                    <th className="py-2 font-normal">امتیاز</th>
                    {TIMEFRAMES.map((t) => (
                      <th key={t.id} className="py-2 font-bold text-cream">
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {thresholdsFor("24h", volScale).map((row, i) => (
                    <tr key={i} className={i % 2 ? "bg-surface/30" : "bg-raised/30"}>
                      <td
                        className={`py-2 font-mono font-extrabold ${
                          row.points >= 0 ? "text-gain" : "text-loss"
                        }`}
                        dir="ltr"
                      >
                        {row.points >= 0 ? "+" : ""}
                        {row.points}
                      </td>
                      {TIMEFRAMES.map((t) => {
                        const rows = thresholdsFor(t.id, volScale);
                        const r = rows[i];
                        const prev = i > 0 ? rows[i - 1].maxErr : 0;
                        const f = (v: number) =>
                          v >= 1 ? v.toFixed(2) : v.toFixed(3);
                        const label =
                          r.maxErr === Infinity
                            ? `بیش از ${f(prev)}٪`
                            : i === 0
                              ? `تا ${f(r.maxErr)}٪`
                              : `${f(prev)}٪ تا ${f(r.maxErr)}٪`;
                        return (
                          <td key={t.id} className="py-2 font-mono text-muted">
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* حساب کاربری */}
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
              <a href="#credits" className="text-xs text-muted transition hover:text-gold">
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
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                    i % 2 ? "bg-surface/30" : "bg-surface/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-bold" dir="ltr">
                      {r.asset}
                    </span>
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
