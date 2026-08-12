"use client";

import { useEffect, useState } from "react";
import type { MarketData } from "@/lib/market";
import type { Player, PredictedKey } from "@/components/predict/usePlayer";
import { TIMEFRAMES, volScaleFor, isAssetOpen, tf, nextClose, settleFor } from "@/lib/game";
import LiveChart from "@/components/predict/LiveChart";

// نشان هر دارایی — تیکر خودش، با رنگی که از شناسه‌اش ساخته می‌شود.
//
// قبلا اینجا یک آیکون به‌ازای هر «دسته» بود، پس هر ۲۰ رمزارز نشان یکسانی
// می‌گرفتند و کاربر آن را لوگوی بیت‌کوین می‌دید. لوگوی واقعی هر کوین یعنی
// درخواست به CDN بیرونی که هم برای بازدیدکننده‌ی ایرانی بسته است و هم اصل
// «هیچ چیزی مستقیم از upstream گرفته نمی‌شود» را می‌شکند. تیکرِ رنگی هم
// یکتاست، هم آفلاین، هم بدون وزن اضافه.
function assetHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function AssetBadge({ id }: { id: string }) {
  const hue = assetHue(id);
  // تیکرهای بلند (مثل EURUSD) به سه حرف کوتاه می‌شوند تا در نشان جا شوند.
  const short = id.replace(/[^A-Za-z0-9]/g, "").slice(0, 4);
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-mono text-[10px] font-bold tracking-tight"
      style={{
        borderColor: `hsl(${hue} 70% 55% / 0.45)`,
        background: `hsl(${hue} 70% 50% / 0.12)`,
        color: `hsl(${hue} 80% 72%)`,
      }}
      dir="ltr"
      aria-hidden
    >
      {short}
    </span>
  );
}

function fmt(n: number | null, decimals: number): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}


