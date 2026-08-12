"use client";

/**
 * پنل اختصاصی چلنج فعال.
 *
 * تفاوتش با کارت‌های انتخاب چلنج: اینجا وضعیت زنده‌ی خودِ کاربر است — کارنامه‌ی
 * برد و باخت، افت از سقف، و یک جدول که برای هر شرط قبولی می‌گوید «رد شدی یا
 * نه و چقدر مانده». هدف این است که کاربر بدون خواندن قوانین بفهمد کجا ایستاده.
 */

export type ChallengeStateView = {
  id: number;
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
  track: string;
  payoutNote: string | null;
  daysLeft: number;
  prize: string;
  wins: number;
  losses: number;
  winRate: number | null;
  bestDay: number;
  dailyPnl: { day: string; points: number }[];
  peak: number;
};

const FAIL_LABEL: Record<string, string> = {
  drawdown: "افت از سقف بیش از حد مجاز",
  daily_loss: "ضرر یک روز بیش از سقف روزانه",
  expired: "مهلت چلنج تمام شد",
};

const faDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
  });

type Rule = {
  label: string;
  hint: string;
  value: string;
  ok: boolean;
  /** ۰ تا ۱ — برای نوار پیشرفت */
  progress: number;
  /** شرط «نباید از حد بگذرد» است، نه «باید به حد برسد» */
  isLimit?: boolean;
};

