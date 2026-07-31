"use client";

import { useEffect, useState } from "react";

type Entry = { rank: number; name: string; points: number; plays: number };

const TABS: { id: string; label: string }[] = [
  { id: "monthly", label: "ماهانه" },
  { id: "weekly", label: "هفتگی" },
  { id: "daily", label: "روزانه" },
  { id: "all", label: "کل" },
];

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function Leaderboard({
  defaultRange = "monthly",
  limit,
}: {
  defaultRange?: string;
  limit?: number;
}) {
  const [range, setRange] = useState(defaultRange);
  const [game, setGame] = useState<"main" | "combo">("main");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [maxCounted, setMaxCounted] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/predict/leaderboard?range=${range}&game=${game}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setEntries(j.entries ?? []);
        setMaxCounted(typeof j.maxCounted === "number" ? j.maxCounted : null);
        setTotalPlayers(Number(j.totalPlayers ?? 0));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range, game]);

  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <div>
      {/* دو رتبه‌بندی جدا: اصلی بدون اهرم، کمبو با اهرم */}
      <div className="mb-3 flex gap-2">
        {(
          [
            { id: "main" as const, label: "رتبه‌بندی اصلی", hint: "نبض بازار + آرنا" },
            { id: "combo" as const, label: "صدر کمبوها", hint: "با اهرم" },
          ]
        ).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGame(g.id)}
            className={`no-zoom flex flex-col items-start rounded-xl border px-4 py-2 text-start transition ${
              game === g.id
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-line text-muted hover:border-gold/30 hover:text-cream"
            }`}
          >
            <span className="text-xs font-bold">{g.label}</span>
            <span className="mt-0.5 text-[10px] opacity-80">{g.hint}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2 rounded-xl border border-line bg-raised/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRange(t.id)}
            className={`no-zoom flex-1 rounded-lg py-2 text-xs font-bold transition ${
              range === t.id ? "bg-gold text-ink" : "text-muted hover:text-cream"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-muted">در حال بارگذاری…</div>
      ) : shown.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted">
          هنوز نتیجه‌ای در این بازه ثبت نشده است.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {shown.map((e, i) => {
            const top = e.rank <= 3;
            return (
              <div
                key={e.rank}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                  i % 2 ? "bg-surface/30" : "bg-surface/50"
                } ${top ? "border-r-2 border-gold" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center font-mono text-xs ${
                      top ? "text-gold" : "text-muted"
                    }`}
                    dir="ltr"
                  >
                    {MEDAL[e.rank] ?? e.rank}
                  </span>
                  <span className={`font-bold ${top ? "text-cream" : "text-muted"}`}>
                    {e.name}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-muted" dir="ltr">
                    {e.plays} پیش‌بینی
                  </span>
                  <span
                    className={`font-mono font-bold ${e.points >= 0 ? "text-gain" : "text-loss"}`}
                    dir="ltr"
                  >
                    {e.points >= 0 ? "+" : ""}
                    {e.points}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {maxCounted !== null && (
        <p className="mt-4 text-[10px] leading-6 text-muted">
          {game === "combo"
            ? "این رتبه‌بندی فقط کمبوهاست و اهرم در آن آزاد است. فقط "
            : "امتیاز از نبض بازار و آرنا جمع می‌شود و فقط "}
          <b className="font-mono text-cream" dir="ltr">
            {maxCounted}
          </b>{" "}
          {game === "combo" ? "تیکتِ" : "پیش‌بینیِ"} نخستِ هر بازه محاسبه می‌شود.
          {game === "combo"
            ? " کمبو از رتبه‌بندی اصلی و ارزیابی چلنج پراپ جداست."
            : " پس همه در هر دوره فرصت برابر دارند و خرید کردیت رتبه نمی‌خرد."}
          {totalPlayers > 0 && (
            <>
              {" "}
              این دوره{" "}
              <b className="font-mono text-cream" dir="ltr">
                {totalPlayers}
              </b>{" "}
              بازیکن واجد شرایط دارد.
            </>
          )}
        </p>
      )}
    </div>
  );
}
