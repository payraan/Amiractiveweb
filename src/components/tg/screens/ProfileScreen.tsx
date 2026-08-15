"use client";

import { LINKS } from "@/config/site";
import { useCallback, useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { api } from "@/components/tg/api";
import { ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic, openTelegramChat } from "@/components/tg/telegram";
import { shareText } from "@/components/tg/share";
import {
  BADGES,
  TIER_STYLE,
  MAX_SHOWCASE,
  type BadgeStats,
  type Tier,
} from "@/lib/badges";

// پروفایل — از همان /api/profile سایت، با همان نشان‌ها.
//
// BADGES و شرط‌های کسبشان از badges.ts می‌آید (که هیچ وابستگی سروری ندارد)،
// پس مینی‌اپ و سایت دقیقا یک تعریف از «کسب‌شده» دارند. کپی‌کردن ۲۳ شرط در
// دو جا یعنی دیر یا زود یکی از دو رابط نشانی را باز نشان می‌دهد که دیگری
// بسته می‌داند.

type Profile = {
  player: {
    username: string | null;
    displayName: string;
    credits: number;
    totalPoints: number;
    streak: number;
    usdtBalance: number;
    createdAt: string;
    telegramLinked: boolean;
  };
  wallet: { deposited: number; withdrawn: number };
  iran: {
    settledBets: number;
    won: number;
    lost: number;
    net: number;
    staked: number;
    winRate: number | null;
  };
  rank: { above: number; percentile: number };
  badgeStats: BadgeStats;
  showcase: string[];
};

const fa = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const num = (n: number) => n.toLocaleString("en-US");
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Metric({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: string;
  tone?: "cream" | "gold" | "gain" | "loss" | "muted";
}) {
  const c = {
    cream: "text-cream",
    gold: "text-gold",
    gain: "text-gain",
    loss: "text-loss",
    muted: "text-muted",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-3 py-3 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div dir="ltr" className={`mt-1 font-mono text-[14px] font-bold ${c}`}>
        {value}
      </div>
    </div>
  );
}

export default function ProfileScreen({ siteUrl }: { siteUrl: string }) {
  const { data: p, error, reload } = useResource<Profile>("/api/profile");
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);

  const showcase = draft ?? p?.showcase ?? [];

  const toggle = useCallback(
    (id: string) => {
      haptic.tap();
      const cur = draft ?? p?.showcase ?? [];
      if (cur.includes(id)) setDraft(cur.filter((x) => x !== id));
      else if (cur.length < MAX_SHOWCASE) setDraft([...cur, id]);
    },
    [draft, p?.showcase]
  );

  const save = useCallback(async () => {
    if (!draft) {
      setPicking(false);
      return;
    }
    setSaving(true);
    try {
      await api("/api/profile/showcase", {
        method: "POST",
        body: JSON.stringify({ ids: draft }),
      });
      haptic.success();
      setDraft(null);
      setPicking(false);
      reload();
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  }, [draft, reload]);

  if (error) return <ErrorState message="اطلاعات پروفایل نیامد." onRetry={reload} />;

  if (!p) {
    return (
      <div>
        <ScreenTitle title="پروفایل" />
        <Skeleton className="h-24" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-4 h-32" />
      </div>
    );
  }

  const me = p.player;
  const initial = (me.displayName || "؟").trim().charAt(0);
  const stats = p.badgeStats;
  const earned = BADGES.filter((b) => b.earned(stats));

  return (
    <div>
      <ScreenTitle title="پروفایل" />

      <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface/40 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-xl font-black text-gold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-cream">
            {me.displayName}
          </div>
          {/* هندل تأییدشده جداست از نام کاربریِ ورود: اولی را تلگرام امضا
              کرده، دومی را خود کاربر انتخاب کرده و اثباتی ندارد. */}
          {me.username && (
            <div dir="ltr" className="mt-0.5 text-right font-mono text-[11px] text-muted">
              @{me.username}
              {me.telegramLinked && <span className="ms-1 text-gain">✓</span>}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                me.telegramLinked ? "bg-gain" : "bg-loss"
              }`}
            />
            <span className="text-[10px] text-muted">
              {me.telegramLinked ? "تلگرام تأیید شده" : "تلگرام وصل نیست"}
            </span>
          </div>
        </div>
      </div>

      {/* ⚠️ پشتیبانی بالای صفحه، نه پای آن: کاربری که دنبال راه ارتباط
          می‌گردد نباید از کنار نشان‌ها و آمار و کارنامه رد شود تا پیدایش
          کند. مینی‌اپ تا امروز هیچ ورودی عمومی پشتیبانی نداشت — نه در
          منو، نه در پروفایل — و تنها راهش صفحه‌ی کیف پول بود. */}
      <a
        href={LINKS.telegramSupport}
        onClick={(e) => {
          e.preventDefault();
          openTelegramChat(LINKS.telegramSupport);
        }}
        className="mt-2.5 block rounded-2xl border border-line bg-surface/40 py-3 text-center text-[11.5px] text-muted transition active:border-gold/40"
      >
        🎧 گفت‌وگو با پشتیبانی
      </a>

      {/* نشان‌های منتخب، کنار نام */}
      {showcase.length > 0 && (
        <div className="mt-2.5 flex gap-2">
          {showcase.map((id) => {
            const b = BADGES.find((x) => x.id === id);
            if (!b) return null;
            const st = TIER_STYLE[b.tier];
            return (
              <span
                key={id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${st.ring} ${st.text}`}
              >
                <span>{b.icon}</span>
                {b.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Metric label="MOON" value={num(me.credits)} tone="gold" />
        <Metric label="تتر" value={`$${money(me.usdtBalance)}`} tone="gain" />
        <Metric
          label="امتیاز"
          value={num(me.totalPoints)}
          tone={me.totalPoints >= 0 ? "gain" : "loss"}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        <Metric label="روزهای متوالی (استریک)" value={`${me.streak} روز`} />
        <Metric label="رتبه" value={`${p.rank.above + 1}`} />
        <Metric label="درصد برتر" value={`${p.rank.percentile}%`} tone="gold" />
      </div>

      {/* بازار ایران: پول واقعی، پس جدا از امتیاز نشان داده می‌شود */}
      <h3 className="mb-2 mt-5 text-xs font-bold text-cream">بازار ایران</h3>
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="پیش‌بینی‌های تسویه‌شده" value={num(p.iran.settledBets)} />
        <Metric
          label="درصد موفقیت"
          value={p.iran.winRate === null ? "—" : `${p.iran.winRate}%`}
          tone={p.iran.winRate !== null && p.iran.winRate >= 50 ? "gain" : "muted"}
        />
        <Metric
          label="سود خالص"
          value={`${p.iran.net >= 0 ? "+" : ""}$${money(p.iran.net)}`}
          tone={p.iran.net >= 0 ? "gain" : "loss"}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Metric label="کل واریز" value={`$${money(p.wallet.deposited)}`} />
        <Metric label="کل برداشت" value={`$${money(p.wallet.withdrawn)}`} />
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-cream">
          نشان‌ها{" "}
          <span dir="ltr" className="font-mono text-[10px] text-muted">
            {earned.length}/{BADGES.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            if (picking) save();
            else setPicking(true);
          }}
          disabled={saving}
          className="rounded-lg border border-line bg-surface/40 px-2.5 py-1.5 text-[10.5px] text-muted transition active:border-gold active:text-gold disabled:opacity-50"
        >
          {saving ? "…" : picking ? "ذخیره" : `انتخاب ${MAX_SHOWCASE} نشان`}
        </button>
      </div>

      {picking && (
        <p className="mb-2 rounded-xl border border-gold/25 bg-gold/5 px-3.5 py-2.5 text-[10.5px] leading-6 text-gold">
          تا {MAX_SHOWCASE} نشانِ کسب‌شده انتخاب کن تا کنار نامت بنشیند.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {BADGES.map((b) => {
          const got = b.earned(stats);
          const st = TIER_STYLE[b.tier as Tier];
          const chosen = showcase.includes(b.id);
          const prog = b.progress ? Math.min(100, Math.max(0, b.progress(stats))) : null;
          return (
            <button
              key={b.id}
              type="button"
              disabled={!picking || !got}
              onClick={() => toggle(b.id)}
              title={`${b.label} — ${b.desc}`}
              className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border px-1 py-2.5 transition ${
                got ? st.ring : "border-line bg-surface/20"
              } ${chosen ? "ring-2 ring-gold" : ""} ${
                picking && got ? "active:scale-95" : ""
              }`}
            >
              <span className={got ? "text-lg" : "text-lg opacity-25 grayscale"}>
                {b.icon}
              </span>
              <span
                className={`line-clamp-1 text-[8.5px] ${got ? st.text : "text-muted"}`}
              >
                {b.label}
              </span>
              {/* نوار پیشرفت فقط برای نشان‌های نکسب‌شده‌ی شمارشی — تا کاربر
                  بداند چقدر مانده، نه فقط اینکه ندارد. */}
              {!got && prog !== null && prog > 0 && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-raised">
                  <span
                    className="block h-full bg-gold/60"
                    style={{ width: `${prog}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          haptic.press();
          shareText(
            `کارنامه‌ی من در نارمون:\n` +
              `امتیاز ${num(me.totalPoints)} · درصد برتر ${p.rank.percentile}%\n` +
              `${earned.length} نشان از ${BADGES.length}`,
            `${siteUrl}/profile`
          );
        }}
        className="mt-5 w-full rounded-xl border border-gold/30 bg-gold/10 py-3.5 text-xs font-bold text-gold transition active:border-gold"
      >
        اشتراک‌گذاری کارنامه
      </button>

      <p className="mt-3 text-center text-[10px] text-muted">
        عضویت از {fa(me.createdAt)}
      </p>
    </div>
  );
}
