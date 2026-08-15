"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { haptic, hasMainButton, showBackButton } from "@/components/tg/telegram";
import { shareText } from "@/components/tg/share";
import { useMainButton } from "@/components/tg/useMainButton";
import { floorUsdt } from "@/lib/wallet-rules";

// صفحه‌ی یک بازار و ثبت پیش‌بینی — روی همان /api/ir/bet سایت.
//
// هیچ داده‌ای دوباره از سرور گرفته نمی‌شود: همان شیئی که فهرست برگردانده
// کافی است. یک روت تازه برای «جزئیات یک بازار» یعنی یک منبع حقیقت دوم که
// می‌تواند با فهرست اختلاف پیدا کند.

export type Market = {
  id: number;
  question: string;
  category: string;
  sourceNote?: string;
  closesAt: string;
  status: string;
  yesPct: number;
  yesOdds: number;
  noOdds: number;
  yesTotal: number;
  noTotal: number;
  volume: number;
  bettors: number;
  /** تاریخ انقضای بوست، یا null — کلاینت با زمان جاری می‌سنجد. */
  boostedUntil?: string | null;
  hasCover?: boolean;
  /** بازارِ خودِ این کاربر؟ فقط سازنده می‌تواند بوست کند. */
  isMine?: boolean;
};

/** بوست فعال؟ از تاریخ انقضا، نه از یک پرچم ذخیره‌شده. */
export function isBoosted(m: Market): boolean {
  return Boolean(m.boostedUntil && new Date(m.boostedUntil).getTime() > Date.now());
}

const BOOST_ERR: Record<string, string> = {
  insufficient_funds: "موجودی تتر واقعی کافی نیست. بوست از پول هدیه کم نمی‌شود.",
  not_creator: "فقط سازنده‌ی بازار می‌تواند بوستش کند.",
  market_not_open: "بازار باز نیست.",
  telegram_required: "برای این کار باید حساب تلگرام وصل باشد.",
};

