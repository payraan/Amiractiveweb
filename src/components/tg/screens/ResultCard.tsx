"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/tg/ui";
import { shareText } from "@/components/tg/share";
import { haptic } from "@/components/tg/telegram";
import { useResource } from "@/components/tg/useResource";
import { track } from "@/components/track";

// رسید یک پیش‌بینیِ تسویه‌شده.
//
// ── چرا این کامپوننت وجود دارد ──
// اعلان نتیجه در تلگرام یک دکمه‌ی «مشاهده‌ی بازار» دارد که لینک عمیقش به
// همان بازار اشاره می‌کند. ولی بازارِ تسویه‌شده دیگر در فهرست بازارهای باز
// نیست، پس `list.find(...)` هیچ چیزی پیدا نمی‌کرد و کاربر بی‌صدا در فهرست
// کلی رها می‌شد — دقیقا در لحظه‌ای که بیشترین انگیزه را دارد، چون تازه
// فهمیده درست گفته.
//
// ── قاعده‌ی متنِ اشتراک ──
// متنی که کاربر بیرون می‌فرستد **مهارت** را نشان می‌دهد، نه پول. حتی در
// بازار تتری، مبلغ سود در متن اشتراک نمی‌آید: «از پیش‌بینی پول دربیار» جزو
// خط قرمزهای برند است و یک اسکرین‌شات از سود، دقیقا همان پیام را می‌دهد.
// آنچه پز دادنی است این است که کاربر چیزی را دید که اکثریت ندیده بودند.
//
// ⚠️ واژگان ممنوع همین‌جا هم برقرار است: «باخت» و «بازنده» و «شرط‌بندی»
// نداریم. نتیجه‌ی منفی «این‌بار درست درنیامد» است.

export type PredictionResult =
  | {
      kind: "trade";
      question: string;
      side: "yes" | "no";
      won: boolean;
      points: number;
      /** احتمال قفل‌شده در لحظه‌ی ثبت، درصد. */
      probPct: number;
    }
  | {
      kind: "market";
      question: string;
      side: "yes" | "no";
      outcome: "won" | "lost" | "refunded";
      stake: number;
      payout: number | null;
      voidReason?: string | null;
    };

const fa = (n: number) => n.toLocaleString("fa-IR");
const signed = (n: number) => (n > 0 ? `+${fa(n)}` : fa(n));
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sideLabel = (s: "yes" | "no") => (s === "yes" ? "بله" : "خیر");

/**
 * جمله‌ای که مهارت را می‌گوید.
 *
 * فقط وقتی گفته می‌شود که گزینه‌ی درست، گزینه‌ی کم‌طرفدار بوده باشد — همان
 * حالتی که واقعا چیزی را نشان می‌دهد. برای گزینه‌ی ۸۰ درصدی، «وقتی ۸۰٪
 * همین را می‌گفتند» پز نیست، اعتراف است.
 */
function edgeLine(probPct: number, won: boolean): string | null {
  if (!won || probPct >= 45) return null;
  return `وقتی فقط ${fa(Math.round(probPct))}٪ این را می‌گفتند`;
}

