"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthCallout from "@/components/predict/AuthCallout";

type Profile = {
  player: {
    username: string;
    displayName: string;
    credits: number;
    totalPoints: number;
    streak: number;
    usdtBalance: number;
    createdAt: string;
    telegramLinked: boolean;
  };
  wallet: {
    balance: number;
    deposited: number;
    withdrawn: number;
    adjusted: number;
    lockedInMarkets: number;
    openBets: number;
  };
  iran: {
    settledBets: number;
    won: number;
    lost: number;
    refunded: number;
    staked: number;
    returned: number;
    net: number;
    winRate: number | null;
  };
  skill: {
    pulse: { total: number; settled: number; positive: number; points: number; avgError: number };
    arena: { total: number; settled: number; positive: number; points: number };
    accuracy: number | null;
    activeDays: number;
  };
  rank: { totalPlayers: number; above: number; percentile: number };
  ledger: {
    amount: number;
    kind: string;
    ref: string | null;
    balanceAfter: number;
    createdAt: string;
  }[];
};

const KIND_LABEL: Record<string, string> = {
  deposit: "واریز",
  withdraw_hold: "برداشت",
  withdraw_refund: "برگشت برداشت",
  admin_adjust: "تنظیم توسط پشتیبانی",
  ir_bet: "شرط بازار ایران",
  ir_payout: "برد بازار ایران",
  ir_refund: "برگشت بازار باطل",
  ir_propose_fee: "هزینه‌ی ساخت بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  credit_purchase: "خرید MOON",
};

const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

