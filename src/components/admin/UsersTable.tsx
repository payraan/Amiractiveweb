"use client";

import { useCallback, useEffect, useState } from "react";

type U = {
  id: number;
  tg: string;
  name: string;
  credits: number;
  points: number;
  balance: number;
  streak: number;
  lastPlayed: string | null;
  joined: string;
  tgLinked: boolean;
  pulsePreds: number;
  arenaPreds: number;
  combos: number;
  challenges: number;
  irBets: number;
  irVolume: number;
  topupCredits: number;
};

type Totals = {
  players: number;
  credits: number;
  points: number;
  balance: number;
  tg_linked: number;
  active_7d: number;
};

const SORTS = [
  { id: "recent", label: "تازه‌ترین" },
  { id: "active", label: "فعال‌ترین" },
  { id: "points", label: "بیشترین امتیاز" },
  { id: "credits", label: "بیشترین MOON" },
  { id: "balance", label: "بیشترین موجودی" },
] as const;

const fa = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("fa-IR", {
        timeZone: "Asia/Tehran",
        month: "short",
        day: "numeric",
      })
    : "—";

export default function UsersTable() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string>("recent");
  const [rows, setRows] = useState<U[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/users?q=${encodeURIComponent(q)}&sort=${sort}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (j.ok) {
        setRows(j.users);
        setTotals(j.totals);
      }
    } finally {
      setLoading(false);
    }
  }, [q, sort]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div>
      {totals && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="کاربران" v={totals.players} />
          <Stat label="فعال ۷ روز" v={totals.active_7d} tone="gain" />
          <Stat label="تلگرام وصل" v={totals.tg_linked} />
          <Stat label="کل MOON" v={totals.credits} />
          <Stat label="کل امتیاز" v={totals.points} tone="gold" />
          <Stat label="موجودی تتر" v={`$${Number(totals.balance).toFixed(2)}`} tone="gain" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی نام یا آیدی تلگرام…"
          className="flex-1 rounded-xl border border-line bg-raised/50 px-4 py-2 text-xs text-cream focus:border-gold focus:outline-none"
        />
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
              sort === s.id
                ? "border-gold bg-gold/10 text-gold"
                : "border-line text-muted hover:text-cream"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-muted">در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">کاربری یافت نشد.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[900px] text-[11px]">
            <thead className="bg-raised/60 text-muted">
              <tr>
                {["کاربر","تلگرام","MOON","امتیاز","تتر","استریک","نبض","آرنا","کمبو","چلنج","شرط ایران","حجم ایران","شارژ","آخرین بازی","عضویت"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-start font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <tr key={u.id} className={i % 2 ? "bg-surface/25" : ""}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-cream">
                    {u.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted" dir="ltr">
                    {u.tgLinked ? (
                      <span className="text-gain">@{u.tg} ✓</span>
                    ) : (
                      <span>@{u.tg}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{u.credits}</td>
                  <td className={`px-3 py-2 font-mono ${u.points >= 0 ? "text-gain" : "text-loss"}`} dir="ltr">
                    {u.points}
                  </td>
                  <td className="px-3 py-2 font-mono text-gain" dir="ltr">
                    ${u.balance.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{u.streak}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.pulsePreds}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.arenaPreds}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.combos}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.challenges}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.irBets}</td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">
                    ${u.irVolume.toFixed(0)}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted" dir="ltr">{u.topupCredits}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fa(u.lastPlayed)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fa(u.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  v,
  tone,
}: {
  label: string;
  v: number | string;
  tone?: "gain" | "gold";
}) {
  const c = tone === "gain" ? "text-gain" : tone === "gold" ? "text-gold" : "text-cream";
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-4 py-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${c}`} dir="ltr">
        {typeof v === "number" ? v.toLocaleString("en-US") : v}
      </div>
    </div>
  );
}
