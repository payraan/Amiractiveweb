"use client";

import { useEffect, useState } from "react";

type Found = {
  username: string;
  displayName: string;
  credits: number;
  totalPoints: number;
  streak: number;
  createdAt: string;
};

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setLoginErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!j.ok) {
        setLoginErr("رمز عبور اشتباه است.");
        return;
      }
      setAuthed(true);
      setPassword("");
    } catch {
      setLoginErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto mt-32 max-w-sm px-6">
        <h1 className="font-display text-2xl font-black">پنل مدیریت امیراکتیو</h1>
        <p className="mt-2 text-xs text-muted">برای ادامه، رمز مدیریت را وارد کنید.</p>
        <input
          type="password"
          dir="ltr"
          placeholder="رمز مدیریت"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          className="mt-5 w-full rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream focus:border-gold focus:outline-none"
        />
        {loginErr && <p className="mt-2 text-xs text-loss">{loginErr}</p>}
        <button
          type="button"
          onClick={login}
          disabled={busy || !password}
          className="mt-4 w-full rounded-xl bg-gold py-3 font-display font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
        >
          {busy ? "…" : "ورود"}
        </button>
      </div>
    );
  }

  return <AdminHome />;
}

type Overview = {
  total_players: number;
  active_players: number;
  total_predictions: number;
  paid_predictions: number;
  settled_rounds: number;
};
type Sales = { credits_sold: number; credits_net: number; topup_count: number };
type UserRow = {
  username: string;
  displayName: string;
  credits: number;
  totalPoints: number;
  plays: number;
  createdAt: string;
};
type TopupRow = {
  username: string;
  displayName: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

function StatsView() {
  const [data, setData] = useState<{
    overview: Overview;
    sales: Sales;
    users: UserRow[];
    topups: TopupRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mt-6 text-xs text-muted">در حال بارگذاری آمار…</div>;
  if (!data) return <div className="mt-6 text-xs text-loss">خطا در دریافت آمار.</div>;

  const { overview: o, sales, users, topups } = data;
  const cards = [
    { label: "کل کاربران", value: o.total_players },
    { label: "کاربران فعال (۷ روز)", value: o.active_players },
    { label: "کل پیش‌بینی‌ها", value: o.total_predictions },
    { label: "پیش‌بینی پولی", value: o.paid_predictions },
    { label: "کردیت فروخته‌شده", value: `${sales.credits_sold}◆` },
    { label: "تعداد شارژ", value: sales.topup_count },
  ];

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-raised/40 px-4 py-3">
            <div className="text-[11px] text-muted">{c.label}</div>
            <div className="mt-1 font-mono text-xl font-bold text-gold" dir="ltr">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">آخرین شارژها</h3>
        <div className="overflow-hidden rounded-xl border border-line text-xs">
          {topups.length === 0 ? (
            <div className="px-4 py-4 text-muted">هنوز شارژی ثبت نشده.</div>
          ) : (
            topups.map((t, i) => (
              <div key={i} className={`flex items-center justify-between gap-2 px-4 py-2 ${i % 2 ? "bg-surface/30" : "bg-surface/50"}`}>
                <span className="font-mono" dir="ltr">@{t.username}</span>
                <span className="text-muted">{t.note ?? "—"}</span>
                <span className={`font-mono font-bold ${t.amount >= 0 ? "text-gain" : "text-loss"}`} dir="ltr">
                  {t.amount >= 0 ? "+" : ""}{t.amount}◆
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">جدیدترین کاربران</h3>
        <div className="overflow-hidden rounded-xl border border-line text-xs">
          {users.map((u, i) => (
            <div key={i} className={`flex items-center justify-between gap-2 px-4 py-2 ${i % 2 ? "bg-surface/30" : "bg-surface/50"}`}>
              <span className="flex items-center gap-2">
                <span className="font-bold">{u.displayName}</span>
                <span className="font-mono text-muted" dir="ltr">@{u.username}</span>
              </span>
              <span className="flex gap-4 font-mono" dir="ltr">
                <span className="text-gold">{u.credits}◆</span>
                <span className="text-muted">{u.plays}p</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminHome() {
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setMsg(null);
    setFound(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/user?username=${encodeURIComponent(username)}`,
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!j.ok) {
        setMsg({ ok: false, text: "کاربری با این آیدی پیدا نشد." });
        return;
      }
      setFound(j.player);
    } catch {
      setMsg({ ok: false, text: "خطا در ارتباط." });
    } finally {
      setBusy(false);
    }
  }

  async function topup() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount: Number(amount), note }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg({ ok: false, text: `خطا: ${j.error}` });
        return;
      }
      setMsg({ ok: true, text: `کردیت جدید ${j.username}: ${j.newCredits}◆` });
      setFound((f) => (f ? { ...f, credits: j.newCredits } : f));
      setAmount("");
      setNote("");
    } catch {
      setMsg({ ok: false, text: "خطا در ارتباط." });
    } finally {
      setBusy(false);
    }
  }

  const [tab, setTab] = useState<"charge" | "stats">("charge");

  return (
    <div className="mx-auto mt-24 max-w-2xl px-6 pb-24">
      <h1 className="font-display text-2xl font-black">پنل مدیریت</h1>

      <div className="mt-6 flex gap-2 rounded-xl border border-line bg-raised/40 p-1">
        <button
          type="button"
          onClick={() => setTab("charge")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${tab === "charge" ? "bg-gold text-ink" : "text-muted"}`}
        >
          شارژ کردیت
        </button>
        <button
          type="button"
          onClick={() => setTab("stats")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${tab === "stats" ? "bg-gold text-ink" : "text-muted"}`}
        >
          آمار
        </button>
      </div>

      {tab === "stats" && <StatsView />}

      {tab === "charge" && (
      <div className="mt-6 rounded-2xl border border-line bg-surface/50 p-6">
        <h2 className="text-sm font-bold">شارژ کردیت کاربر</h2>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            dir="ltr"
            placeholder="@username تلگرام"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={busy || !username}
            className="rounded-xl border border-line px-5 text-sm font-bold text-cream transition hover:border-gold hover:text-gold disabled:opacity-50"
          >
            جستجو
          </button>
        </div>

        {found && (
          <div className="mt-4 rounded-xl border border-line bg-raised/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold">{found.displayName}</span>
              <span className="font-mono text-muted" dir="ltr">
                @{found.username}
              </span>
            </div>
            <div className="mt-3 flex gap-6 font-mono text-xs" dir="ltr">
              <span>credits: <b className="text-gold">{found.credits}◆</b></span>
              <span>points: <b>{found.totalPoints}</b></span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="تعداد کردیت (مثبت یا منفی)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-line bg-ink/60 px-4 py-3 font-mono text-sm text-cream focus:border-gold focus:outline-none"
              />
              <input
                type="text"
                placeholder="یادداشت (اختیاری، مثلا: خرید بسته ۲۰۰)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-line bg-ink/60 px-4 py-3 text-sm text-cream focus:border-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={topup}
                disabled={busy || !amount}
                className="rounded-xl bg-gold py-3 font-display font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
              >
                اعمال شارژ
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-4 text-xs ${msg.ok ? "text-gain" : "text-loss"}`}>{msg.text}</p>
        )}
      </div>
      )}
    </div>
  );
}
