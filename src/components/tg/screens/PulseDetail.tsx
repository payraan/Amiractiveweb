"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { haptic, hasMainButton, showBackButton } from "@/components/tg/telegram";
import { useMainButton } from "@/components/tg/useMainButton";
import { AssetBadge, type Me } from "@/components/tg/screens/PulseScreen";
// همان نمودار سایت — نه یک نسخه‌ی دوم. lightweight-charts از قبل در باندل
// هست، پس هزینه‌ی اضافه‌ای ندارد و رفتار هر دو سطح یکی می‌ماند.
import LiveChart from "@/components/predict/LiveChart";
import {
  TIMEFRAMES,
  tf,
  scoreFor,
  volScaleFor,
  isAssetOpen,
  nextClose,
  settleFor,
  type TimeframeId,
} from "@/lib/game";

// یک دارایی و ثبت حدس قیمت — روی همان /api/predict/submit سایت.
//
// جدول امتیاز پیش از ثبت نشان داده می‌شود، دقیقا مثل ترید: کاربر باید قبل از
// خرج‌کردن ببیند چه خطایی چه امتیازی می‌گیرد، وگرنه امتیازدهیِ صفر-انتظار
// برایش جادوی نامفهوم است.

export type PulseMarket = {
  asset: string;
  label: string;
  category: string;
  decimals: number;
  price: number | null;
  changePct: number | null;
  dailyVolPct: number | null;
};

const ERR: Record<string, string> = {
  not_authed: "ابتدا وارد شو.",
  bad_asset: "این دارایی معتبر نیست.",
  bad_timeframe: "تایم‌فریم معتبر نیست.",
  bad_guess: "عدد حدس معتبر نیست.",
  // کد واقعی سرور already_predicted است، نه already — با تست زنده تأیید شد.
  already_predicted: "برای این دارایی و تایم‌فریم قبلا پیش‌بینی ثبت کرده‌ای.",
  insufficient_credits: "MOON کافی نداری. از کیف پول MOON بخر.",
  market_closed: "بازار این دارایی الان بسته است.",
  no_price: "قیمت این دارایی در دسترس نیست.",
};

