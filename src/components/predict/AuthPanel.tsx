"use client";

import { useState } from "react";
import { errorText } from "@/components/predict/usePlayer";

export default function AuthPanel({
  onAuthed,
}: {
  onAuthed: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, username, password, displayName }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(errorText(j.error));
        return;
      }
      onAuthed();
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-7">
      <div className="mb-5 flex gap-2 rounded-xl border border-line bg-raised/50 p-1">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`no-zoom flex-1 rounded-lg py-2 text-sm font-bold transition ${
            mode === "register" ? "bg-gold text-ink" : "text-muted"
          }`}
        >
          ثبت‌نام
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`no-zoom flex-1 rounded-lg py-2 text-sm font-bold transition ${
            mode === "login" ? "bg-gold text-ink" : "text-muted"
          }`}
        >
          ورود
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          dir="ltr"
          placeholder="@username تلگرام"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream placeholder:text-muted focus:border-gold focus:outline-none"
        />
        {mode === "register" && (
          <input
            type="text"
            placeholder="نام نمایشی (در لیدربورد دیده می‌شود)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-line bg-raised/60 px-4 py-3 text-sm text-cream placeholder:text-muted focus:border-gold focus:outline-none"
          />
        )}
        <input
          type="password"
          dir="ltr"
          placeholder="رمز عبور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-line bg-raised/60 px-4 py-3 font-mono text-sm text-cream placeholder:text-muted focus:border-gold focus:outline-none"
        />

        {err && <p className="text-xs leading-6 text-loss">{err}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="no-zoom rounded-xl bg-gold py-3.5 font-display font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
        >
          {busy ? "لطفاً صبر کنید…" : mode === "register" ? "ساخت حساب" : "ورود"}
        </button>

        <p className="text-center text-[11px] leading-6 text-muted">
          آیدی تلگرام شما فقط برای حساب کاربری استفاده می‌شود و هیچ‌گاه به‌صورت
          عمومی نمایش داده نمی‌شود.
        </p>
      </div>
    </div>
  );
}