const ERR: Record<string, string> = {
  telegram_blocked:
    "ربات نارمون را در تلگرام بلاک کرده‌اید. اعلان‌های امنیتی حساب از همان ربات می‌آید، پس تا آنبلاک نکنید این عملیات انجام نمی‌شود. برداشت وجه بسته نیست.",
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کنید و دوباره تلاش کنید.",
  not_authed: "ابتدا وارد شوید.",
  stake_too_low: "مبلغ شرط از حداقل کمتر است.",
  insufficient_funds: "موجودی تتر کافی نیست.",
  market_closed: "این بازار دیگر باز نیست.",
  not_found: "بازار پیدا نشد.",
  bad_request: "درخواست معتبر نیست.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MarketDetail({
  market,
  siteUrl,
  balance,
  minStake,
  commission,
  boostPrice,
  myBet,
  initialSide,
  onBack,
  onPlaced,
}: {
  market: Market;
  siteUrl: string;
  balance: number;
  minStake: number;
  commission: number;
  /** قیمت بوست برای همین کاربر — برای ادمین صفر. */
  boostPrice: number;
  myBet?: { side: string; stake: number };
  /** طرفی که کاربر در کانال رویش کلیک کرده — از پیش انتخاب می‌شود. */
  initialSide?: "yes" | "no" | null;
  onBack: () => void;
  onPlaced: () => void;
}) {
  const [side, setSide] = useState<"yes" | "no" | null>(initialSide ?? null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [boostMsg, setBoostMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const boost = useCallback(async () => {
    if (boosting) return;
    setBoosting(true);
    setBoostMsg(null);
    try {
      const j = await api<{
        paid: number;
        broadcast?: { queued: boolean; targets?: number };
      }>("/api/ir/boost", {
        method: "POST",
        body: JSON.stringify({ marketId: market.id }),
      });
      haptic.success();
      // اگر پخش صف نشد، ساکت نمان: کاربر پول داده و باید بداند چه گرفته.
      setBoostMsg({
        ok: true,
        text: j.broadcast?.queued
          ? `بوست فعال شد و بازار برای ${j.broadcast.targets} کاربر ارسال می‌شود.`
          : "بوست فعال شد. (ارسال همگانی انجام نشد — به پشتیبانی خبر بده.)",
      });
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setBoostMsg({ ok: false, text: BOOST_ERR[code] ?? "بوست انجام نشد." });
    } finally {
      setBoosting(false);
    }
  }, [boosting, market.id]);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentToBot, setSentToBot] = useState(false);
  const nativeButton = typeof window === "undefined" ? true : hasMainButton();

  useEffect(() => showBackButton(onBack), [onBack]);

  const stake = Number(amount);
  const stakeOk = Number.isFinite(stake) && stake >= minStake && stake <= balance;
  const canBet = market.status === "open";
  const valid = canBet && side !== null && stakeOk && !busy;

  // ضریب بعد از ورود خودِ این شرط، نه ضریب فعلی.
  //
  // در استخر تجمیعی، پول خودت هم وارد استخر می‌شود و ضریب را پایین می‌آورد.
  // نمایش ضریب فعلی به‌عنوان «بازگشت تو» عددی را وعده می‌دهد که هرگز محقق
  // نمی‌شود — و در بازار کم‌حجم اختلافش بزرگ است.
  const projected = (() => {
    if (!side || !stakeOk) return null;
    const pool = market.yesTotal + market.noTotal + stake;
    const winners = (side === "yes" ? market.yesTotal : market.noTotal) + stake;
    if (winners <= 0) return null;
    const odds = (pool * (1 - commission)) / winners;
    return { odds, payout: stake * odds };
  })();

  const submit = useCallback(async () => {
    if (!valid || !side) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/ir/bet", {
        method: "POST",
        body: JSON.stringify({ marketId: market.id, side, stake }),
      });
      haptic.success();
      onPlaced();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg(ERR[code] ?? "ثبت پیش‌بینی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [valid, side, stake, market.id, onPlaced]);

  useMainButton({
    visible: nativeButton && canBet,
    text: busy
      ? "در حال ثبت…"
      : side && stakeOk
        ? `ثبت پیش‌بینی: $${money(stake)} روی ${side === "yes" ? "بله" : "خیر"}`
        : "گزینه و مبلغ را انتخاب کنید",
    enabled: valid,
    busy,
    onClick: submit,
  });

  const noPct = Math.round((100 - market.yesPct) * 10) / 10;
  const quick = [minStake, 5, 10, 25].filter((v) => v <= balance);

  return (
    <div>
      <p className="text-[15px] font-bold leading-[2] text-cream">{market.question}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        <span
          className={`rounded-full border px-2 py-0.5 font-bold ${
            market.status === "open"
              ? "border-gain/40 bg-gain/10 text-gain"
              : "border-gold/40 bg-gold/10 text-gold"
          }`}
        >
          {market.status === "open" ? "باز" : "بسته"}
        </span>
        <span>
          <span dir="ltr" className="font-mono text-cream">
            {market.bettors}
          </span>{" "}
          شرکت‌کننده
        </span>
        <span>
          حجم{" "}
          <span dir="ltr" className="font-mono text-cream">
            ${money(market.volume)}
          </span>
        </span>
      </div>

      <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-raised">
        <div
          className="flex items-center px-2.5 bg-gain/25"
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

      {market.sourceNote && (
        <div className="mt-4 rounded-xl border border-line bg-surface/30 p-3.5">
          <div className="text-[10px] font-bold text-muted">منبع تسویه</div>
          <p className="mt-1 text-[11.5px] leading-6 text-cream">{market.sourceNote}</p>
        </div>
      )}

      {myBet && (
        <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3.5">
          <div className="text-[11px] text-gold">
            پیش‌بینی فعلی شما:{" "}
            <b>{myBet.side === "yes" ? "بله" : "خیر"}</b> —{" "}
            <span dir="ltr" className="font-mono">
              ${money(myBet.stake)}
            </span>
          </div>
        </div>
      )}

      {/* دو مسیر انتشار، عمدا جدا:
          • «اشتراک‌گذاری کارت» ← ربات کارت دکمه‌دار را در چت خصوصی می‌فرستد و
            کاربر فورواردش می‌کند. ربات هیچ‌جا ادمین نمی‌شود و دکمه‌ها بعد از
            فوروارد هم کار می‌کنند (چون از نوع لینک‌اند نه callback).
          • «اشتراک‌گذاری» → لینک ساده، از طرف خودِ کاربر، برای چت شخصی. */}
      {market.status === "open" && (
        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            haptic.press();
            setSending(true);
            try {
              await api("/api/ir/poll-me", {
                method: "POST",
                body: JSON.stringify({ marketId: market.id }),
              });
              haptic.success();
              setSentToBot(true);
            } catch (e) {
              haptic.error();
              // تلگرام اجازه نمی‌دهد ربات به کسی پیام بدهد که هرگز چت را
              // شروع نکرده. کاربری که مینی‌اپ را از لینک مستقیم باز کرده
              // ممکن است هیچ‌وقت /start نزده باشد، پس این حالت واقعی است و
              // باید بگوید چه کار کند، نه فقط «انجام نشد».
              const code = e instanceof ApiError ? e.code : "";
              setMsg(
                code === "send_failed"
                  ? "اول چت ربات را باز کنید و Start را بزنید، بعد دوباره امتحان کنید."
                  : code === "telegram_required"
                    ? "برای این کار باید حساب شما به تلگرام وصل باشد."
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
      )}

      {sentToBot && (
        <p className="mt-2 rounded-xl border border-gain/30 bg-gain/5 px-4 py-3 text-[10.5px] leading-6 text-gain">
          کارت در چت ربات برای شما فرستاده شد. آن را به هر کانال یا گروهی که
          ادمین آن هستید فوروارد کنید؛ دکمه‌هایش بعد از فوروارد هم کار می‌کنند و
          ربات لازم نیست جایی ادمین شود.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          haptic.press();
          shareText(
            `${market.question}\n\nاجماع بازار: بله ${market.yesPct}٪ با ${market.bettors} شرکت‌کننده\nنظر تو چیست؟`,
            `${siteUrl}/iran/m/${market.id}`
          );
        }}
        className="mt-2.5 w-full rounded-xl border border-line bg-surface/40 py-3 text-[11.5px] font-bold text-cream transition active:border-gold"
      >
        اشتراک‌گذاری لینک
      </button>

      {!canBet ? (
        <p className="mt-4 rounded-xl border border-line bg-surface/30 p-4 text-center text-[11px] text-muted">
          این بازار برای پیش‌بینی کرده است.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["yes", "no"] as const).map((s) => {
              const on = side === s;
              const odds = s === "yes" ? market.yesOdds : market.noOdds;
              const tone = s === "yes" ? "gain" : "loss";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    haptic.press();
                    setSide(s);
                  }}
                  className={`rounded-xl border py-3.5 transition ${
                    on
                      ? tone === "gain"
                        ? "border-gain bg-gain/15"
                        : "border-loss bg-loss/15"
                      : "border-line bg-surface/40"
                  }`}
                >
                  <div
                    className={`text-sm font-black ${
                      tone === "gain" ? "text-gain" : "text-loss"
                    }`}
                  >
                    {s === "yes" ? "بله" : "خیر"}
                  </div>
                  {odds > 0 && (
                    <div dir="ltr" className="mt-0.5 font-mono text-[10px] text-muted">
                      ×{odds}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <label className="text-[11px] text-muted">مبلغ پیش‌بینی (تتر)</label>
              <span dir="ltr" className="font-mono text-[10px] text-muted">
                موجودی ${money(balance)}
              </span>
            </div>
            <input
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={String(minStake)}
              className="no-zoom mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-left font-mono text-base text-cream outline-none transition focus:border-gold/60"
            />
            <div className="mt-2 flex gap-2">
              {quick.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    haptic.tap();
                    setAmount(String(v));
                  }}
                  className="flex-1 rounded-lg border border-line bg-surface/40 py-2 font-mono text-[11px] text-muted"
                >
                  ${v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  haptic.tap();
                  setAmount(String(floorUsdt(balance)));
                }}
                className="flex-1 rounded-lg border border-line bg-surface/40 py-2 text-[11px] text-muted"
              >
                همه
              </button>
            </div>
          </div>

          {projected && (
            <div className="mt-4 rounded-xl border border-gain/25 bg-gain/5 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted">اگر ببری</span>
                <span dir="ltr" className="font-mono text-[15px] font-bold text-gain">
                  ${money(projected.payout)}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-5 text-muted">
                ضریب تخمینی{" "}
                <span dir="ltr" className="font-mono">
                  ×{projected.odds.toFixed(2)}
                </span>{" "}
                — با ثبت پیش‌بینی خودتان حساب شده. تا لحظه‌ی بسته‌شدن، هر پیش‌بینی تازه‌ای
                این عدد را جابه‌جا می‌کند.
              </p>
            </div>
          )}

          {amount && !stakeOk && (
            <p className="mt-3 text-[11px] text-loss">
              {stake > balance
                ? "بیشتر از موجودی شما است."
                : `حداقل مبلغ پیش‌بینی $${minStake} است.`}
            </p>
          )}

          {msg && (
            <p className="mt-3 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11.5px] text-loss">
              {msg}
            </p>
          )}

          {nativeButton ? (
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

          {/* بوست — فقط برای بازارِ خودِ کاربر.
              ⚠️ فقط دیده‌شدن می‌خرد: ضریب، تسویه و شانس برد دست نمی‌خورند. */}
          {market.isMine && market.status === "open" && (
            <>
              <button
                type="button"
                disabled={boosting}
                onClick={boost}
                className="mt-3 w-full rounded-xl border border-gold/40 bg-gold/10 py-3 text-[12px] font-bold text-gold disabled:opacity-40"
              >
                {boosting
                  ? "…"
                  : `${isBoosted(market) ? "⭐ تمدید بوست" : "⭐ بوست کن"}${
                      boostPrice > 0 ? ` — ${boostPrice} تتر` : " — رایگان"
                    }`}
              </button>
              <p className="mt-1.5 text-center text-[10px] leading-5 text-muted">
                بازار در پنل ویژه بالا می‌آید و یک بار برای همه‌ی کاربران ارسال
                می‌شود. ضریب و نتیجه تغییر نمی‌کند.
              </p>
              {boostMsg && (
                <p
                  className={`mt-2 rounded-xl border px-4 py-3 text-[11.5px] leading-6 ${
                    boostMsg.ok
                      ? "border-gain/40 bg-gain/5 text-gain"
                      : "border-loss/40 bg-loss/5 text-loss"
                  }`}
                >
                  {boostMsg.text}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
