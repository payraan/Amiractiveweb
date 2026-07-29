"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlayer } from "@/components/predict/usePlayer";

type Tier = {
  id: string;
  track: "forex" | "predict";
  label: string;
  fee: number;
  target: number;
  maxDrawdown: number;
  dailyLoss: number;
  minPreds: number;
  minDays: number;
  days: number;
  prize: string;
  payoutNote: string | null;
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
  activeDays: number;
  minDays: number;
  bestDayPct: number;
  consistencyPct: number;
  consistencyOk: boolean;
  track: "forex" | "predict";
  payoutNote: string | null;
  daysLeft: number;
  prize: string;
} | null;

const START_ERRORS: Record<string, string> = {
  active_exists: "یک چلنج فعال دارید؛ ابتدا آن را کامل کنید.",
  entry_limit:
    "سقف ورود به چلنج حساب پیش‌بینی ۳ بار در ۳۰ روز است. کمی صبر کنید یا مسیر حساب معاملاتی را انتخاب کنید.",
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
  const [track, setTrack] = useState<"forex" | "predict">("forex");

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
        className={`rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.01] hover:border-gold hover:shadow-[0_0_24px_rgba(232,196,106,0.15)] ${
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

            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">روزهای فعال (حداقل {state.minDays})</span>
                <span className="font-mono text-cream" dir="ltr">
                  {state.activeDays}
                </span>
              </div>
              <Bar value={state.activeDays} max={state.minDays} tone="gold" />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">
                  ثبات — سهم بهترین روز (حد {state.consistencyPct}٪)
                </span>
                <span
                  className={`font-mono ${
                    state.consistencyOk ? "text-gain" : "text-loss"
                  }`}
                  dir="ltr"
                >
                  {state.bestDayPct}%
                </span>
              </div>
              <Bar
                value={state.bestDayPct}
                max={state.consistencyPct}
                tone={state.consistencyOk ? "gold" : "loss"}
              />
              {!state.consistencyOk && state.points > 0 && (
                <p className="mt-1.5 text-[10px] leading-5 text-muted">
                  سود شما بیش از حد روی یک روز متمرکز است. برای قبولی، سود باید
                  در چند روز پخش شود.
                </p>
              )}
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

      {/* تب دو مسیر پراپ */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "forex" as const, title: "حساب معاملاتی واقعی", sub: "فارکس نزد بروکر همکار" },
            { id: "predict" as const, title: "حساب پیش‌بینی", sub: "پرداخت کریپتویی سقف‌دار" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTrack(t.id)}
            className={`no-zoom flex flex-col items-start rounded-xl border px-4 py-2.5 text-start transition ${
              track === t.id
                ? "border-gold/60 bg-gold/10 text-gold shadow-[0_0_18px_rgba(232,196,106,0.15)]"
                : "border-line text-muted hover:border-gold/30 hover:text-cream"
            }`}
          >
            <span className="text-xs font-bold">{t.title}</span>
            <span className="mt-0.5 text-[10px] opacity-80">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers
          .filter((t) => t.track === track)
          .map((t) => (
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
            <span className="mt-1 text-[10px] text-muted">
              {t.track === "forex" ? "حساب معاملاتی واقعی" : "حساب پیش‌بینی"}
            </span>

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
              <li>— حداقل {t.minPreds} پیش‌بینی در {t.minDays} روز مختلف</li>
              <li>— قانون ثبات: هیچ روزی بیش از ۳۵٪ سود نباشد</li>
              <li>— مهلت {t.days} روزه</li>
              <li className="text-cream">🏆 {t.prize}</li>
              {t.payoutNote && (
                <li className="text-[10px] text-gold/80">{t.payoutNote}</li>
              )}
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

      {/* شفافیت پیش از پرداخت — مهم‌ترین دفاع برند.
          کاربری که پراپ‌فرم‌های جهانی را دیده انتظار «ترید با سرمایه‌ی ما روی
          پالی‌مارکت» دارد. اگر این انتظار را اصلاح نکنیم و بعد از پرداخت
          چیز دیگری ببیند، حس فریب‌خوردن می‌کند. پس قبل از پرداخت می‌گوییم. */}
      <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <h4 className="font-display text-sm font-extrabold text-gold">
          پیش از پرداخت، دقیقاً بدانید چه می‌گیرید
        </h4>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-[11px] font-bold text-cream">
              مسیر حساب معاملاتی
            </span>
            <p className="mt-1.5 text-[11px] leading-6 text-muted">
              پس از قبولی و بررسی انسانی، یک حساب معاملاتی واقعی نزد بروکر همکار
              دریافت می‌کنید و سود آن قابل برداشت است. شرایط معاملاتی، اسپرد و
              روش برداشت تابع قوانین همان بروکر است. توجه: مهارت پیش‌بینی رویداد
              با مهارت معامله‌گری فارکس یکی نیست؛ مدیریت ریسک این حساب با شماست.
            </p>
          </div>

          <div>
            <span className="text-[11px] font-bold text-cream">
              مسیر حساب پیش‌بینی
            </span>
            <p className="mt-1.5 text-[11px] leading-6 text-muted">
              این حساب سرمایه‌ی واقعی در اختیار شما نمی‌گذارد و سفارشی در بازار
              بیرونی اجرا نمی‌کند. مبنای آن قیمت‌های واقعی است و پرداخت‌ها واقعی
              و قابل برداشت‌اند، اما دوره‌ای، پس از بررسی انسانی، و تا سقف
              اعلام‌شده‌ی همان تیر. سود بیش از سقف قابل برداشت نیست.
            </p>
          </div>
        </div>

        <p className="mt-3 border-t border-gold/20 pt-3 text-[10px] leading-6 text-muted">
          نارمون یک آزمون مهارت است، نه شرط‌بندی. امتیاز نقد نمی‌شود و با کردیت
          خریدنی نیست. سامانه‌ی امتیازدهی طوری کالیبره شده که حدس تصادفی
          به‌طور میانگین امتیاز منفی بگیرد. ورودی چلنج پس از شروع بازگشت‌پذیر
          نیست.
        </p>
      </div>

      <p className="mt-4 text-[10px] leading-5 text-muted">
        فقط ۵۰ پیش‌بینیِ اولِ ثبت‌شده در بازه‌ی احتمال ۲۵٪ تا ۷۵٪ در ارزیابی چلنج
        محاسبه می‌شوند. شرط‌بندی روی گزینه‌های خیلی بعید یا خیلی محتمل مهارت را
        نشان نمی‌دهد و در نتیجه‌ی چلنج اثری ندارد. ورود به چلنج حساب پیش‌بینی
        حداکثر ۳ بار در ۳۰ روز ممکن است.
      </p>

      {!player && (
        <p className="mt-4 text-[11px] text-muted">
          برای شروع چلنج، از بالای صفحه وارد حساب شوید یا ثبت‌نام کنید.
        </p>
      )}
      {err && <p className="mt-3 text-xs text-loss">{err}</p>}
    </div>
  );
}