export default function ResultCard({
  result,
  botUsername,
  onBack,
  onNext,
}: {
  result: PredictionResult;
  botUsername: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [sharing, setSharing] = useState(false);

  // دیده‌شدن رسید = کاربر روی دکمه‌ی اعلانِ نتیجه کلیک کرده. نسبت این عدد
  // به تعداد اعلان‌های فرستاده‌شده می‌گوید اعلان چقدر کار می‌کند.
  const gameKind = result.kind === "trade" ? "trade" : "iran";
  useEffect(() => {
    track({ kind: "result_view", surface: "app", game: gameKind });
  }, [gameKind]);

  // کد رفرال فقط برای ساختن لینک اشتراک لازم است. اگر نیامد، دکمه بی‌اثر
  // نمی‌شود — به لینک ساده‌ی مینی‌اپ عقب‌نشینی می‌کند. لینکِ نداشتنِ کد
  // بهتر از دکمه‌ی مرده است.
  const ref = useResource<{ stats?: { code: string } | null }>(
    "/api/predict/referral"
  );
  const code = ref.data?.stats?.code ?? null;

  const won = result.kind === "trade" ? result.won : result.outcome === "won";
  const refunded = result.kind === "market" && result.outcome === "refunded";

  const head = refunded
    ? "↩️ بازار باطل شد"
    : won
      ? "🎯 درست پیش‌بینی کردی"
      : "📉 این‌بار درست درنیامد";

  const headCls = refunded ? "text-muted" : won ? "text-gain" : "text-loss";

  const edge =
    result.kind === "trade" ? edgeLine(result.probPct, result.won) : null;

  // ⚠️ لینک اشتراک، لینک **رفرال خود کاربر** است. کسی که نتیجه را فوروارد
  // می‌کند باید از آمدنِ نفر بعدی سهم ببرد، وگرنه فوروارد کردن فقط لطف است
  // و لطف مقیاس نمی‌گیرد. گیرنده هم به فهرست بازارهای **باز** می‌رسد، نه به
  // همین بازارِ تمام‌شده — رساندنش به بازار مرده یعنی همان‌جا مردنِ حلقه.
  const link =
    botUsername && code
      ? `https://t.me/${botUsername}/market?startapp=ref_${code}`
      : botUsername
        ? `https://t.me/${botUsername}/market`
        : "";

  const shareBody = (() => {
    const lines = [
      "🎯 پیش‌بینی‌ام درست درآمد.",
      "",
      `«${result.question}»`,
      "",
      edge
        ? `گفتم: ${sideLabel(result.side)} — ${edge}.`
        : `گفتم: ${sideLabel(result.side)} ✅`,
    ];
    if (result.kind === "trade") {
      lines.push(`${signed(Math.round(result.points))} امتیاز`);
    }
    lines.push("", "تو چه فکر می‌کنی؟ بازار بعدی همین‌جاست 👇");
    return lines.join("\n");
  })();

  async function onShare() {
    if (!link) return;
    haptic.press();
    // ⚠️ پیش از باز شدن انتخابگر مخاطب ثبت می‌شود، نه بعدش: تلگرام هیچ
    // بازخوردی نمی‌دهد که کاربر واقعا فرستاد یا لغو کرد. پس این عدد یعنی
    // «قصدِ فرستادن»، و در تحلیل هم باید همین‌طور خوانده شود.
    track({ kind: "share", surface: "app", game: gameKind });
    setSharing(true);
    try {
      await shareText(shareBody, link);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackLink label="برگشت" onClick={onBack} />

      <div className="rounded-2xl border border-line bg-surface/40 p-4">
        <div className={`font-display text-base font-extrabold ${headCls}`}>
          {head}
        </div>

        <div className="mt-3 text-[13.5px] leading-6 text-cream">
          {result.question}
        </div>

        <div className="mt-4 flex flex-col gap-1.5 text-[12.5px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">گزینه‌ی تو</span>
            <span className="font-bold text-cream">
              {sideLabel(result.side)} {won && !refunded ? "✅" : ""}
            </span>
          </div>

          {result.kind === "trade" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted">احتمال در لحظه‌ی ثبت</span>
                <span className="text-cream">
                  {fa(Math.round(result.probPct))}٪
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-muted">امتیاز این پیش‌بینی</span>
                <span
                  className={`font-display text-base font-extrabold ${
                    result.points >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {signed(Math.round(result.points))}
                </span>
              </div>
            </>
          )}

          {result.kind === "market" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted">مبلغ پیش‌بینی</span>
                <span className="text-cream">${money(result.stake)}</span>
              </div>
              {result.payout !== null && (
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-muted">
                    {refunded ? "برگشتی" : "دریافتی"}
                  </span>
                  <span
                    className={`font-display text-base font-extrabold ${
                      won ? "text-gain" : "text-cream"
                    }`}
                  >
                    ${money(result.payout)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {edge && (
          <div className="mt-3 rounded-xl border border-gain/30 bg-gain/10 p-2.5 text-[12px] leading-5 text-gain">
            چیزی را دیدی که اکثریت ندیده بودند — {edge}.
          </div>
        )}

        {refunded && result.kind === "market" && (
          <div className="mt-3 text-[11.5px] leading-5 text-muted">
            {result.voidReason === "low_odds"
              ? "چون تقریبا همه یک طرف را انتخاب کرده بودند، ضریب به زیر حداقل رسید و بازار باطل شد. کارمزدی هم برداشته نشد."
              : result.voidReason === "no_winners"
                ? "هیچ‌کس روی گزینه‌ی درست پیش‌بینی نکرده بود، پس مبلغ‌ها برگردانده شد."
                : "مبلغ پیش‌بینی‌ات کامل برگشت."}
          </div>
        )}
      </div>

      {/* اشتراک فقط روی پیش‌بینی درست. فرستادنِ یک پیش‌بینیِ نادرست کار رشد
          نیست و پیشنهاد دادنش هم حس خوبی ندارد. */}
      <div className="flex gap-2">
        {won && !refunded && link && (
          <button
            type="button"
            onClick={onShare}
            disabled={sharing}
            className="flex-1 rounded-xl bg-gold px-4 py-3 font-display text-sm font-extrabold text-ink transition active:scale-[0.98] disabled:opacity-40"
          >
            📤 بفرست
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            onNext();
          }}
          className={`rounded-xl border border-line bg-surface/40 px-4 py-3 font-display text-sm font-extrabold text-cream transition active:bg-surface/70 ${
            won && !refunded && link ? "" : "flex-1"
          }`}
        >
          🔥 بازار بعدی
        </button>
      </div>
    </div>
  );
}
