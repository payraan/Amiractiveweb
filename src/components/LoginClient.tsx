"use client";

import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";

export default function LoginClient() {
  const { player, loading, logout } = usePlayer();

  if (loading) {
    return <div className="py-16 text-center text-xs text-muted">در حال بررسی حساب…</div>;
  }

  if (player) {
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur">
        <div className="text-xs text-muted">شما وارد شده‌اید</div>
        <div className="mt-1 font-display text-xl font-extrabold">
          {player.displayName}
        </div>
        <div className="mt-3 flex gap-6 font-mono text-sm" dir="ltr">
          <span className="text-cream">{player.credits}◆</span>
          <span className="text-gold">{player.totalPoints} pts</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/arena"
            className="rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
          >
            آرنای پیش‌بینی
          </Link>
          <Link
            href="/predict"
            className="rounded-xl border border-line px-6 py-3 text-sm text-cream transition hover:border-gold hover:text-gold"
          >
            نبض بازار
          </Link>
          <button
            type="button"
            onClick={logout}
            className="no-zoom rounded-xl border border-line px-6 py-3 text-sm text-muted transition hover:border-loss hover:text-loss"
          >
            خروج از حساب
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthPanel
      onAuthed={() => {
        window.location.href = "/predict";
      }}
    />
  );
}