/** زمان به وقت تهران، مثل «۵ مرداد ۲۱:۰۰» */
function fmtTehran(d: Date): string {
  return d.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** فاصله‌ی باقی‌مانده تا یک زمان، به فارسی */
function remaining(to: Date, now: Date): string {
  const ms = to.getTime() - now.getTime();
  if (ms <= 0) return "به‌زودی";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d} روز و ${h % 24} ساعت`;
  }
  if (h > 0) return `${h} ساعت و ${m} دقیقه`;
  return `${m} دقیقه`;
}

export default function AssetCard({
  data,
  player,
  predicted,
  freeRemaining,
  onPredicted,
}: {
  data: MarketData;
  player: Player | null;
  predicted: PredictedKey[];
  freeRemaining: Record<string, number>;
  onPredicted: () => void;
}) {
  const [tfId, setTfId] = useState<string>("24h");
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // زمان‌های راند فقط سمت مرورگر محاسبه می‌شوند تا هیدریشن نشکند
  // (سرور و مرورگر منطقه‌ی زمانی یکسانی ندارند).
  const [timing, setTiming] = useState<{
    closeLabel: string;
    settleLabel: string;
    leftLabel: string;
  } | null>(null);

  useEffect(() => {
    const t = tf(tfId);
    if (!t) return;
    const tick = () => {
      const now = new Date();
      const closeAt = nextClose(t.hours, now);
      const settleAt = settleFor(closeAt, t.hours);
      setTiming({
        closeLabel: fmtTehran(closeAt),
        settleLabel: fmtTehran(settleAt),
        leftLabel: remaining(closeAt, now),
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tfId]);

  const asset = data.asset;
  const marketOpen = isAssetOpen(asset);
  const volScale = volScaleFor(data.dailyVolPct);
  const isPredicted = predicted.some(
    (p) => p.asset === asset && p.timeframe === tfId
  );
  const up = (data.changePct ?? 0) >= 0;

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/predict/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, timeframe: tfId, guess: Number(guess) }),
      });
      const j = await res.json();
      if (!j.ok) {
        const map: Record<string, string> = {
          not_authed: "برای ثبت پیش‌بینی وارد شوید.",
          already_predicted: "برای این تایم‌فریم قبلاً پیش‌بینی ثبت کرده‌اید.",
          insufficient_credits: "MOON کافی ندارید.",
          daily_limit: "سقف مجاز امروز این تایم‌فریم پر شده است.",
          market_closed: "بازار این دارایی الان بسته است.",
          bad_guess: "قیمت واردشده معتبر نیست.",
          bad_asset: "این دارایی معتبر نیست.",
          bad_timeframe: "تایم‌فریم انتخابی معتبر نیست.",
          round_closed: "مهلت این راند تمام شده است.",
          no_round: "راند فعالی برای این دارایی وجود ندارد.",
        };
        setMsg({ text: map[j.error] ?? "خطایی رخ داد.", ok: false });
        return;
      }
      setGuess("");
      setMsg({ text: "پیش‌بینی ثبت شد ✓", ok: true });
      onPredicted();
    } catch {
      setMsg({ text: "ارتباط با سرور برقرار نشد.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    // min-w-0 حیاتی است: آیتم گرید به‌طور پیش‌فرض min-width:auto دارد و زیر
    // عرض محتوایش کوچک نمی‌شود، پس کارت روی موبایل از صفحه بیرون می‌زد.
    <div className="min-w-0 rounded-2xl border border-line bg-surface/50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AssetBadge id={asset} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-extrabold">
              {data.label}
            </h2>
            <span
              className="block truncate font-mono text-[11px] tracking-widest text-muted"
              dir="ltr"
            >
              {asset} / USD
            </span>
          </div>
        </div>

        <div className="shrink-0 text-end">
          <span
            className="flex items-center justify-end gap-2 font-mono text-xl font-bold text-cream sm:text-2xl md:text-3xl"
            dir="ltr"
          >
            {marketOpen && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
              </span>
            )}
            {fmt(data.price, data.decimals)}
          </span>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 font-mono text-xs ${
              up ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
            }`}
            dir="ltr"
          >
            {data.changePct == null
              ? "—"
              : `${up ? "+" : ""}${data.changePct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-ink/30 px-3 py-2">
        {/* key اجباری است: بدون آن، تعویض دارایی همان نمونه‌ی نمودار را
            نگه می‌داشت و اگر یک بار در وضعیت خالی می‌نشست، دارایی بعدی هم
            خالی می‌ماند. با key، هر دارایی نمودار تازه‌ی خودش را می‌گیرد. */}
        <LiveChart key={`${asset}-${tfId}`} asset={asset} interval={tfId} />
        <div className="flex justify-between font-mono text-[9px] text-muted" dir="ltr">
          <span>{tfId} candles</span>
          <span>
            vol {data.dailyVolPct == null ? "—" : `${data.dailyVolPct.toFixed(2)}%`} ·
            scale ×{volScale}
          </span>
        </div>
      </div>

      {!marketOpen && (
        <p className="mt-4 rounded-xl border border-loss/30 bg-loss/5 px-4 py-3 text-[11px] text-muted">
          بازار این دارایی در حال حاضر بسته است؛ راند جدید با بازگشایی بازار
          فعال می‌شود.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIMEFRAMES.map((t) => {
          const active = t.id === tfId;
          const left = freeRemaining[t.id] ?? 0;
          const paid = left <= 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTfId(t.id)}
              className={`no-zoom flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition ${
                active
                  ? "border-gold/60 bg-gold/10 text-gold shadow-[0_0_18px_rgba(232,196,106,0.18)]"
                  : "border-line text-muted hover:border-gold/30 hover:text-cream"
              }`}
            >
              {t.label}
              <span
                className={`font-mono text-[10px] ${paid ? "" : "text-gain"}`}
                dir="ltr"
              >
                {paid ? `${t.cost} MOON` : "رایگان"}
              </span>
            </button>
          );
        })}
      </div>

      {/* زمان‌بندی راند این تایم‌فریم — همه به وقت تهران */}
      {timing && (
        <div className="mt-3 rounded-xl border border-line bg-ink/30 px-4 py-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">مهلت ثبت پیش‌بینی</span>
            <span className="text-cream">
              {timing.closeLabel}
              <span className="ms-2 text-gold">({timing.leftLabel} مانده)</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-muted">زمان تسویه</span>
            <span className="text-cream">{timing.settleLabel}</span>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-muted">
            قیمتی که حدس می‌زنید، قیمت این دارایی در «زمان تسویه» است.
          </p>
        </div>
      )}

      {player ? (
        isPredicted ? (
          <p className="mt-5 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-xs text-muted">
            پیش‌بینی این تایم‌فریم ثبت شده؛ منتظر تسویه بمانید.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              inputMode="decimal"
              placeholder={`قیمت پیش‌بینی‌شده (${data.label})`}
              className="no-zoom rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm outline-none transition focus:border-gold/60"
              dir="ltr"
            />
            <button
              type="button"
              disabled={busy || !guess || !marketOpen}
              onClick={submit}
              className="no-zoom rounded-xl bg-gold py-3.5 font-display font-extrabold text-ink shadow-[0_8px_24px_rgba(232,196,106,0.25)] transition hover:bg-gold-deep hover:shadow-[0_8px_32px_rgba(232,196,106,0.35)] disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? "…" : "ثبت پیش‌بینی"}
            </button>
          </div>
        )
      ) : (
        <p className="mt-5 text-center text-[11px] text-muted">
          برای ثبت پیش‌بینی وارد حساب شوید.
        </p>
      )}

      {msg && (
        <p
          className={`mt-3 text-center text-[11px] ${
            msg.ok ? "text-gain" : "text-loss"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
