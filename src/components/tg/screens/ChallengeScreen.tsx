"use client";

import { useCallback, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { useResource } from "@/components/tg/useResource";
import { Card, ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";

// چالش پراپ در مینی‌اپ — همان /api/predict/challenge سایت.
//
// طراحی برای صفحه‌ی باریک تلگرام: یک حلقه‌ی پیشرفت که در یک نگاه می‌گوید چقدر
// تا هدف مانده، بعد سنجه‌ها، بعد چک‌لیست شرط‌ها، بعد نمودار میله‌ای روزانه.
// جدول‌های چندستونی سایت اینجا کار نمی‌کنند و به اسکرول افقی می‌افتند.

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
  tierKnown?: boolean;
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
  telegram_blocked:
    "ربات نارمون را در تلگرام بلاک کرده‌اید. اعلان‌های امنیتی حساب از همان ربات می‌آید، پس تا آنبلاک نکنید این عملیات انجام نمی‌شود. برداشت وجه بسته نیست.",
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کن و دوباره تلاش کن.",
  not_authed: "ابتدا وارد شوید.",
  telegram_required: "برای ورود به چالش باید حسابت به تلگرام وصل باشد.",
  active_exists: "همین حالا یک چالش فعال داری.",
  entry_limit: "سقف ورود در ۳۰ روز گذشته پر شده است.",
  insufficient_credits: "MOON کافی نداری. از کیف پول MOON بخرید.",
  bad_tier: "این تیر معتبر نیست.",
};

const FAIL: Record<string, string> = {
  drawdown: "عبور از سقف افت سرمایه",
  daily_loss: "عبور از سقف زیان روزانه",
  expired: "پایان مهلت بدون رسیدن به هدف",
  consistency: "تمرکز بیش از حد سود در یک روز",
};

/** حلقه‌ی پیشرفت — در یک نگاه می‌گوید چقدر تا هدف مانده. */
function Ring({
  pct,
  points,
  target,
  tone,
}: {
  pct: number;
  points: number;
  target: number | null;
  tone: "gold" | "gain" | "loss";
}) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const color =
    tone === "gain" ? "#3ecf8e" : tone === "loss" ? "#e5484d" : "#e8c46a";
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#26262e" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0, Math.min(1, pct)))}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[19px] font-bold" style={{ color }} dir="ltr">
          {points}
        </span>
        <span className="mt-0.5 text-[9px] text-muted" dir="ltr">
          {target === null ? "هدف نامعلوم" : `از ${target}`}
        </span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss" | "gold";
}) {
  const color =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : tone === "gold"
          ? "text-gold"
          : "text-cream";
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-3 py-2.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`mt-1 font-mono text-[15px] font-bold ${color}`} dir="ltr">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 font-mono text-[9px] text-muted" dir="ltr">
          {sub}
        </p>
      )}
    </div>
  );
}