function fa(d: Date): string {
  return d.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PulseDetail({
  market,
  me,
  onBack,
  onDone,
}: {
  market: PulseMarket;
  me: Me | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [tfId, setTfId] = useState<TimeframeId>("24h");
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nativeButton] = useState(hasMainButton);

  useEffect(() => showBackButton(onBack), [onBack]);

  const t = tf(tfId)!;
  const volScale = volScaleFor(market.dailyVolPct);
  const open = isAssetOpen(market.asset);
  const already = (me?.predicted ?? []).some(
    (p) => p.asset === market.asset && p.timeframe === tfId
  );

  const closeAt = useMemo(() => nextClose(t.hours), [t.hours]);
  const settleAt = useMemo(() => settleFor(closeAt, t.hours), [closeAt, t.hours]);

  // سهمیه‌ی رایگان به تفکیک تایم‌فریم می‌آید؛ فقط ۲۴ ساعته سهمیه دارد.
  const free = (me?.freeRemaining?.[tfId] ?? 0) > 0;
  const cost = free ? 0 : t.cost;

  const n = Number(guess);
  const valid = Number.isFinite(n) && n > 0 && !already && open && !busy;

  const submit = useCallback(async () => {
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/predict/submit", {
        method: "POST",
        body: JSON.stringify({ asset: market.asset, timeframe: tfId, guess: n }),
      });
      haptic.success();
      onDone();
      onBack();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg(ERR[code] ?? "ثبت پیش‌بینی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [valid, market.asset, tfId, n, onDone, onBack]);

  useMainButton({
    visible: nativeButton && !already && open,
    text: busy
      ? "در حال ثبت…"
      : valid
        ? `ثبت پیش‌بینی${cost > 0 ? ` — ${cost} MOON` : " — رایگان"}`
        : "قیمت حدسی را وارد کن",
    enabled: valid,
    busy,
    onClick: submit,
  });

  // نمونه‌ی امتیاز: چند خطای واقعی و امتیازی که می‌گیرند.
  const samples = [0, 0.1, 0.3, 0.8, 2, 5].map((e) => ({
    err: e,
    pts: scoreFor(e, tfId, volScale),
  }));

  return (
    <div>
      <div className="flex items-center gap-3">
        <AssetBadge id={market.asset} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-black text-cream">
            {market.label}
          </h2>
          <span className="font-mono text-[10px] text-muted" dir="ltr">
            {market.asset} / USD
          </span>
        </div>
        <div className="ms-auto text-end">
          <div className="font-mono text-[15px] font-bold text-cream" dir="ltr">
            {market.price == null
              ? "—"
              : market.price.toLocaleString("en-US", {
                  maximumFractionDigits: market.decimals,
                })}
          </div>
          <div
            className={`font-mono text-[10px] ${(market.changePct ?? 0) >= 0 ? "text-gain" : "text-loss"}`}
            dir="ltr"
          >
            {market.changePct == null
              ? ""
              : `${(market.changePct ?? 0) >= 0 ? "+" : ""}${market.changePct.toFixed(2)}%`}
          </div>
        </div>
      </div>

      {!open && (
        <p className="mt-4 rounded-xl border border-loss/30 bg-loss/5 px-4 py-3 text-[11px] leading-6 text-muted">
          بازار این دارایی الان بسته است؛ راند تازه با بازگشایی بازار فعال می‌شود.
        </p>
      )}

      {/* key اجباری است — بدون آن نمودار بین دارایی‌ها بازاستفاده می‌شود. */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink/30 px-2 py-2">
        <LiveChart key={`${market.asset}-${tfId}`} asset={market.asset} interval={tfId} />
        <div
          className="flex justify-between px-1 font-mono text-[9px] text-muted"
          dir="ltr"
        >
          <span>{tfId} candles</span>
          <span>
            vol{" "}
            {market.dailyVolPct == null ? "—" : `${market.dailyVolPct.toFixed(2)}%`} ·
            scale ×{volScale}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {TIMEFRAMES.map((x) => {
          const on = x.id === tfId;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setTfId(x.id);
              }}
              className={`flex-1 rounded-xl border px-2 py-2 text-[11px] transition ${
                on
                  ? "border-gold/60 bg-gold/10 font-bold text-gold"
                  : "border-line text-muted"
              }`}
            >
              {x.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface/40 p-4">
        <label className="block text-[11px] text-muted">
          قیمت حدسی در پایان راند (دلار)
        </label>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          dir="ltr"
          placeholder={market.price == null ? "0" : String(market.price)}
          className="mt-2 w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-center font-mono text-lg text-cream outline-none focus:border-gold/50"
        />
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-muted">
            هزینه:{" "}
            <b className={cost > 0 ? "text-gold" : "text-gain"}>
              {cost > 0 ? `${cost} MOON` : "رایگان"}
            </b>
          </span>
          <span className="text-muted">
            موجودی: <b className="text-cream">{me?.player.credits ?? 0}</b>
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface/30 p-4">
        <p className="text-[11px] font-bold text-cream">
          امتیاز بر اساس دقت{" "}
          <span className="font-mono text-muted" dir="ltr">
            (×{volScale})
          </span>
        </p>
        <div className="mt-2 space-y-1">
          {samples.map((s) => (
            <div
              key={s.err}
              className="flex items-center justify-between font-mono text-[10px]"
              dir="ltr"
            >
              <span className="text-muted">خطا {s.err}%</span>
              <span className={s.pts >= 0 ? "text-gain" : "text-loss"}>
                {s.pts > 0 ? "+" : ""}
                {s.pts}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-6 text-muted">
          آستانه‌ها با نوسان واقعی همین دارایی مقیاس شده‌اند. حدس تصادفی
          به‌طور میانگین امتیاز منفی می‌گیرد.
        </p>
      </div>

      <div className="mt-3 space-y-1 text-[10px] text-muted">
        <div>بسته‌شدن راند: {fa(closeAt)}</div>
        <div>تسویه: {fa(settleAt)}</div>
      </div>

      {already && (
        <p className="mt-3 rounded-xl border border-gain/30 bg-gain/5 px-4 py-3 text-[11px] text-gain">
          برای این دارایی و تایم‌فریم پیش‌بینی ثبت کرده‌ای.
        </p>
      )}

      {msg && (
        <p className="mt-3 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11px] text-loss">
          {msg}
        </p>
      )}

      {!nativeButton && !already && open && (
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="mt-4 w-full rounded-2xl bg-gold py-3.5 text-[13px] font-bold text-ink disabled:opacity-40"
        >
          {busy
            ? "در حال ثبت…"
            : `ثبت پیش‌بینی${cost > 0 ? ` — ${cost} MOON` : " — رایگان"}`}
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full rounded-2xl border border-line py-3 text-[12px] text-muted"
      >
        برگشت به فهرست
      </button>
    </div>
  );
}
