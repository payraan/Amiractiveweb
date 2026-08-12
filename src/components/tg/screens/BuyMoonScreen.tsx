"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { CREDIT_PACKS } from "@/lib/game";
import { haptic, showBackButton } from "@/components/tg/telegram";

// خرید MOON از موجودی تتر — روی همان /api/wallet/buy-credits سایت.
//
// MOON فقط قابلیت باز می‌کند و هرگز امتیاز یا رتبه نمی‌خرد؛ بسته‌ها هم از
// game.ts می‌آیند نه از یک فهرست دوم، تا قیمت‌ها در دو رابط یکی بماند.

const ERR: Record<string, string> = {
  not_authed: "ابتدا وارد شو.",
  bad_pack: "این بسته معتبر نیست.",
  insufficient_funds: "موجودی تتر کافی نیست.",
  server_error: "خطای سرور. کمی بعد دوباره امتحان کن.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BuyMoonScreen({
  balance,
  onBack,
  onDone,
}: {
  balance: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => showBackButton(onBack), [onBack]);

  const buy = useCallback(
    async (packId: string) => {
      if (busyId) return;
      setBusyId(packId);
      setMsg(null);
      try {
        const j = await api<{ gained: number; spent: number; credits: number }>(
          "/api/wallet/buy-credits",
          { method: "POST", body: JSON.stringify({ packId }) }
        );
        haptic.success();
        setMsg({
          ok: true,
          text: `${j.gained} MOON اضافه شد. موجودی MOON: ${j.credits}`,
        });
        onDone();
      } catch (e) {
        haptic.error();
        const code = e instanceof ApiError ? e.code : "";
        setMsg({ ok: false, text: ERR[code] ?? "خرید انجام نشد." });
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onDone]
  );

  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-black text-cream">خرید MOON</h2>
      <p className="mb-4 text-[11px] text-muted">
        از موجودی تتر؛ موجودی فعلی{" "}
        <span dir="ltr" className="font-mono text-gain">
          ${money(balance)}
        </span>
      </p>

      <div className="rounded-xl border border-line bg-surface/30 p-3.5">
        <p className="text-[11px] leading-6 text-muted">
          MOON فقط قابلیت باز می‌کند: پیش‌بینی بیشتر و ورود به چالش. هرگز امتیاز
          یا رتبه نمی‌خرد.
        </p>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-xl border px-4 py-3 text-[11.5px] leading-6 ${
            msg.ok
              ? "border-gain/40 bg-gain/5 text-gain"
              : "border-loss/40 bg-loss/5 text-loss"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {CREDIT_PACKS.map((p) => {
          const afford = balance >= p.priceUsdt;
          const busy = busyId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!afford || Boolean(busyId)}
              onClick={() => {
                haptic.press();
                buy(p.id);
              }}
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition ${
                afford
                  ? "border-line bg-surface/40 active:border-gold"
                  : "border-line bg-surface/20 opacity-45"
              }`}
            >
              <div className="flex items-center gap-2">
                <span dir="ltr" className="font-mono text-[15px] font-bold text-gold">
                  {p.credits.toLocaleString("en-US")}
                </span>
                <span className="text-[11px] text-muted">MOON</span>
                {p.badge && (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[9px] font-bold text-gold">
                    {p.badge}
                  </span>
                )}
              </div>
              <span dir="ltr" className="font-mono text-[13px] font-bold text-cream">
                {busy ? "…" : `$${p.priceUsdt}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] text-muted">
        بسته‌های خاکستری از موجودی فعلی‌ات بیشترند
      </p>
    </div>
  );
}