const fa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ProfilePanel() {
  const [d, setD] = useState<Profile | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">(
    "loading"
  );

  async function load() {
    try {
      const r = await fetch("/api/profile", { cache: "no-store" });
      if (r.status === 401) {
        setState("guest");
        return;
      }
      const j = await r.json();
      if (!j.ok) {
        setState("error");
        return;
      }
      setD(j);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === "loading") {
    return <p className="py-16 text-center text-xs text-muted">در حال بارگذاری…</p>;
  }
  if (state === "guest") {
    return (
      <AuthCallout
        onAuthed={() => load()}
        benefits={[
          "کارنامه‌ی کامل دقت پیش‌بینی‌هایت",
          "سود و زیان تتری بازار ایران، تفکیک‌شده",
          "کیف پول، تاریخچه‌ی تراکنش و نمودار رشد",
          "جایگاه رتبه و نشان‌های دستاورد",
        ]}
      />
    );
  }
  if (state === "error" || !d) {
    return <p className="py-16 text-center text-xs text-loss">خطا در دریافت اطلاعات.</p>;
  }

  const { player, wallet, iran, skill, rank, ledger } = d;

  // نمودار رشد موجودی از دفترکل — از قدیم به جدید
  const curve = [...ledger].reverse().map((l) => l.balanceAfter);
  const badges = buildBadges(d);

  return (
    <div className="flex flex-col gap-6">
      {/* ── هدر ── */}
      <div className="no-lift rounded-2xl border border-line bg-surface/50 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 font-display text-xl font-black text-gold">
              {player.displayName.trim().charAt(0) || "؟"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-black">
                {player.displayName}
              </h1>
              <p className="mt-0.5 font-mono text-[11px] text-muted" dir="ltr">
                @{player.username}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                عضو از {fa(player.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Metric label="امتیاز کل" value={String(player.totalPoints)} tone="gold" />
            <Metric label="MOON" value={`${player.credits} MOON`} />
            <Metric label="موجودی تتر" value={usd(player.usdtBalance)} tone="gain" />
            <Metric label="استریک" value={`${player.streak} روز`} />
          </div>
        </div>

        {/* جایگاه رتبه */}
        <div className="mt-5 rounded-xl border border-line bg-ink/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] text-muted">جایگاه شما میان همه‌ی کاربران</span>
            <span className="font-mono text-sm font-bold text-gold" dir="ltr">
              {rank.percentile}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/40">
            <div
              className="h-full rounded-full bg-gold transition-all duration-700"
              style={{ width: `${Math.max(2, rank.percentile)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted">
            {rank.percentile >= 100
              ? "در صدر جدول ایستاده‌ای."
              : `از ${100 - rank.percentile}٪ پیش‌بین‌ها جلوتری.`}
          </p>
        </div>
      </div>

      {/* ── کیف پول ── */}
      <Section
        title="کیف پول"
        action={
          <Link
            href="/wallet"
            className="no-zoom rounded-lg border border-gold/40 px-3 py-1.5 text-[11px] font-bold text-gold transition hover:bg-gold hover:text-ink"
          >
            واریز و برداشت
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="موجودی فعلی" value={usd(wallet.balance)} tone="gain" big />
          <Card label="مجموع واریز" value={usd(wallet.deposited)} />
          <Card label="مجموع برداشت" value={usd(wallet.withdrawn)} />
          <Card
            label={`قفل‌شده در ${wallet.openBets} بازار باز`}
            value={usd(wallet.lockedInMarkets)}
            tone="gold"
          />
        </div>

        {curve.length > 1 && (
          <div className="mt-4 rounded-xl border border-line bg-ink/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-cream">نمودار رشد موجودی</span>
              <span className="text-[10px] text-muted">
                {curve.length} تراکنش اخیر
              </span>
            </div>
            <Sparkline values={curve} />
          </div>
        )}
      </Section>

      {/* ── سود و زیان، تفکیک‌شده ── */}
      <Section title="سود و زیان">
        <p className="mb-4 text-[11px] leading-6 text-muted">
          اقتصاد تتری و اقتصاد امتیازی عمداً از هم جدا نگه داشته می‌شوند: بازار
          ایران با <b className="text-cream">پول واقعی</b> کار می‌کند، ولی نبض
          بازار و آرنا فقط امتیاز مهارت‌اند و به پول تبدیل نمی‌شوند.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* تتری */}
          <div className="rounded-xl border border-line bg-ink/30 p-4">
            <h3 className="text-[12px] font-bold text-cream">
              بازار ایران <span className="text-muted">— تتر</span>
            </h3>
            <div
              className={`mt-3 font-mono text-3xl font-black ${
                iran.net > 0 ? "text-gain" : iran.net < 0 ? "text-loss" : "text-cream"
              }`}
              dir="ltr"
            >
              {iran.net > 0 ? "+" : ""}
              {usd(iran.net).replace("$-", "-$")}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <Row k="شرط‌های تسویه‌شده" v={String(iran.settledBets)} />
              <Row
                k="نرخ برد"
                v={iran.winRate === null ? "—" : `${iran.winRate}٪`}
                tone={iran.winRate !== null && iran.winRate >= 50 ? "gain" : undefined}
              />
              <Row k="برد" v={String(iran.won)} tone="gain" />
              <Row k="باخت" v={String(iran.lost)} tone="loss" />
              <Row k="مجموع شرط" v={usd(iran.staked)} />
              <Row k="مجموع دریافتی" v={usd(iran.returned)} />
            </div>
            {iran.refunded > 0 && (
              <p className="mt-3 text-[10px] text-muted">
                {iran.refunded} شرط در بازارهای باطل‌شده برگشت خورده است.
              </p>
            )}
          </div>

          {/* امتیازی */}
          <div className="rounded-xl border border-line bg-ink/30 p-4">
            <h3 className="text-[12px] font-bold text-cream">
              بازی‌های امتیازی <span className="text-muted">— مهارت</span>
            </h3>
            <div className="mt-3 font-mono text-3xl font-black text-gold" dir="ltr">
              {player.totalPoints}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <Row k="نبض بازار — ثبت‌شده" v={String(skill.pulse.total)} />
              <Row k="نبض بازار — امتیاز" v={String(skill.pulse.points)} />
              <Row k="آرنا — ثبت‌شده" v={String(skill.arena.total)} />
              <Row k="آرنا — امتیاز" v={String(skill.arena.points)} />
              <Row
                k="دقت کلی"
                v={skill.accuracy === null ? "—" : `${skill.accuracy}٪`}
                tone={skill.accuracy !== null && skill.accuracy >= 50 ? "gain" : undefined}
              />
              <Row k="روزهای فعال" v={String(skill.activeDays)} />
            </div>
            {skill.pulse.settled > 0 && (
              <p className="mt-3 text-[10px] text-muted">
                میانگین خطای پیش‌بینی قیمت: {skill.pulse.avgError}٪
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── نشان‌ها ── */}
      <Section title="نشان‌ها">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-4 ${
                b.earned
                  ? "border-gold/40 bg-gold/5"
                  : "border-line bg-ink/20 opacity-50"
              }`}
            >
              <div className="text-xl">{b.icon}</div>
              <div className="mt-2 text-[12px] font-bold text-cream">{b.label}</div>
              <div className="mt-1 text-[10px] leading-5 text-muted">{b.desc}</div>
              {!b.earned && b.progress !== undefined && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full bg-gold/60"
                    style={{ width: `${Math.min(100, b.progress)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── تاریخچه ── */}
      <Section title="تاریخچه‌ی تراکنش‌ها">
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-muted">
            هنوز تراکنشی ثبت نشده.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-3 py-2 text-start font-normal">تاریخ</th>
                  <th className="px-3 py-2 text-start font-normal">نوع</th>
                  <th className="px-3 py-2 text-end font-normal">مبلغ</th>
                  <th className="px-3 py-2 text-end font-normal">موجودی پس از آن</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l, i) => (
                  <tr key={i} className={i % 2 ? "bg-surface/30" : ""}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {fa(l.createdAt)}
                    </td>
                    <td className="px-3 py-2">{KIND_LABEL[l.kind] ?? l.kind}</td>
                    <td
                      className={`px-3 py-2 text-end font-mono font-bold ${
                        l.amount >= 0 ? "text-gain" : "text-loss"
                      }`}
                      dir="ltr"
                    >
                      {l.amount >= 0 ? "+" : ""}
                      {usd(l.amount).replace("$-", "-$")}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-muted" dir="ltr">
                      {usd(l.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── اجزای کوچک ─────────────────────────────────────── */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="no-lift rounded-2xl border border-line bg-surface/40 p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-black">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "gain";
}) {
  return (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`mt-0.5 font-mono text-base font-bold ${
          tone === "gold" ? "text-gold" : tone === "gain" ? "text-gain" : "text-cream"
        }`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "gain" | "gold";
  big?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        big ? "border-gold/40 bg-gold/5" : "border-line bg-raised/40"
      }`}
    >
      <div className="text-[10px] leading-4 text-muted">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-bold ${
          tone === "gain" ? "text-gain" : tone === "gold" ? "text-gold" : "text-cream"
        }`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "gain" | "loss" }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted">{k}</span>
      <span
        className={`font-mono font-bold ${
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-cream"
        }`}
        dir="ltr"
      >
        {v}
      </span>
    </div>
  );
}

/** نمودار خطی ساده — بدون کتابخانه، چون فقط یک سری عدد است. */
function Sparkline({ values }: { values: number[] }) {
  const W = 600;
  const H = 90;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = 6 + (1 - (v - min) / span) * (H - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full" preserveAspectRatio="none">
        <path d={area} fill={up ? "rgba(62,207,142,0.08)" : "rgba(229,72,77,0.08)"} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" />
      </svg>
      {/* برچسب کمینه/بیشینه گمراه‌کننده بود چون کنار محور زمان می‌نشست و
          مثل «مقدار ابتدا و انتها» خوانده می‌شد. حالا صریح است. */}
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
        <span dir="ltr">{usd(values[0])}</span>
        <span>کمینه {usd(min)} · بیشینه {usd(max)}</span>
        <span dir="ltr">{usd(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

/* ── نشان‌ها ─────────────────────────────────────────
   عمدا فقط بر پایه‌ی داده‌ی واقعی موجود ساخته شده‌اند. نشانی که معیارش را
   نمی‌توانیم بسنجیم، ساخته نمی‌شود. */
type Badge = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  earned: boolean;
  progress?: number;
};

function buildBadges(d: Profile): Badge[] {
  const { skill, iran, wallet, player, rank } = d;
  const totalPreds = skill.pulse.total + skill.arena.total;
  return [
    {
      id: "first",
      icon: "🎯",
      label: "اولین پیش‌بینی",
      desc: "اولین پیش‌بینی‌ات را ثبت کردی",
      earned: totalPreds >= 1,
    },
    {
      id: "ten",
      icon: "📈",
      label: "ده‌تایی",
      desc: "۱۰ پیش‌بینی ثبت‌شده",
      earned: totalPreds >= 10,
      progress: (totalPreds / 10) * 100,
    },
    {
      id: "hundred",
      icon: "🏛️",
      label: "صدتایی",
      desc: "۱۰۰ پیش‌بینی ثبت‌شده",
      earned: totalPreds >= 100,
      progress: (totalPreds / 100) * 100,
    },
    {
      id: "week",
      icon: "🔥",
      label: "هفت روز پیاپی",
      desc: "استریک ۷ روزه",
      earned: player.streak >= 7,
      progress: (player.streak / 7) * 100,
    },
    {
      id: "funded",
      icon: "💧",
      label: "کیف پول فعال",
      desc: "اولین واریز تتر",
      earned: wallet.deposited > 0,
    },
    {
      id: "irwin",
      icon: "🏆",
      label: "برد در بازار ایران",
      desc: "حداقل یک شرط برنده",
      earned: iran.won >= 1,
    },
    {
      id: "profitable",
      icon: "💎",
      label: "سودده",
      desc: "سود خالص مثبت در بازار ایران",
      earned: iran.net > 0,
    },
    {
      id: "top10",
      icon: "👑",
      label: "ده درصد برتر",
      desc: "جایگاه بالای ۹۰٪ کاربران",
      earned: rank.percentile >= 90,
      progress: rank.percentile,
    },
  ];
}
