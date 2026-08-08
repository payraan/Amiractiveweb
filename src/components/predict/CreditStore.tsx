"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CREDIT_PACKS } from "@/lib/game";
import { usePlayer } from "@/components/predict/usePlayer";

const ERR: Record<string, string> = {
  not_authed: "برای خرید MOON وارد حساب شوید.",
  insufficient_funds: "موجودی تتر کیف پول کافی نیست.",
  bad_pack: "این بسته معتبر نیست.",
};

/**
 * فروشگاه MOON — خرید آنی از موجودی تتر کیف پول.
 * قبلا کاربر به تلگرام هدایت می‌شد و شارژ دستی بود؛ حالا که کیف پول داخلی
 * داریم، خرید همین‌جا و بدون واسطه تمام می‌شود.
 */
export default function CreditStore({ compact = false }: { compact?: boolean }) {
  const { player, refresh } = usePlayer();
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadBalance = useCallback(async () => {
    if (!player) return;
    try {
      const r = await fetch("/api/wallet", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setBalance(Number(j.balance ?? 0));
    } catch {
      /* موجودی صرفا برای نمایش است؛ سرور خودش هنگام خرید چک می‌کند */
    }
  }, [player]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  async function buy(packId: string) {
    setBusy(packId);
    setMsg(null);
    try {
      const r = await fetch("/api/wallet/buy-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ ok: false, text: ERR[j.error] ?? "خطایی رخ داد." });
        return;
      }
      setMsg({
        ok: true,
        text: `${j.gained} MOON اضافه شد. موجودی MOON: ${j.credits}`,
      });
      await Promise.all([refresh(), loadBalance()]);
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="credits" className="scroll-mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black">خرید MOON</h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-muted">
            MOON، تایم‌فریم‌های کوتاه‌تر و پیش‌بینی‌های بیشتر را باز می‌کند.
            MOON فقط قابلیت می‌خرد، نه امتیاز و نه رتبه — جایگاه شما همیشه با
            مهارت ساخته می‌شود.
          </p>
        </div>

        {player && (
          <div className="no-lift rounded-xl border border-line bg-raised/40 px-4 py-2.5">
            <div className="text-[10px] text-muted">موجودی کیف پول</div>
            <div className="mt-0.5 flex items-baseline gap-3 font-mono text-sm" dir="ltr">
              <span className="font-bold text-gain">
                ${(balance ?? 0).toFixed(2)}
              </span>
              <span className="text-gold">{player.credits} MOON</span>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
            msg.ok
              ? "border-gain/40 bg-gain/5 text-gain"
              : "border-loss/40 bg-loss/5 text-loss"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div
        className={`mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          compact ? "lg:grid-cols-4" : "lg:grid-cols-4"
        }`}
      >
        {CREDIT_PACKS.map((pack) => {
          const perCredit = pack.priceUsdt / pack.credits;
          const affordable = balance !== null && balance >= pack.priceUsdt;
          return (
            <div
              key={pack.id}
              className={`card-hover relative flex flex-col rounded-2xl border p-5 ${
                pack.badge
                  ? "border-gold/50 bg-surface/70 backdrop-blur"
                  : "border-line bg-surface/40"
              }`}
            >
              {pack.badge && (
                <span className="absolute -top-3 right-5 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-ink">
                  {pack.badge}
                </span>
              )}

              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold text-gold" dir="ltr">
                  {pack.credits}
                </span>
                <span className="text-sm text-muted"> MOON MOON</span>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold" dir="ltr">
                  {pack.priceUsdt}
                </span>
                <span className="text-xs text-muted">تتر</span>
              </div>

              <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
                ~{perCredit.toFixed(3)} USDT / credit
              </div>

              {!player ? (
                <Link
                  href="/login"
                  className="no-zoom mt-5 block rounded-xl border border-line py-3 text-center font-display text-sm font-extrabold text-cream transition hover:border-gold hover:text-gold"
                >
                  ورود برای خرید
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => buy(pack.id)}
                  disabled={busy !== null || !affordable}
                  className={`no-zoom mt-5 rounded-xl py-3 text-center font-display text-sm font-extrabold transition disabled:opacity-40 ${
                    pack.badge
                      ? "bg-gold text-ink hover:bg-gold-deep"
                      : "border border-line text-cream hover:border-gold hover:text-gold"
                  }`}
                >
                  {busy === pack.id
                    ? "…"
                    : affordable
                      ? "خرید آنی"
                      : "موجودی کافی نیست"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="no-lift mt-5 rounded-2xl border border-line bg-raised/40 p-5">
          <h3 className="text-sm font-bold">چطور خرید کنم؟</h3>
          <ol className="mt-3 flex flex-col gap-2 text-xs leading-6 text-muted">
            <li>
              ۱. اگر موجودی تتر ندارید، اول از{" "}
              <Link href="/wallet" className="text-gold hover:text-gold-deep">
                صفحه‌ی کیف پول
              </Link>{" "}
              تتر واریز کنید (شبکه TRC20).
            </li>
            <li>۲. بسته‌ی موردنظر را انتخاب و روی «خرید آنی» بزنید.</li>
            <li>
              ۳. مبلغ از موجودی کیف پول کم و MOON{" "}
              <b className="text-cream">بلافاصله</b> اضافه می‌شود — بدون واسطه و
              بدون انتظار.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
