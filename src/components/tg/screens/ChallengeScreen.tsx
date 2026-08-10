"use client";

import { useCallback, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { useResource } from "@/components/tg/useResource";
import { Card, ErrorState, ScreenTitle, Skeleton, Stat } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";

// چلنج پراپ در مینی‌اپ — همان /api/predict/challenge سایت.
//
// دو حالت: اگر چلنج فعالی هست، کارنامه‌اش را نشان می‌دهد (امتیاز، برد و باخت،
// دراودان، سود و زیان روزانه). اگر نیست، تیرها را برای خرید نشان می‌دهد.

type Tier = {
  id: string;
  track: string;
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
  daysLeft: number;
  prize: string;
  wins: number;
  losses: number;
  winRate: number | null;
  bestDay: number;
  dailyPnl: { day: string; points: number }[];
};

type Data = { authed: boolean; tiers: Tier[]; state: State | null };

const ERR: Record<string, string> = {
  not_authed: "ابتدا وارد شو.",
  telegram_required: "برای ورود به چلنج باید حسابت به تلگرام وصل باشد.",
  active_exists: "همین حالا یک چلنج فعال داری.",
  entry_limit: "سقف ورود در ۳۰ روز گذشته پر شده است.",
  insufficient_credits: "MOON کافی نداری.",
  bad_tier: "این تیر معتبر نیست.",
};

const FAIL: Record<string, string> = {
  drawdown: "عبور از سقف افت سرمایه",
  daily: "عبور از سقف زیان روزانه",
  expired: "پایان مهلت بدون رسیدن به هدف",
  consistency: "تمرکز بیش از حد سود در یک روز",
};

export default function ChallengeScreen() {
  const res = useResource<Data>("/api/predict/challenge");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const start = useCallback(
    async (tierId: string) => {
      setBusy(tierId);
      setMsg(null);
      try {
        await api("/api/predict/challenge", {
          method: "POST",
          body: JSON.stringify({ tierId }),
        });
        haptic.success();
        res.reload();
      } catch (e) {
        haptic.error();
        const code = e instanceof ApiError ? e.code : "";
        setMsg(ERR[code] ?? "ورود به چلنج انجام نشد.");
      } finally {
        setBusy(null);
      }
    },
    [res]
  );

  if (res.error) return <ErrorState message="چلنج نیامد." onRetry={res.reload} />;
  if (!res.data)
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );

  const s = res.data.state;

  if (s) {
    const passed = s.status === "passed";
    const failed = s.status === "failed";
    const pct = Math.max(0, Math.min(100, (s.points / s.target) * 100));
    const counted = s.wins + s.losses;

    return (
      <div>
        <ScreenTitle title="چلنج پراپ" subtitle={s.label} />

        {failed && (
          <div className="mb-3 rounded-2xl border border-loss/40 bg-loss/5 p-4">
            <p className="text-[12px] font-bold text-loss">چلنج ناموفق شد</p>
            {s.failReason && (
              <p className="mt-1 text-[11px] text-muted">
                دلیل: {FAIL[s.failReason] ?? s.failReason}
              </p>
            )}
          </div>
        )}
        {passed && (
          <div className="mb-3 rounded-2xl border border-gain/40 bg-gain/5 p-4">
            <p className="text-[12px] font-bold text-gain">
              چلنج با موفقیت تمام شد — {s.prize}
            </p>
          </div>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Stat
              label="امتیاز"
              value={String(s.points)}
              tone={s.points >= 0 ? "gain" : "loss"}
            />
            <Stat label="هدف" value={String(s.target)} tone="gold" />
            <Stat label="برد" value={String(s.wins)} tone="gain" />
            <Stat label="باخت" value={String(s.losses)} tone="loss" />
            <Stat
              label="نرخ برد"
              value={s.winRate === null ? "—" : `${s.winRate}٪`}
            />
            {!passed && !failed && (
              <Stat label="روز مانده" value={String(s.daysLeft)} tone="gold" />
            )}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/60">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </Card>

        {counted === 0 && !failed && (
          <div className="mt-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
            <p className="text-[12px] font-bold text-gold">
              هنوز پیش‌بینی شمرده‌شده‌ای نداری
            </p>
            <ul className="mt-2 space-y-1 text-[11px] leading-6 text-muted">
              <li>
                فقط پیش‌بینی‌های <b className="text-cream">ترید</b> شمرده می‌شوند،
                آن هم بعد از شروع چلنج.
              </li>
              <li>پیش‌بینی باید تسویه شده باشد.</li>
              <li>
                فقط بازارهایی با احتمال{" "}
                <b className="text-cream">۲۵٪ تا ۷۵٪</b>.
              </li>
            </ul>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Card>
            <p className="text-[10px] text-muted">افت سرمایه</p>
            <p className="mt-1 font-mono text-[13px] text-cream" dir="ltr">
              {s.drawdown} / {s.maxDrawdown}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] text-muted">بدترین روز</p>
            <p className="mt-1 font-mono text-[13px] text-cream" dir="ltr">
              {s.worstDay} / -{s.dailyLoss}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] text-muted">پیش‌بینی شمرده‌شده</p>
            <p className="mt-1 font-mono text-[13px] text-cream" dir="ltr">
              {s.settledCount} / {s.minPreds}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] text-muted">روز فعال</p>
            <p className="mt-1 font-mono text-[13px] text-cream" dir="ltr">
              {s.activeDays} / {s.minDays}
            </p>
          </Card>
        </div>

        {s.dailyPnl.length > 0 && (
          <Card className="mt-3">
            <p className="text-[11px] font-bold text-cream">سود و زیان روزانه</p>
            <div className="mt-2 space-y-1">
              {s.dailyPnl.map((d) => (
                <div
                  key={d.day}
                  className="flex items-center justify-between font-mono text-[10px]"
                  dir="ltr"
                >
                  <span className="text-muted">{d.day}</span>
                  <span className={d.points >= 0 ? "text-gain" : "text-loss"}>
                    {d.points > 0 ? "+" : ""}
                    {d.points}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle
        title="چلنج پراپ"
        subtitle="ورودی با MOON، جایزه حساب واقعی — امتیاز خریدنی نیست"
      />

      {msg && (
        <p className="mb-3 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11px] text-loss">
          {msg}
        </p>
      )}

      <div className="space-y-2">
        {res.data.tiers.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-cream">{t.label}</p>
                <p className="mt-0.5 text-[10px] text-muted">{t.prize}</p>
              </div>
              <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold text-gold">
                {t.fee} MOON
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-muted" dir="ltr">
              <span>هدف: {t.target}</span>
              <span>افت مجاز: {t.maxDrawdown}</span>
              <span>زیان روزانه: {t.dailyLoss}</span>
              <span>مهلت: {t.days} روز</span>
            </div>

            <button
              type="button"
              onClick={() => start(t.id)}
              disabled={busy !== null}
              className="mt-3 w-full rounded-xl bg-gold py-2.5 text-[12px] font-bold text-ink disabled:opacity-40"
            >
              {busy === t.id ? "در حال ثبت…" : "ورود به این چلنج"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
