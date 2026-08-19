"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { api } from "@/components/tg/api";
import { Card, EmptyState, ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";
import { shareText } from "@/components/tg/share";

// ── پنل دعوت داخل مینی‌اپ ────────────────────────────────────
//
// ── چرا این صفحه وجود دارد ──
// تا امروز دعوت فقط در سایت بود. یعنی کاربر تلگرامی برای گرفتن کد خودش
// باید از تلگرام بیرون می‌رفت — دقیقا همان چیزی که کل معماری مینی‌اپ برای
// جلوگیری‌اش ساخته شده. ادمین کانالی که می‌خواهد اعضایش را بیاورد، اگر
// اولین قدمش «برو به سایت» باشد، همان‌جا ریزش می‌کند.
//
// ⚠️ هیچ روت تازه‌ای ساخته نشده: همان `/api/predict/referral` سایت. منطق
// پورسانت یکی است و یکی می‌ماند.

type Stats = {
  code: string;
  invited: number;
  activeInvited: number;
  earned: number;
  recent: { name: string; credits: number; commission: number; at: string }[];
};

type Res = {
  authed: boolean;
  percent: number;
  bonus: number;
  stats: Stats | null;
};

type BonusRes = { ok: boolean; granted?: number; error?: string };

const fa = (n: number) => n.toLocaleString("fa-IR");

const faDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "long",
    day: "numeric",
  });
};

export default function ReferralScreen({ botUsername }: { botUsername: string }) {
  const { data, error, reload } = useResource<Res>("/api/predict/referral");
  const [copied, setCopied] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const s = data.stats;

  // ⚠️ لینک دعوت به **مینی‌اپ** می‌رود، نه به سایت. کسی که از تلگرام دعوت
  // می‌شود باید در تلگرام بماند؛ فرستادنش به مرورگر یعنی یک قدم اضافه و
  // یک ثبت‌نام کمتر.
  const link =
    s && botUsername
      ? `https://t.me/${botUsername}/market?startapp=ref_${s.code}`
      : "";

  const invite =
    `من در نارمون پیش‌بینی می‌کنم — بازار پیش‌بینی رویدادهای واقعی.\n\n` +
    `با این لینک ثبت‌نام کن و ${fa(data.bonus)} MOON هدیه بگیر:`;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      haptic.tap();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* کلیپ‌بورد در دسترس نبود — دکمه‌ی اشتراک‌گذاری همچنان کار می‌کند */
    }
  }

  /** هدیه‌ی عضویت کانال — همان مسیری که ربات و سایت صدا می‌زنند. */
  async function claimBonus() {
    setBusy(true);
    setBonusMsg(null);
    try {
      const j = await api<BonusRes>("/api/predict/tg-link", {
        method: "POST",
        body: JSON.stringify({ action: "bonus" }),
      });
      setBonusMsg(`${fa(j.granted ?? 0)} MOON به حسابت اضافه شد.`);
      haptic.success();
      reload();
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      const why: Record<string, string> = {
        not_member: "هنوز عضو کانال نیستی. اول عضو شو، بعد دوباره بزن.",
        already: "این هدیه قبلا به حسابت اضافه شده.",
        no_account: "حسابت هنوز به تلگرام وصل نیست.",
        not_configured: "این هدیه فعلا در دسترس نیست.",
        unknown: "الان نتوانستم عضویتت را بررسی کنم. کمی بعد دوباره بزن.",
      };
      setBonusMsg(why[code] ?? "دریافت هدیه انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title="دعوت دوستان" subtitle="از هر شارژ دعوت‌شده‌هایت سهم می‌گیری" />

      {/* ── کد و لینک ────────────────────────────────────── */}
      <Card>
        <p className="text-[11px] text-muted">کد اختصاصی تو</p>
        <p
          dir="ltr"
          className="mt-1 font-mono text-2xl font-black tracking-wider text-gold"
        >
          {s?.code ?? "—"}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => link && shareText(invite, link)}
            disabled={!link}
            className="flex-1 rounded-xl bg-gold px-4 py-3 font-display text-sm font-extrabold text-ink transition active:scale-[0.98] disabled:opacity-40"
          >
            ارسال دعوت
          </button>
          <button
            onClick={copy}
            disabled={!link}
            className="rounded-xl border border-line px-4 py-3 text-xs font-bold text-cream transition active:scale-[0.98] disabled:opacity-40"
          >
            {copied ? "کپی شد" : "کپی لینک"}
          </button>
        </div>
      </Card>

      {/* ── اقتصاد دعوت، صریح و بدون ابهام ───────────────── */}
      <Card>
        <p className="text-xs font-bold text-cream">چطور کار می‌کند</p>
        <ol className="mt-3 flex flex-col gap-2.5 text-[11px] leading-6 text-muted">
          <li>
            <span className="font-bold text-gold">۱.</span> لینک بالا را برای
            دوستانت — یا اعضای کانالت — بفرست.
          </li>
          <li>
            <span className="font-bold text-gold">۲.</span> هرکس با آن ثبت‌نام
            کند، <span className="font-bold text-cream">{fa(data.bonus)} MOON</span>{" "}
            هدیه می‌گیرد.
          </li>
          <li>
            <span className="font-bold text-gold">۳.</span> از هر شارژ MOON او،{" "}
            <span className="font-bold text-cream">{fa(data.percent)}٪</span> به
            حساب تو اضافه می‌شود — همیشه و بدون سقف.
          </li>
        </ol>
        <p className="mt-3 border-t border-line/60 pt-3 text-[10.5px] leading-6 text-muted">
          سهم تو از MOONِ خود او کم نمی‌شود؛ جدا حساب می‌شود.
        </p>
      </Card>

      {/* ── هدیه‌ی عضویت کانال ───────────────────────────── */}
      <Card>
        <p className="text-xs font-bold text-cream">هدیه‌ی عضویت کانال</p>
        <p className="mt-2 text-[11px] leading-6 text-muted">
          عضو کانال نارمون شو و همین‌جا هدیه‌ات را بگیر. عضویت در همان لحظه
          بررسی می‌شود.
        </p>
        <button
          onClick={claimBonus}
          disabled={busy}
          className="mt-3 w-full rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs font-bold text-gold transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "در حال بررسی…" : "دریافت هدیه"}
        </button>
        {bonusMsg && (
          <p className="mt-2 text-[11px] leading-6 text-gold">{bonusMsg}</p>
        )}
      </Card>

      {/* ── آمار ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <p className="font-mono text-xl font-black text-cream">
            {fa(s?.invited ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-muted">دعوت‌شده</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-xl font-black text-cream">
            {fa(s?.activeInvited ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-muted">فعال</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-xl font-black text-gold">
            {fa(s?.earned ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-muted">MOON دریافتی</p>
        </Card>
      </div>

      {/* ── تاریخچه ──────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs font-bold text-cream">آخرین پورسانت‌ها</p>
        {/* ⚠️ حالت خالی اجباری است: فهرستی که فقط با داده رندر شود، برای
            کاربر تازه یعنی «این قابلیت وجود ندارد». */}
        {!s?.recent.length ? (
          <EmptyState
            title="هنوز پورسانتی نگرفته‌ای"
            hint="با اولین شارژِ یکی از دعوت‌شده‌هایت، اینجا پر می‌شود."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {s.recent.map((r, i) => (
              <Card key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-cream">{r.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    شارژ {fa(r.credits)} MOON · {faDate(r.at)}
                  </p>
                </div>
                <p className="font-mono text-sm font-black text-gain">
                  +{fa(r.commission)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
