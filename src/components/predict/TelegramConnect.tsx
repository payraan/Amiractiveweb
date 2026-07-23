"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlayer } from "@/components/predict/usePlayer";

type Status = { linked: boolean; bonusClaimed: boolean; bonusCredits: number };

const CHANNEL = "https://t.me/CashflowFactorys";

export default function TelegramConnect() {
  const { player, refresh } = usePlayer();
  const [status, setStatus] = useState<Status | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/predict/tg-link", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setStatus(j.status ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(load, [load, player?.credits]);

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/predict/tg-link", { method: "POST" });
      const j = await res.json();
      if (j.ok && j.deepLink) {
        setLink(j.deepLink);
        window.open(j.deepLink, "_blank", "noopener");
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  if (!player || loading) return null;

  if (status?.linked) {
    return (
      <div className="rounded-2xl border border-gain/40 bg-gain/5 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-gain">
          <span>✓</span> تلگرام شما متصل است
        </div>
        <p className="mt-2 text-[11px] leading-6 text-muted">
          {status.bonusClaimed
            ? "هدیه‌ی عضویت گروه دریافت شده است. نتیجه‌ی پیش‌بینی‌ها و وضعیت چلنج از همین‌جا به شما اطلاع داده می‌شود."
            : `هنوز هدیه‌ی عضویت نگرفته‌اید — عضو گروه شوید و در ربات دستور /bonus را بزنید تا ${status.bonusCredits} کردیت دریافت کنید.`}
        </p>
        {!status.bonusClaimed && (
          <a
            href={CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-xl bg-gold px-5 py-2.5 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
          >
            عضویت در گروه تلگرام
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <h3 className="text-sm font-bold text-gold">
        تلگرام را وصل کنید و {status?.bonusCredits ?? 20} کردیت هدیه بگیرید
      </h3>
      <ul className="mt-3 flex flex-col gap-1.5 text-[11px] leading-6 text-muted">
        <li>— نتیجه‌ی پیش‌بینی‌ها و وضعیت چلنج مستقیم برایتان ارسال می‌شود.</li>
        <li>— تأیید شارژ کردیت و اطلاع‌رسانی جوایز، بدون نیاز به سر زدن به سایت.</li>
        <li>— با عضویت در گروه، کردیت هدیه به حساب شما اضافه می‌شود.</li>
      </ul>

      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="no-zoom mt-4 rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
      >
        {busy ? "…" : "اتصال به تلگرام"}
      </button>

      {link && (
        <p className="mt-3 text-[10px] leading-5 text-muted">
          اگر پنجره‌ی تلگرام باز نشد،{" "}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline"
          >
            این لینک
          </a>{" "}
          را باز کنید و روی «Start» بزنید. سپس همین صفحه را تازه‌سازی کنید.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          load();
          refresh();
        }}
        className="no-zoom mt-3 block text-[11px] text-muted transition hover:text-gold"
      >
        اتصال را انجام دادم — بررسی وضعیت
      </button>
    </div>
  );
}
