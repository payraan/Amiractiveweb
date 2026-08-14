"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { winPoints, losePoints } from "@/lib/poly-scoring";
import { haptic, hasMainButton, showBackButton } from "@/components/tg/telegram";
import { useMainButton } from "@/components/tg/useMainButton";
import { displayTitle } from "@/lib/search";

// یک بازار ترید و ثبت پیش‌بینی — روی همان /api/predict/poly-submit سایت.
//
// امتیاز پیش از ثبت نشان داده می‌شود، نه بعدش. کل تز محصول همین است: روی
// گزینه‌ی محتمل، برد کم است و باخت سنگین؛ اگر کاربر این را نبیند، فکر می‌کند
// انتخاب امن همیشه بهتر است و دقیقا همان تصوری می‌ماند که این امتیازدهی
// برای شکستنش ساخته شده.

export type PolyMarket = {
  id: string;
  question: string;
  eventTitle?: string;
  /** عنوان فارسی، اگر ترجمه‌اش آماده باشد. تهی یعنی هنوز در صف است. */
  questionFa?: string | null;
  eventTitleFa?: string | null;
  endDate?: string;
  yesPct: number;
  volume: number;
  category: string;
  categoryLabel: string;
};

const ERR: Record<string, string> = {
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کنید و دوباره تلاش کنید.",
  not_authed: "ابتدا وارد شوید.",
  bad_request: "درخواست معتبر نیست.",
  market_not_found: "این بازار دیگر فعال نیست.",
  already_predicted: "قبلا روی این بازار پیش‌بینی ثبت کرده‌ای.",
  insufficient_credits: "MOON کافی نداری. سهمیه‌ی رایگان امروز تمام شده.",
};

