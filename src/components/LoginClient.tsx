"use client";

import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";

/**
 * صفحه‌ی ورود.
 *
 * پس از ورود مستقیم به بازار ایران می‌رود، نه نبض بازار — تمرکز پلتفرم آنجاست
 * و ربات/مینی‌اپ تلگرام هم روی همان بخش سوار می‌شود.
 */
const AFTER_LOGIN = "/iran";

const REASONS = [
  {
    icon: "🇮🇷",
    title: "بازار ایران",
    body: "روی رویدادهای واقعی ایران پیش‌بینی کن — اقتصاد، ورزش، اجتماعی. بازارها را خود کاربران می‌سازند.",
  },
  {
    icon: "👛",
    title: "کیف پول شخصی",
    body: "واریز و برداشت تتر، بدون واسطه. برد و باخت همان‌جا تسویه می‌شود.",
  },
  {
    icon: "🎯",
    title: "کارنامه‌ی شفاف",
    body: "دقت پیش‌بینی، سود و زیان و جایگاه رتبه‌ات همیشه جلوی چشمت است.",
  },
  {
    icon: "🏆",
    title: "چلنج و لیدربورد",
    body: "امتیاز فقط از مهارت می‌آید. با MOON می‌توانی در چلنج پراپ شرکت کنی.",
  },
];

export default function LoginClient() {
  const { player, loading, logout } = usePlayer();

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-muted">در حال بررسی حساب…</div>
    );
  }

  /* ── حالت وارد‌شده ── */
  if (player) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="no-lift rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur md:p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 font-display text-xl font-black text-gold">
              {player.displayName.trim().charAt(0) || "؟"}
            </span>
            <div className="min-w-0">
              <div className="text-[11px] text-muted">وارد شده‌اید</div>
              <div className="truncate font-display text-xl font-extrabold">
                {player.displayName}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-raised/40 px-4 py-3">
              <div className="text-[10px] text-muted">موجودی MOON</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-cream" dir="ltr">
                {player.credits}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-raised/40 px-4 py-3">
              <div className="text-[10px] text-muted">امتیاز</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-gold" dir="ltr">
                {player.totalPoints}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/iran"
              className="no-zoom rounded-xl bg-gold py-3 text-center font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
            >
              رفتن به بازار ایران
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/profile"
                className="no-zoom rounded-xl border border-line py-2.5 text-center text-sm text-cream transition hover:border-gold hover:text-gold"
              >
                پنل کاربری
              </Link>
              <Link
                href="/wallet"
                className="no-zoom rounded-xl border border-line py-2.5 text-center text-sm text-cream transition hover:border-gold hover:text-gold"
              >
                کیف پول
              </Link>
            </div>
            <button
              type="button"
              onClick={logout}
              className="no-zoom mt-1 rounded-xl py-2.5 text-sm text-muted transition hover:text-loss"
            >
              خروج از حساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── حالت مهمان: فرم در یک ستون، دلیل‌ها در ستون دیگر ── */
  return (
    <div className="no-lift overflow-hidden rounded-2xl border border-line bg-surface/50 backdrop-blur">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* فرم */}
        <div className="order-1 p-6 md:p-8 lg:order-2 lg:border-s lg:border-line">
          <AuthPanel
            bare
            onAuthed={() => {
              window.location.href = AFTER_LOGIN;
            }}
          />
        </div>

        {/* چرا حساب بسازم */}
        <div className="order-2 border-t border-line p-6 md:p-8 lg:order-1 lg:border-t-0">
          <span className="font-mono text-[11px] tracking-[0.25em] text-gold-deep">
            NARMOON
          </span>
          <h2 className="mt-3 font-display text-2xl font-black leading-snug md:text-3xl">
            یک حساب،
            <br />
            <span className="text-gold">همه‌ی بازارها</span>
          </h2>
          <p className="mt-3 text-[12px] leading-7 text-muted">
            ثبت‌نام چند ثانیه طول می‌کشد و برای شروع هیچ پرداختی لازم نیست.
          </p>

          <ul className="mt-6 flex flex-col gap-4">
            {REASONS.map((r) => (
              <li key={r.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-ink/40 text-base">
                  {r.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-cream">
                    {r.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-6 text-muted">
                    {r.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-line pt-4 text-[10px] leading-6 text-muted">
            امتیاز نارمون خریدنی نیست و فقط از دقت پیش‌بینی‌هایت ساخته می‌شود.
          </p>
        </div>
      </div>
    </div>
  );
}