/** یک شرط قبولی با نوار پیشرفت. */
function Cond({
  label,
  value,
  ok,
  progress,
  isLimit,
  pending,
}: {
  label: string;
  value: string;
  ok: boolean;
  progress: number;
  isLimit?: boolean;
  /** هنوز قابل ارزیابی نیست — نه برقرار، نه نقض‌شده */
  pending?: boolean;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-cream">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted" dir="ltr">
            {value}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] ${
              ok
                ? "bg-gain/15 text-gain"
                : !pending && isLimit
                  ? "bg-loss/15 text-loss"
                  : "bg-line/40 text-muted"
            }`}
          >
            {ok ? "✓" : pending ? "…" : isLimit ? "!" : "…"}
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pending
              ? "bg-line"
              : isLimit
                ? ok
                  ? "bg-gold/60"
                  : "bg-loss"
                : ok
                  ? "bg-gain"
                  : "bg-gold/60"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </div>
  );
}

/** نمودار میله‌ای سود و زیان روزانه. */
function DailyBars({ rows }: { rows: { day: string; points: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.points)));
  return (
    <div className="flex items-end justify-between gap-1" style={{ height: 84 }}>
      {rows.map((r) => {
        const h = Math.max(3, (Math.abs(r.points) / max) * 34);
        const up = r.points >= 0;
        return (
          <div key={r.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-[38px] w-full items-end justify-center">
              {up && (
                <div
                  className="w-full max-w-[18px] rounded-t bg-gain/70"
                  style={{ height: h }}
                />
              )}
            </div>
            <div className="h-px w-full bg-line" />
            <div className="flex h-[38px] w-full items-start justify-center">
              {!up && (
                <div
                  className="w-full max-w-[18px] rounded-b bg-loss/70"
                  style={{ height: h }}
                />
              )}
            </div>
            <span className="font-mono text-[8px] text-muted" dir="ltr">
              {r.day.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ChallengeScreen() {
  const res = useResource<Data>("/api/predict/challenge");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [track, setTrack] = useState<"predict" | "forex">("predict");

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
        setMsg(ERR[code] ?? "ورود به چالش انجام نشد.");
      } finally {
        setBusy(null);
      }
    },
    [res]
  );

  if (res.error) return <ErrorState message="چالش نیامد." onRetry={res.reload} />;
  if (!res.data)
    return (
      <div className="space-y-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );

  const s = res.data.state;

  if (s) {
    const passed = s.status === "passed";
    const failed = s.status === "failed";
    const unknown = s.tierKnown === false;
    const counted = s.wins + s.losses;

    const conds = unknown
      ? []
      : [
          {
            label: "هدف امتیاز",
            value: `${s.points} / ${s.target}`,
            ok: s.points >= s.target,
            progress: s.target > 0 ? Math.max(0, s.points) / s.target : 0,
          },
          {
            label: "افت از سقف",
            value: `${s.drawdown} / ${s.maxDrawdown}`,
            ok: s.drawdown <= s.maxDrawdown,
            progress: s.maxDrawdown > 0 ? s.drawdown / s.maxDrawdown : 0,
            isLimit: true,
          },
          {
            label: "سقف ضرر روزانه",
            value: `${s.worstDay} / −${s.dailyLoss}`,
            ok: s.worstDay >= -s.dailyLoss,
            progress: s.dailyLoss > 0 ? Math.abs(s.worstDay) / s.dailyLoss : 0,
            isLimit: true,
          },
          {
            label: "حداقل پیش‌بینی",
            value: `${s.settledCount} / ${s.minPreds}`,
            ok: s.settledCount >= s.minPreds,
            progress: s.minPreds > 0 ? s.settledCount / s.minPreds : 0,
          },
          {
            label: "حداقل روز فعال",
            value: `${s.activeDays} / ${s.minDays}`,
            ok: s.activeDays >= s.minDays,
            progress: s.minDays > 0 ? s.activeDays / s.minDays : 0,
          },
          {
            label: "قانون ثبات",
            value: `${s.bestDayPct}٪ / ${s.consistencyPct}٪`,
            ok: s.consistencyOk,
            progress: s.consistencyPct > 0 ? s.bestDayPct / s.consistencyPct : 0,
            isLimit: true,
            // بدون سود، «سهم بهترین روز از کل سود» تعریف ندارد.
            pending: s.points <= 0,
          },
        ];
    const okCount = conds.filter((c) => c.ok).length;

    return (
      <div className="space-y-3">
        <ScreenTitle title="کارنامه‌ی چالش پراپ" subtitle={s.label} />

        {failed && (
          <div className="rounded-2xl border border-loss/40 bg-loss/5 p-4">
            <p className="text-[12px] font-bold text-loss">چالش ناموفق شد</p>
            {s.failReason && (
              <p className="mt-1 text-[11px] text-muted">
                دلیل: {FAIL[s.failReason] ?? s.failReason}
              </p>
            )}
          </div>
        )}
        {passed && (
          <div className="rounded-2xl border border-gain/40 bg-gain/5 p-4">
            <p className="text-[12px] font-bold text-gain">چالش با موفقیت تمام شد 🎉</p>
            <p className="mt-1 text-[11px] text-muted">جایزه: {s.prize}</p>
          </div>
        )}

        {/* حلقه‌ی پیشرفت + سنجه‌های کلیدی */}
        <Card>
          <div className="flex items-center gap-4">
            <Ring
              pct={unknown || s.target <= 0 ? 0 : Math.max(0, s.points) / s.target}
              points={s.points}
              target={unknown ? null : s.target}
              tone={failed ? "loss" : passed ? "gain" : "gold"}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted">صحیح / خطا</span>
                <span className="font-mono text-[13px]" dir="ltr">
                  <b className="text-gain">{s.wins}</b>
                  <span className="text-muted"> / </span>
                  <b className="text-loss">{s.losses}</b>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted">درصد موفقیت</span>
                <span className="font-mono text-[13px] text-cream" dir="ltr">
                  {s.winRate === null ? "—" : `${s.winRate}٪`}
                </span>
              </div>
              {!passed && !failed && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted">روز باقی‌مانده</span>
                  <span className="font-mono text-[13px] text-gold" dir="ltr">
                    {s.daysLeft}
                  </span>
                </div>
              )}
              {conds.length > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted">شرط‌های برقرار</span>
                  <span className="font-mono text-[13px] text-cream" dir="ltr">
                    {okCount}/{conds.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {unknown && (
          <div className="rounded-2xl border border-loss/40 bg-loss/5 p-4">
            <p className="text-[12px] font-bold text-loss">
              تیر قدیمی «{s.tierId}»
            </p>
            <p className="mt-1 text-[11px] leading-6 text-muted">
              این تیر دیگر در فهرست نیست، پس آستانه‌های هدف و افت نامعلوم‌اند و
              وضعیت خودکار به‌روز نمی‌شود. کارنامه‌ی پیش‌بینی‌ها درست است. برای
              تعیین تکلیف با پشتیبانی تماس بگیر.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="افت سرمایه"
            value={String(s.drawdown)}
            sub={unknown ? "سقف نامعلوم" : `سقف ${s.maxDrawdown}`}
            tone={!unknown && s.drawdown > s.maxDrawdown ? "loss" : undefined}
          />
          <Metric
            label="بدترین روز"
            value={String(s.worstDay)}
            sub={unknown ? "سقف نامعلوم" : `سقف −${s.dailyLoss}`}
            tone={s.worstDay < 0 ? "loss" : undefined}
          />
          <Metric
            label="پیش‌بینی شمرده‌شده"
            value={String(s.settledCount)}
            sub={unknown ? "حداقل نامعلوم" : `حداقل ${s.minPreds}`}
          />
          <Metric
            label="روز فعال"
            value={String(s.activeDays)}
            sub={unknown ? "حداقل نامعلوم" : `حداقل ${s.minDays}`}
          />
        </div>

        {counted === 0 && !failed && (
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
            <p className="text-[12px] font-bold text-gold">
              هنوز پیش‌بینی شمرده‌شده‌ای نداری
            </p>
            <ul className="mt-2 space-y-1 text-[11px] leading-6 text-muted">
              <li>
                فقط پیش‌بینی‌های <b className="text-cream">ترید</b> شمرده می‌شوند،
                آن هم بعد از شروع چالش.
              </li>
              <li>پیش‌بینی باید تسویه شده باشد.</li>
              <li>
                فقط بازارهایی با احتمال <b className="text-cream">۲۵٪ تا ۷۵٪</b>.
              </li>
            </ul>
          </div>
        )}

        {conds.length > 0 && (
          <Card>
            <p className="text-[11px] font-bold text-cream">شرایط قبولی</p>
            <div className="mt-1 divide-y divide-line/60">
              {conds.map((c) => (
                <Cond key={c.label} {...c} />
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-5 text-muted">
              «افت از سقف»، «سقف ضرر روزانه» و «ثبات» سقف‌اند؛ نباید از حد بگذرید.
              بقیه هدف‌اند.
            </p>
          </Card>
        )}

        {s.dailyPnl.length > 0 && (
          <Card>
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold text-cream">سود و زیان روزانه</p>
              <span className="font-mono text-[9px] text-muted" dir="ltr">
                best {s.bestDay} · worst {s.worstDay}
              </span>
            </div>
            <div className="mt-3">
              <DailyBars rows={s.dailyPnl} />
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── هنوز چالشی ندارد ──
  const tiers = res.data.tiers.filter((t) => t.track === track);

  return (
    <div>
      <ScreenTitle
        title="چالش پراپ"
        subtitle="ورودی با MOON، جایزه حساب واقعی؛ امتیاز خریدنی نیست"
      />

      {!res.data.authed && (
        <div className="mb-3 rounded-2xl border border-gold/40 bg-gold/5 p-4 text-[11px] leading-6">
          <b className="text-gold">وارد نشده‌ای.</b>
          <span className="text-muted">
            {" "}
            کارنامه به حساب گره خورده است؛ اگر قبلا چالش خریده‌ای اول وارد شوید.
          </span>
        </div>
      )}

      {msg && (
        <p className="mb-3 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11px] text-loss">
          {msg}
        </p>
      )}

      <div className="mb-3 flex gap-2">
        {(
          [
            { id: "predict" as const, label: "حساب پیش‌بینی" },
            { id: "forex" as const, label: "حساب معاملاتی" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              haptic.tap();
              setTrack(t.id);
            }}
            className={`flex-1 rounded-xl border px-3 py-2 text-[11px] transition ${
              track === t.id
                ? "border-gold/60 bg-gold/10 font-bold text-gold"
                : "border-line text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tiers.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-cream">{t.label}</p>
                <p className="mt-0.5 text-[10px] leading-5 text-muted">{t.prize}</p>
              </div>
              <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold text-gold">
                {t.fee} MOON
              </span>
            </div>

            <div
              className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-muted"
              dir="ltr"
            >
              <span>هدف {t.target}</span>
              <span>افت مجاز {t.maxDrawdown}</span>
              <span>زیان روزانه {t.dailyLoss}</span>
              <span>{t.days} روز</span>
            </div>

            <button
              type="button"
              onClick={() => start(t.id)}
              disabled={busy !== null}
              className="mt-3 w-full rounded-xl bg-gold py-2.5 text-[12px] font-bold text-ink disabled:opacity-40"
            >
              {busy === t.id ? "در حال ثبت…" : "ورود به این چالش"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