export default function TradeDetail({
  market,
  freeLeft,
  already,
  initialSide,
  onBack,
  onDone,
}: {
  market: PolyMarket;
  freeLeft: number;
  already: boolean;
  // از دکمه‌ی «بله/خیر» کارت تلگرامی می‌آید: کسی که در کانال روی «بله» زده،
  // نباید داخل اپ دوباره همان را انتخاب کند.
  initialSide?: "yes" | "no" | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(initialSide ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentToBot, setSentToBot] = useState(false);
  const nativeButton = typeof window === "undefined" ? true : hasMainButton();

  useEffect(() => showBackButton(onBack), [onBack]);

  const valid = !already && choice !== null && !busy;

  const submit = useCallback(async () => {
    if (!valid || !choice) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/predict/poly-submit", {
        method: "POST",
        body: JSON.stringify({ marketId: market.id, choice }),
      });
      haptic.success();
      onDone();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg(ERR[code] ?? "ثبت پیش‌بینی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [valid, choice, market.id, onDone]);

  useMainButton({
    visible: nativeButton && !already,
    text: busy
      ? "در حال ثبت…"
      : choice
        ? `ثبت پیش‌بینی: ${choice === "yes" ? "بله" : "خیر"}`
        : "بله یا خیر را انتخاب کنید",
    enabled: valid,
    busy,
    onClick: submit,
  });

  const noPct = Math.round((100 - market.yesPct) * 10) / 10;
  const sides = [
    { id: "yes" as const, label: "بله", pct: market.yesPct, tone: "gain" as const },
    { id: "no" as const, label: "خیر", pct: noPct, tone: "loss" as const },
  ];

  return (
    <div>
      {market.eventTitle && (
        <div className="mb-1.5 text-[10px] text-muted">{market.eventTitle}</div>
      )}
      <p
        dir="auto"
        className="text-start text-[15px] font-bold leading-[2] text-cream"
      >
        {displayTitle(market.question, market.questionFa)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        <span className="rounded-full border border-line bg-raised px-2 py-0.5">
          {market.categoryLabel}
        </span>
        {already && (
          <span className="rounded-full border border-gain/40 bg-gain/10 px-2 py-0.5 font-bold text-gain">
            ثبت شده
          </span>
        )}
        <span className="ms-auto">
          سهمیه‌ی رایگان امروز:{" "}
          <span dir="ltr" className="font-mono text-cream">
            {freeLeft}
          </span>
        </span>
      </div>

      <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-raised">
        <div
          className="flex items-center bg-gain/25 px-2.5"
          style={{ width: `${Math.max(14, Math.min(86, market.yesPct))}%` }}
        >
          <span dir="ltr" className="font-mono text-[11px] font-bold text-gain">
            {market.yesPct}%
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end bg-loss/15 px-2.5">
          <span dir="ltr" className="font-mono text-[11px] font-bold text-loss">
            {noPct}%
          </span>
        </div>
      </div>

      {/* امتیاز هر طرف، پیش از انتخاب */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {sides.map((s) => {
          const on = choice === s.id;
          const win = winPoints(s.pct);
          const lose = losePoints(s.pct);
          return (
            <button
              key={s.id}
              type="button"
              disabled={already}
              onClick={() => {
                haptic.press();
                setChoice(s.id);
              }}
              className={`rounded-xl border p-3.5 text-center transition disabled:opacity-50 ${
                on
                  ? s.tone === "gain"
                    ? "border-gain bg-gain/15"
                    : "border-loss bg-loss/15"
                  : "border-line bg-surface/40"
              }`}
            >
              <div
                className={`text-sm font-black ${
                  s.tone === "gain" ? "text-gain" : "text-loss"
                }`}
              >
                {s.label}
              </div>
              <div dir="ltr" className="mt-1.5 font-mono text-[10px] text-muted">
                {s.pct}%
              </div>
              <div className="mt-2 flex justify-center gap-2 text-[10px]">
                <span dir="ltr" className="font-mono font-bold text-gain">
                  +{win}
                </span>
                <span className="text-muted">/</span>
                <span dir="ltr" className="font-mono font-bold text-loss">
                  {lose}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 rounded-xl border border-line bg-surface/30 p-3.5 text-[10.5px] leading-6 text-muted">
        عدد سبز امتیاز درست‌بودن است و قرمز امتیاز اشتباه‌بودن. هرچه گزینه
        محتمل‌تر باشد، برد کمتر و باخت سنگین‌تر؛ پس فقط وقتی امتیاز می‌گیری که
        بهتر از بازار فهمیده باشی، نه وقتی گزینه‌ی امن را بزنی.
      </p>

      {freeLeft <= 0 && !already && (
        <p className="mt-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-[11px] leading-6 text-gold">
          سهمیه‌ی رایگان امروزت تمام شده. این پیش‌بینی ۱ MOON هزینه دارد.
        </p>
      )}

      {msg && (
        <p className="mt-3 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11.5px] text-loss">
          {msg}
        </p>
      )}

      {already ? (
        <p className="mt-4 rounded-xl border border-line bg-surface/30 p-4 text-center text-[11px] text-muted">
          روی هر بازار فقط یک بار می‌شود پیش‌بینی ثبت کرد.
        </p>
      ) : nativeButton ? (
        <p className="mt-4 text-center text-[10px] text-muted">
          برای ثبت، دکمه‌ی پایین صفحه‌ی تلگرام را بزن
        </p>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 font-display text-sm font-extrabold text-ink transition disabled:opacity-40"
        >
          {busy ? "در حال ثبت…" : "ثبت پیش‌بینی"}
        </button>
      )}

      {/* همان مسیر بازار ایران: ربات کارت دکمه‌دار را در چت خصوصی می‌فرستد و
          کاربر فورواردش می‌کند. ربات هیچ‌جا ادمین نمی‌شود و دکمه‌ها بعد از
          فوروارد هم کار می‌کنند، چون از نوع لینک‌اند نه callback. */}
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          haptic.press();
          setSending(true);
          try {
            await api("/api/trade/poll-me", {
              method: "POST",
              body: JSON.stringify({ marketId: market.id }),
            });
            haptic.success();
            setSentToBot(true);
          } catch (e) {
            haptic.error();
            // تلگرام اجازه نمی‌دهد ربات به کسی پیام بدهد که هرگز چت را شروع
            // نکرده. کاربری که مینی‌اپ را از لینک مستقیم باز کرده ممکن است
            // هیچ‌وقت /start نزده باشد، پس این حالت واقعی است و باید بگوید
            // چه کار کند، نه فقط «انجام نشد».
            const code = e instanceof ApiError ? e.code : "";
            setMsg(
              code === "send_failed"
                ? "اول چت ربات را باز کنید و Start را بزنید، بعد دوباره امتحان کنید."
                : code === "telegram_required"
                  ? "برای این کار باید حساب شما به تلگرام وصل باشد."
                  : code === "not_found"
                    ? "این بازار دیگر در فهرست نیست."
                    : "ارسال کارت به ربات انجام نشد."
            );
          } finally {
            setSending(false);
          }
        }}
        className="mt-4 w-full rounded-xl border border-gold/40 bg-gold/10 py-3.5 text-[12px] font-bold text-gold transition active:border-gold disabled:opacity-50"
      >
        {sending
          ? "در حال ارسال…"
          : sentToBot
            ? "✓ در ربات فرستاده شد؛ آن را فوروارد کنید"
            : "📢 اشتراک‌گذاری کارت در کانال یا گروه"}
      </button>

      {sentToBot && (
        <p className="mt-2 rounded-xl border border-gain/30 bg-gain/5 px-4 py-3 text-[10.5px] leading-6 text-gain">
          کارت در چت ربات برای شما فرستاده شد. آن را به هر کانال یا گروهی که
          ادمین آن هستید فوروارد کنید؛ دکمه‌هایش بعد از فوروارد هم کار می‌کنند و
          ربات لازم نیست جایی ادمین شود.
        </p>
      )}
    </div>
  );
}