export default function ChallengeDashboard({ s }: { s: ChallengeStateView }) {
  const rules: Rule[] = [
    {
      label: "هدف امتیاز",
      hint: `باید به ${s.target} امتیاز برسی`,
      value: `${s.points} از ${s.target}`,
      ok: s.points >= s.target,
      progress: s.target > 0 ? Math.max(0, s.points) / s.target : 0,
    },
    {
      label: "افت از سقف",
      hint: `از بالاترین امتیازت بیشتر از ${s.maxDrawdown} نیفت`,
      value: `${s.drawdown} از ${s.maxDrawdown}`,
      ok: s.drawdown <= s.maxDrawdown,
      progress: s.maxDrawdown > 0 ? s.drawdown / s.maxDrawdown : 0,
      isLimit: true,
    },
    {
      label: "سقف ضرر روزانه",
      hint: `هیچ روزی بیشتر از ${s.dailyLoss} امتیاز از دست نده`,
      value: `${s.worstDay} از −${s.dailyLoss}`,
      ok: s.worstDay >= -s.dailyLoss,
      progress: s.dailyLoss > 0 ? Math.abs(s.worstDay) / s.dailyLoss : 0,
      isLimit: true,
    },
    {
      label: "حداقل پیش‌بینی",
      hint: `دست‌کم ${s.minPreds} پیش‌بینی تسویه‌شده در بازه‌ی احتمال مجاز`,
      value: `${s.settledCount} از ${s.minPreds}`,
      ok: s.settledCount >= s.minPreds,
      progress: s.minPreds > 0 ? s.settledCount / s.minPreds : 0,
    },
    {
      label: "حداقل روز فعال",
      hint: `دست‌کم ${s.minDays} روز مختلف پیش‌بینی تسویه‌شده داشته باشی`,
      value: `${s.activeDays} از ${s.minDays}`,
      ok: s.activeDays >= s.minDays,
      progress: s.minDays > 0 ? s.activeDays / s.minDays : 0,
    },
    {
      label: "قانون ثبات",
      hint: `سهم بهترین روزت از کل سود نباید از ${s.consistencyPct}٪ بیشتر باشد`,
      value: `${s.bestDayPct}٪ از ${s.consistencyPct}٪`,
      ok: s.consistencyOk,
      progress: s.consistencyPct > 0 ? s.bestDayPct / s.consistencyPct : 0,
      isLimit: true,
    },
  ];

  const passedCount = rules.filter((r) => r.ok).length;
  const failed = s.status === "failed";
  const passed = s.status === "passed";

  return (
    <div className="flex flex-col gap-5">
      {/* نوار وضعیت */}
      <div
        className={`no-lift rounded-2xl border p-5 md:p-6 ${
          passed
            ? "border-gain/50 bg-gain/5"
            : failed
              ? "border-loss/50 bg-loss/5"
              : "border-gold/40 bg-gold/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-wider text-muted" dir="ltr">
              CHALLENGE {s.label}
            </div>
            <h2 className="mt-1 font-display text-xl font-black">
              {passed
                ? "🎉 چلنج پاس شد"
                : failed
                  ? "چلنج ناموفق"
                  : "چلنج فعال شما"}
            </h2>
            {failed && s.failReason && (
              <p className="mt-1 text-[11px] text-loss">
                دلیل: {FAIL_LABEL[s.failReason] ?? s.failReason}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Stat
              label="امتیاز"
              value={String(s.points)}
              tone={s.points >= 0 ? "gain" : "loss"}
            />
            <Stat label="برد" value={String(s.wins)} tone="gain" />
            <Stat label="باخت" value={String(s.losses)} tone="loss" />
            <Stat
              label="نرخ برد"
              value={s.winRate === null ? "—" : `${s.winRate}٪`}
            />
            {!passed && !failed && (
              <Stat label="روز باقی‌مانده" value={String(s.daysLeft)} tone="gold" />
            )}
          </div>

          {s.tierKnown === false && (
            <div className="mt-4 rounded-xl border border-loss/40 bg-loss/5 p-4">
              <p className="text-[12px] font-bold text-loss">
                این چلنج با تیر قدیمی «{s.tierId}» ثبت شده
              </p>
              <p className="mt-1 text-[11px] leading-6 text-muted">
                آن تیر دیگر در فهرست نیست، پس آستانه‌های هدف و افت سرمایه نامعلوم‌اند
                و وضعیت خودکار به‌روز نمی‌شود. کارنامه‌ی پیش‌بینی‌ها درست است. برای
                تعیین تکلیف با پشتیبانی تماس بگیر.
              </p>
            </div>
          )}

          {/* بدون این، چلنجِ تازه‌خریداری‌شده فقط یک مشت صفر نشان می‌داد و
              کاربر فکر می‌کرد پنل کار نمی‌کند — در حالی که هنوز هیچ
              پیش‌بینیِ واجد شرایطی تسویه نشده بود. */}
          {s.wins + s.losses === 0 && !failed && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
              <p className="text-[12px] font-bold text-gold">
                هنوز پیش‌بینی شمرده‌شده‌ای نداری
              </p>
              <ul className="mt-2 space-y-1 text-[11px] leading-6 text-muted">
                <li>
                  فقط پیش‌بینی‌های <b className="text-cream">ترید</b> در ارزیابی
                  می‌آیند، آن هم پیش‌بینی‌هایی که{" "}
                  <b className="text-cream">بعد از شروع چلنج</b> ثبت شده باشند.
                </li>
                <li>
                  پیش‌بینی باید <b className="text-cream">تسویه شده</b> باشد؛ تا
                  وقتی بازارش باز است در کارنامه نمی‌نشیند.
                </li>
                <li>
                  فقط بازارهایی با احتمال بین{" "}
                  <b className="text-cream">۲۵٪ تا ۷۵٪</b> شمرده می‌شوند —
                  گزینه‌ی خیلی بعید قمار است و خیلی محتمل مهارتی نشان نمی‌دهد.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* شمارنده‌ی شرط‌ها */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/40">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                passedCount === rules.length ? "bg-gain" : "bg-gold"
              }`}
              style={{ width: `${(passedCount / rules.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] text-muted" dir="ltr">
            {passedCount}/{rules.length}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-muted">
          {passedCount} شرط از {rules.length} شرط قبولی برقرار است.
        </p>
      </div>

      {/* جدول شرط‌ها */}
      <div className="no-lift rounded-2xl border border-line bg-surface/40 p-5 md:p-6">
        <h3 className="font-display text-base font-black">شرایط قبولی</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-2 py-2 text-start font-normal">شرط</th>
                <th className="px-2 py-2 text-start font-normal">وضعیت فعلی</th>
                <th className="w-[34%] px-2 py-2 text-start font-normal">پیشرفت</th>
                <th className="px-2 py-2 text-center font-normal">نتیجه</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-surface/30" : ""}>
                  <td className="px-2 py-3 align-top">
                    <div className="font-bold text-cream">{r.label}</div>
                    <div className="mt-0.5 text-[10px] leading-5 text-muted">
                      {r.hint}
                    </div>
                  </td>
                  <td
                    className="whitespace-nowrap px-2 py-3 align-top font-mono"
                    dir="ltr"
                  >
                    {r.value}
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/40">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          r.isLimit
                            ? r.ok
                              ? "bg-gold/70"
                              : "bg-loss"
                            : r.ok
                              ? "bg-gain"
                              : "bg-gold/70"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, r.progress * 100))}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center align-top">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${
                        r.ok
                          ? "border-gain/40 text-gain"
                          : "border-line text-muted"
                      }`}
                    >
                      {r.ok ? "برقرار" : r.isLimit ? "در حد مجاز نیست" : "هنوز نه"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] leading-6 text-muted">
          شرط‌های «افت از سقف»، «سقف ضرر روزانه» و «ثبات» سقف‌اند — یعنی نباید از
          حد بگذری. بقیه هدف‌اند و باید به آن‌ها برسی.
        </p>
      </div>

      {/* کارنامه‌ی روزانه */}
      {s.dailyPnl.length > 0 && (
        <div className="no-lift rounded-2xl border border-line bg-surface/40 p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-black">کارنامه‌ی روزانه</h3>
            <span className="font-mono text-[11px] text-muted" dir="ltr">
              peak {s.peak} · best day {s.bestDay} · worst day {s.worstDay}
            </span>
          </div>

          <DailyChart data={s.dailyPnl} />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-2 text-start font-normal">روز</th>
                  <th className="px-2 py-2 text-end font-normal">امتیاز روز</th>
                  <th className="px-2 py-2 text-end font-normal">امتیاز تجمعی</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let run = 0;
                  return s.dailyPnl.map((d, i) => {
                    run += d.points;
                    return (
                      <tr key={d.day} className={i % 2 ? "bg-surface/30" : ""}>
                        <td className="px-2 py-2">{faDay(d.day)}</td>
                        <td
                          className={`px-2 py-2 text-end font-mono font-bold ${
                            d.points >= 0 ? "text-gain" : "text-loss"
                          }`}
                          dir="ltr"
                        >
                          {d.points >= 0 ? "+" : ""}
                          {d.points}
                        </td>
                        <td className="px-2 py-2 text-end font-mono text-muted" dir="ltr">
                          {run}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss" | "gold";
}) {
  const c =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : tone === "gold"
          ? "text-gold"
          : "text-cream";
  return (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-base font-bold ${c}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

/** نمودار میله‌ای سود/زیان روزانه + خط امتیاز تجمعی. */
function DailyChart({ data }: { data: { day: string; points: number }[] }) {
  const W = 640;
  const H = 130;
  const mid = H / 2;
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.points)));
  const bw = Math.min(38, (W / data.length) * 0.6);

  // خط تجمعی
  let run = 0;
  const cum = data.map((d) => (run += d.points));
  const cMin = Math.min(0, ...cum);
  const cMax = Math.max(1, ...cum);
  const cSpan = cMax - cMin || 1;
  const cPts = cum.map((v, i) => {
    const x = ((i + 0.5) / data.length) * W;
    const y = 8 + (1 - (v - cMin) / cSpan) * (H - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[130px] w-full" preserveAspectRatio="none">
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="rgba(255,255,255,0.10)" />
        {data.map((d, i) => {
          const x = ((i + 0.5) / data.length) * W - bw / 2;
          const h = (Math.abs(d.points) / maxAbs) * (mid - 10);
          const up = d.points >= 0;
          return (
            <rect
              key={d.day}
              x={x}
              y={up ? mid - h : mid}
              width={bw}
              height={Math.max(1, h)}
              rx="2"
              fill={up ? "rgba(62,207,142,0.55)" : "rgba(229,72,77,0.55)"}
            />
          );
        })}
        {cPts.length > 1 && (
          <path
            d={`M ${cPts[0]} L ${cPts.slice(1).join(" L ")}`}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.6"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
        <span>{faDay(data[0].day)}</span>
        <span className="text-gold">خط طلایی: امتیاز تجمعی</span>
        <span>{faDay(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}
