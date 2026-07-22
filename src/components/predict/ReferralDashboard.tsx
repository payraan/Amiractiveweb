"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";

type Stats = {
  code: string;
  invited: number;
  activeInvited: number;
  earned: number;
  recent: { name: string; credits: number; commission: number; at: string }[];
};

const CHANNEL = "https://t.me/CashflowFactorys";

function faDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ReferralDashboard() {
  const { player, loading, refresh } = usePlayer();
  const [stats, setStats] = useState<Stats | null>(null);
  const [percent, setPercent] = useState(10);
  const [bonus, setBonus] = useState(5);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const load = useCallback(() => {
    fetch("/api/predict/referral", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setStats(j.stats ?? null);
        setPercent(j.percent ?? 10);
        setBonus(j.bonus ?? 5);
        setBusy(false);
      })
      .catch(() => setBusy(false));
  }, []);

  useEffect(load, [load, player?.credits]);

  const link =
    typeof window !== "undefined" && stats?.code
      ? `${window.location.origin}/arena?ref=${stats.code}`
      : "";

  function copy(what: "code" | "link") {
    const text = what === "code" ? (stats?.code ?? "") : link;
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(what);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {});
  }

  const shareText = `من توی آرنای پیش‌بینی نارمون پیش‌بینی می‌کنم — با این لینک ثبت‌نام کنی ${bonus} کردیت هدیه می‌گیری:`;
  const tgShare = `https://t.me/share/url?url=${encodeURIComponent(
    link
  )}&text=${encodeURIComponent(shareText)}`;

  return (
    <>
      {/* توضیح */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            n: "۱",
            t: "لینک خود را بفرستید",
            b: "کد یا لینک اختصاصی‌تان را برای دوستان بفرستید.",
          },
          {
            n: "۲",
            t: "آن‌ها هدیه می‌گیرند",
            b: `هرکس با لینک شما ثبت‌نام کند، ${bonus} کردیت هدیه‌ی اضافه می‌گیرد.`,
          },
          {
            n: "۳",
            t: "شما پورسانت می‌گیرید",
            b: `از هر شارژ کردیت آن‌ها، ${percent}٪ به‌صورت کردیت به حساب شما اضافه می‌شود — همیشگی.`,
          },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-line bg-surface/40 p-5 transition-all duration-300 hover:scale-[1.02] hover:border-gold/60 hover:shadow-[0_0_24px_rgba(232,196,106,0.12)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/50 font-mono text-sm font-bold text-gold">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-bold">{s.t}</h3>
            <p className="mt-2 text-[11px] leading-6 text-muted">{s.b}</p>
          </div>
        ))}
      </div>

      {!loading && !player && (
        <div className="mt-8 max-w-md">
          <p className="mb-4 text-xs text-muted">
            برای دریافت کد دعوت اختصاصی، وارد حساب شوید.
          </p>
          <AuthPanel onAuthed={() => refresh()} />
        </div>
      )}

      {player && (
        <>
          {/* آمار */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "دعوت‌شده‌ها",
                value: busy ? "…" : String(stats?.invited ?? 0),
                tone: "text-cream",
              },
              {
                label: "دعوت‌شده‌های فعال",
                value: busy ? "…" : String(stats?.activeInvited ?? 0),
                tone: "text-cream",
              },
              {
                label: "کردیت دریافتی",
                value: busy ? "…" : `${stats?.earned ?? 0}◆`,
                tone: "text-gold",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-line bg-surface/50 p-5 transition-all duration-300 hover:border-gold/50"
              >
                <div className="text-[11px] text-muted">{c.label}</div>
                <div className={`mt-1 font-mono text-2xl font-bold ${c.tone}`} dir="ltr">
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* کد و لینک */}
          <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-6">
            <h2 className="text-sm font-bold text-gold">کد دعوت شما</h2>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
                <span className="font-mono text-xl font-black tracking-[0.3em] text-gold" dir="ltr">
                  {stats?.code ?? "······"}
                </span>
                <button
                  type="button"
                  onClick={() => copy("code")}
                  className="no-zoom shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11px] text-muted transition hover:border-gold hover:text-gold"
                >
                  {copied === "code" ? "کپی شد ✓" : "کپی کد"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
              <span className="line-clamp-1 font-mono text-[11px] text-muted" dir="ltr">
                {link || "…"}
              </span>
              <button
                type="button"
                onClick={() => copy("link")}
                className="no-zoom shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11px] text-muted transition hover:border-gold hover:text-gold"
              >
                {copied === "link" ? "کپی شد ✓" : "کپی لینک"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={tgShare}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
              >
                ارسال در تلگرام
              </a>
              <a
                href={CHANNEL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line px-6 py-3 text-sm text-cream transition hover:border-gold hover:text-gold"
              >
                کانال تلگرام
              </a>
            </div>

            <p className="mt-4 text-[10px] leading-5 text-muted">
              پورسانت به‌صورت کردیت پرداخت می‌شود، نه پول نقد. ساخت حساب‌های
              تقلبی برای دریافت پورسانت، به حذف حساب و ابطال کردیت‌ها منجر
              می‌شود.
            </p>
          </div>

          {/* تاریخچه */}
          {stats && stats.recent.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-bold">آخرین پورسانت‌ها</h2>
              <div className="overflow-hidden rounded-2xl border border-line">
                {stats.recent.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                      i % 2 ? "bg-surface/30" : "bg-surface/50"
                    }`}
                  >
                    <span className="flex-1 font-bold">{r.name}</span>
                    <span className="font-mono text-[10px] text-muted" dir="ltr">
                      {faDateTime(r.at)}
                    </span>
                    <span className="font-mono text-[10px] text-muted" dir="ltr">
                      شارژ {r.credits}◆
                    </span>
                    <b className="font-mono text-gold" dir="ltr">
                      +{r.commission}◆
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats && stats.invited === 0 && (
            <p className="mt-6 text-[11px] text-muted">
              هنوز کسی با لینک شما ثبت‌نام نکرده است. لینک بالا را در گروه‌ها و
              شبکه‌های اجتماعی‌تان بگذارید.
            </p>
          )}
        </>
      )}
    </>
  );
}
