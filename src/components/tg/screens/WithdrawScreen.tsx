"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { haptic, hasMainButton, showBackButton } from "@/components/tg/telegram";
import { useMainButton } from "@/components/tg/useMainButton";
import {
  MIN_WITHDRAW,
  WITHDRAW_FEE_USDT,
  floorUsdt,
  receivedAfterFee,
  withdrawAddressShapeValid,
} from "@/lib/wallet-rules";

// برداشت تتر — روی همان /api/wallet/withdraw سایت.
//
// این پرریسک‌ترین عمل پلتفرم است: تنها کاری که پول را بیرون می‌برد و
// برگشت‌ناپذیر است. سرور پس از ثبت موفق، یک اعلان تلگرام می‌فرستد تا صاحب
// حساب بلافاصله بفهمد — تنها لایه‌ی هشدار موجود.

const ERR: Record<string, string> = {
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کنید و دوباره تلاش کنید.",
  not_authed: "ابتدا وارد شوید.",
  gateway_off: "درگاه پرداخت فعال نیست.",
  amount_too_low: `کمتر از ${MIN_WITHDRAW} تتر ممکن نیست (کارمزد شبکه ${WITHDRAW_FEE_USDT} تتر است).`,
  bad_address: "آدرس مقصد معتبر نیست.",
  insufficient_funds: "موجودی کافی نیست.",
  server_error: "خطای سرور. کمی بعد دوباره امتحان کنید.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WithdrawScreen({
  balance,
  network,
  onBack,
  onDone,
}: {
  balance: number;
  network: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nativeButton = typeof window === "undefined" ? true : hasMainButton();

  useEffect(() => showBackButton(onBack), [onBack]);

  const value = Number(amount);
  const amountOk =
    Number.isFinite(value) && value >= MIN_WITHDRAW && value <= balance;
  const addressOk = withdrawAddressShapeValid(address, network);
  const valid = amountOk && addressOk && !busy;

  const submit = useCallback(async () => {
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: value, toAddress: address.trim() }),
      });
      haptic.success();
      setMsg({
        ok: true,
        text: "درخواست برداشت ثبت شد. تأییدش را در تلگرام هم می‌گیری.",
      });
      setAmount("");
      setAddress("");
      onDone();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg({ ok: false, text: ERR[code] ?? "برداشت انجام نشد." });
    } finally {
      setBusy(false);
    }
  }, [valid, value, address, onDone]);

  useMainButton({
    visible: nativeButton,
    text: busy ? "در حال ثبت…" : "ثبت درخواست برداشت",
    enabled: valid,
    busy,
    onClick: submit,
  });

  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-black text-cream">برداشت تتر</h2>
      <p className="mb-4 text-[11px] text-muted">شبکه‌ی {network}</p>

      <div className="rounded-2xl border border-line bg-surface/40 p-4 text-center">
        <div className="text-[10px] text-muted">قابل برداشت</div>
        <div dir="ltr" className="mt-1 font-mono text-2xl font-bold text-gold">
          ${money(floorUsdt(balance))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label className="text-[11px] text-muted">مبلغ (تتر)</label>
          <span className="text-[10px] text-muted">حداقل {MIN_WITHDRAW}</span>
        </div>
        <input
          inputMode="decimal"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder={String(MIN_WITHDRAW)}
          className="no-zoom mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-left font-mono text-base text-cream outline-none transition focus:border-gold/60"
        />
        {balance >= MIN_WITHDRAW && (
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setAmount(String(floorUsdt(balance)));
            }}
            className="mt-2 w-full rounded-lg border border-line bg-surface/40 py-2 text-[11px] text-muted"
          >
            کل موجودی
          </button>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-[11px] text-muted">
          آدرس مقصد ({network})
        </label>
        <input
          dir="ltr"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="T…"
          className="no-zoom mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-left font-mono text-[12px] text-cream outline-none transition focus:border-gold/60"
        />
        {address.length > 0 && !addressOk && (
          <p className="mt-1.5 text-[10px] leading-5 text-loss">
            این آدرس با شبکه‌ی {network} نمی‌خواند. آدرس تتر روی این شبکه با «T»
            شروع می‌شود و ۳۴ کاراکتر است.
          </p>
        )}
      </div>

      {value > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface/40 p-4 text-[11px] leading-6">
          <div className="flex justify-between text-muted">
            <span>کارمزد شبکه ({network})</span>
            <span dir="ltr" className="font-mono">
              {WITHDRAW_FEE_USDT.toFixed(2)}$
            </span>
          </div>
          <div className="flex justify-between font-bold text-cream">
            <span>به دست تو می‌رسد</span>
            <span dir="ltr" className="font-mono text-gold">
              ${money(receivedAfterFee(value))}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-5 text-muted">
            کارمزد شبکه است و به نارمون نمی‌رسد.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
        <p className="text-[11px] leading-6 text-gold">
          آدرس را با دقت بررسی کنید. انتقال روی بلاکچین برگشت‌ناپذیر است و آدرس
          اشتباه یعنی پول از بین رفته.
        </p>
      </div>

      {amount && !amountOk && (
        <p className="mt-3 text-[11px] text-loss">
          {value > balance
            ? "بیشتر از موجودی تو است."
            : `کمتر از ${MIN_WITHDRAW} تتر ممکن نیست — پس از کسر کارمزد ` +
              `${WITHDRAW_FEE_USDT} تتری چیزی برای فرستادن نمی‌ماند.`}
        </p>
      )}

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

      {nativeButton ? (
        <p className="mt-4 text-center text-[10px] text-muted">
          برای ثبت، دکمه‌ی پایین صفحه‌ی تلگرام را بزنید
        </p>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 font-display text-sm font-extrabold text-ink transition disabled:opacity-40"
        >
          {busy ? "در حال ثبت…" : "ثبت درخواست برداشت"}
        </button>
      )}
    </div>
  );
}
