"use client";

import { useState } from "react";

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

  return (
    <div className="mx-auto mt-24 max-w-xl px-6 pb-24">
      <h1 className="font-display text-2xl font-black">پنل مدیریت</h1>

      <div className="mt-8 rounded-2xl border border-line bg-surface/50 p-6">
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

      <p className="mt-6 text-[11px] leading-6 text-muted">
        آمار کامل کاربران و فروش در بخش بعدی اضافه می‌شود.
      </p>
    </div>
  );
}
