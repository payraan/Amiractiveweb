"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlayer } from "@/components/predict/usePlayer";

type Tier = {
  id: string;
  label: string;
  fee: number;
  target: number;
  maxDrawdown: number;
  dailyLoss: number;
  minPreds: number;
  days: number;
  prize: string;
  popular: boolean;
};

type State = {
  tierId: string;
  label: string;
  status: string;
  failReason: string | null;
  points: number;
  target: number;
  drawdown: number;
  maxDrawdown: number;
  worstDay: number;
  dailyLoss: number;
  settledCount: number;
  minPreds: number;
  daysLeft: number;
  prize: string;
} | null;

const START_ERRORS: Record<string, string> = {
  active_exists: "یک چلنج فعال دارید؛ ابتدا آن را کامل کنید.",
  insufficient_credits: "کردیت کافی برای این چلنج ندارید.",
  not_authed: "برای شروع چلنج وارد شوید.",
};

const FAIL_TEXT: Record<string, string> = {
  drawdown: "افت از سقف بیش از حد مجاز شد.",
  daily_loss: "ضرر روزانه از سقف مجاز گذشت.",
  expired: "مهلت ۳۰ روزه تمام شد و هدف کامل نشد.",
};

function Bar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: "gold" | "loss";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
      <div
        className={`h-full rounded-full ${tone === "gold" ? "bg-gold" : "bg-loss"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ChallengePanel() {
  const { player, refresh } = usePlayer();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/predict/challenge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setTiers(j.tiers ?? []);
        setState(j.state ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(load, [load, player?.credits]);

  useEffect(() => {
    const onAuthed = () => {
      refresh();
      load();
    };
    window.addEventListener("amir:authed", onAuthed);
    return () => window.removeEventListener("amir:authed", onAuthed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(tierId: string) {
    setErr(null);
    setBusy(tierId);
    try {
      const res = await fetch("/api/predict/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(START_ERRORS[j.error] ?? "خطایی رخ داد.");
        return;
      }
      load();
      refresh();
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-xs text-muted">در حال بارگذاری چلنج…</div>;
  }

  // ── چلنج فعال / نتیجه ──
  if (state && state.status !== "failed") {
    const active = state.status === "active";
    return (
      <div
        className={`rounded-2xl border p-6 ${
          state.status === "passed"
            ? "border-gold bg-gold/10"
            : "border-gold/30 bg-surface/50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-muted" dir="ltr">
              CHALLENGE {state.label}
            </span>
            <h3 className="mt-1 font-display text-lg font-extrabold">
              {state.status === "passed" ? "🎉 چلنج با موفقیت پاس شد!" : "چلنج فعال شما"}
            </h3>
          </div>
          {active && (
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted" dir="ltr">
              {state.daysLeft}d left
            </span>
          )}
        </div>

        {state.status === "passed" ? (
          <div className="mt-4">
            <p className="text-sm leading-7">
              جایزه‌ی شما: <b className="text-gold">{state.prize}</b>
            </p>
            <a
              href={`https://t.me/Amiractive_support?text=${encodeURIComponent(
                `سلام، چلنج ${state.label} پراپ پیش‌بینی را پاس کردم و برای دریافت جایزه پیام می‌دهم.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="no-zoom mt-4 inline-block rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
            >
              دریافت جایزه از پشتیبانی
            </a>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">پیشرفت به هدف</span>
                <span className="font-mono" dir="ltr">
                  {state.points} / {state.target}
                </span>
              </div>
              <Bar value={Math.max(0, state.points)} max={state.target} tone="gold" />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">افت از سقف (حد {state.maxDrawdown})</span>
                <span className="font-mono text-loss" dir="ltr">
                  {state.drawdown}
                </span>
              </div>
              <Bar value={state.drawdown} max={state.maxDrawdown} tone="loss" />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">بدترین روز (حد −{state.dailyLoss})</span>
                <span className="font-mono" dir="ltr">
                  {state.worstDay}
                </span>
              </div>
              <Bar value={Math.abs(state.worstDay)} max={state.dailyLoss} tone="loss" />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">پیش‌بینی تسویه‌شده (حداقل {state.minPreds})</span>
                <span className="font-mono" dir="ltr">
                  {state.settledCount}
                </span>
              </div>
              <Bar value={state.settledCount} max={state.minPreds} tone="gold" />
            </div>
          </div>
        )}
        {active && (
          <p className="mt-4 text-[10px] leading-5 text-muted">
            جایزه‌ی پاس‌شدن: {state.prize}
          </p>
        )}
      </div>
    );
  }

  // ── انتخاب تیر (بدون چلنج فعال، یا بعد از شکست) ──
  return (
    <div>
      {state && state.status === "failed" && (
        <div className="mb-5 rounded-2xl border border-loss/40 bg-loss/5 px-5 py-4 text-xs leading-6">
          <b className="text-loss">چلنج {state.label} ناموفق شد: </b>
          <span className="text-muted">
            {FAIL_TEXT[state.failReason ?? ""] ?? "شرایط چلنج برقرار نماند."}
          </span>
          <span className="text-muted"> می‌توانید چلنج جدیدی شروع کنید.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.id}
            className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:border-gold/60 hover:shadow-[0_0_24px_rgba(232,196,106,0.12)] ${
              t.popular ? "border-gold/50 bg-surface/70" : "border-line bg-surface/40"
            }`}
          >
            {t.popular && (
              <span className="absolute -top-3 right-5 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-ink">
                محبوب
              </span>
            )}
            <span className="font-mono text-2xl font-extrabold text-cream" dir="ltr">
              {t.label}
            </span>
            <span className="mt-1 text-[10px] text-muted">حساب پراپ پیش‌بینی</span>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-bold text-gold" dir="ltr">
                {t.fee}◆
              </span>
              <span className="text-[10px] text-muted">ورودی چلنج</span>
            </div>

            <ul className="mt-4 flex flex-col gap-1.5 text-[11px] leading-5 text-muted">
              <li>— هدف: <b className="font-mono text-gain" dir="ltr">+{t.target}</b> پوینت</li>
              <li>— حداکثر افت از سقف: <b className="font-mono text-loss" dir="ltr">{t.maxDrawdown}</b></li>
              <li>— سقف ضرر روزانه: <b className="font-mono text-loss" dir="ltr">{t.dailyLoss}</b></li>
              <li>— حداقل {t.minPreds} پیش‌بینی تسویه‌شده</li>
              <li>— مهلت {t.days} روزه</li>
              <li className="text-cream">🏆 {t.prize}</li>
            </ul>

            <button
              type="button"
              disabled={busy === t.id}
              onClick={() => start(t.id)}
              className={`no-zoom mt-5 rounded-xl py-3 font-display text-sm font-extrabold transition disabled:opacity-50 ${
                t.popular
                  ? "bg-gold text-ink hover:bg-gold-deep"
                  : "border border-line text-cream hover:border-gold hover:text-gold"
              }`}
            >
              {busy === t.id ? "…" : "شروع چلنج"}
            </button>
          </div>
        ))}
      </div>

      {!player && (
        <p className="mt-4 text-[11px] text-muted">
          برای شروع چلنج، از بالای صفحه وارد حساب شوید یا ثبت‌نام کنید.
        </p>
      )}
      {err && <p className="mt-3 text-xs text-loss">{err}</p>}
    </div>
  );
}
