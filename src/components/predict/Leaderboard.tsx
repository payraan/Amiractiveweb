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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/predict/leaderboard?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setEntries(j.entries ?? []);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range]);

  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <div>
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
    </div>
  );
}
