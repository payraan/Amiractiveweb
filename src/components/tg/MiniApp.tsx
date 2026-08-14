"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { applyTheme, webApp } from "@/components/tg/telegram";
import { authenticate, type AuthedPlayer } from "@/components/tg/api";
import TabBar, { type TabId } from "@/components/tg/TabBar";
import MarketsScreen from "@/components/tg/screens/MarketsScreen";
import TradeScreen from "@/components/tg/screens/TradeScreen";
import PulseScreen from "@/components/tg/screens/PulseScreen";
import ChallengeScreen from "@/components/tg/screens/ChallengeScreen";
import WalletScreen from "@/components/tg/screens/WalletScreen";
import ProfileScreen from "@/components/tg/screens/ProfileScreen";
import { Skeleton } from "@/components/tg/ui";
import Logo from "@/components/Logo";

// پوسته‌ی مینی‌اپ.
//
// ناوبری عمدا سمت کلاینت است و هیچ تبی صفحه را عوض نمی‌کند: رفتن بین تب‌ها
// نباید رفرش و پرش سفید داشته باشد، وگرنه حس «سایت داخل قاب» می‌دهد نه اپ.
//
// هیچ روت اختصاصی مینی‌اپی وجود ندارد؛ صفحه‌ها همان API سایت را صدا می‌زنند.

/**
 * مقصد deep link از startapp.
 *
 * شکل‌ها: `market_42`، `market_42_yes`، `market_42_no`، `join_42`
 * (`join_` از دکمه‌ی «حساب ندارم» می‌آید و مقصدش همان بازار است — کاربر باید
 * ببیند سرِ چه چیزی ثبت‌نام می‌کند، نه اینکه در فهرست کلی رها شود.)
 */
function parseStartParam(
  raw: string | null
): { marketId: number; side: "yes" | "no" | null } | null {
  if (!raw) return null;
  const m = /^(?:market|join)_(\d+)(?:_(yes|no))?$/.exec(raw);
  if (!m) return null;
  return { marketId: Number(m[1]), side: (m[2] as "yes" | "no") ?? null };
}

const TAB_IDS: TabId[] = ["markets", "trade", "pulse", "challenge", "wallet", "profile"];

/**
 * تب آغازین از کوئری آدرس.
 *
 * دکمه‌های `web_app` ربات آدرس را با `?tab=` می‌فرستند (مثلا `/app?tab=trade`)
 * و تلگرام همان را عینا باز می‌کند. عمدا از `startapp` استفاده نشده: آن فقط
 * از لینک‌های `t.me` می‌آید و به یک مینی‌اپِ نام‌گذاری‌شده در BotFather وابسته
 * است، در حالی که این هیچ پیکربندی‌ای لازم ندارد.
 */
function tabFromUrl(): TabId | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("tab");
  return TAB_IDS.includes(t as TabId) ? (t as TabId) : null;
}

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "ربات روی سرور پیکربندی نشده است.",
  malformed: "داده‌ی ورود تلگرام ناقص است. اپ را ببندید و دوباره باز کنید.",
  bad_hash: "امضای تلگرام معتبر نیست. اپ را ببندید و دوباره باز کنید.",
  expired: "نشست تلگرام کهنه شده. اپ را ببندید و دوباره باز کنید.",
  no_user: "اطلاعات کاربر از تلگرام نرسید.",
  no_init_data: "این صفحه باید داخل تلگرام باز شود.",
  server_error: "خطای سرور. کمی بعد دوباره امتحان کنید.",
};

export default function MiniApp({ siteUrl }: { siteUrl: string }) {
  const [tab, setTab] = useState<TabId>("markets");
  // تپ دوباره روی همان تبِ فعال = برگشت به ریشه‌ی آن تب.
  //
  // هر تب زیرصفحه‌هایش (ساخت بازار، جزئیات بازار، جزئیات ترید) را داخل خودش
  // نگه می‌دارد، پس setTab با همان مقدار قبلی هیچ کاری نمی‌کرد و کاربر داخل
  // زیرصفحه گیر می‌افتاد و فقط دکمه‌ی back خود تلگرام نجاتش می‌داد. با بالا
  // بردن این شمارنده، تب از نو mount می‌شود و به ریشه برمی‌گردد — همان
  // رفتاری که کاربر از نوار تب هر اپ موبایلی انتظار دارد.
  const [homeNonce, setHomeNonce] = useState(0);
  const goTab = (t: TabId) => {
    if (t === tab) setHomeNonce((n) => n + 1);
    else setTab(t);
  };
  const [player, setPlayer] = useState<AuthedPlayer | null>(null);
  const [deepLink, setDeepLink] = useState<{
    marketId: number;
    side: "yes" | "no" | null;
  } | null>(null);
  const [created, setCreated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  const boot = useCallback(async () => {
    const wa = webApp();
    if (!wa || !wa.initData) {
      setOutside(true);
      setLoading(false);
      return;
    }
    applyTheme();
    try {
      const r = await authenticate();
      if (!r.ok) {
        setErr(AUTH_ERRORS[r.error] ?? `خطا: ${r.error}`);
        return;
      }
      setPlayer(r.player);
      setCreated(r.created);
      // کسی که از دکمه‌ی کانال آمده باید مستقیم داخل همان بازار بیفتد، نه
      // در فهرست کلی — وگرنه باید بین ده‌ها بازار دنبال همانی بگردد که
      // رویش کلیک کرده.
      const target = parseStartParam(r.startParam);
      if (target) {
        setDeepLink(target);
        setTab("markets");
      } else {
        // لینک بازار مقدم است: کسی که روی یک بازار مشخص کلیک کرده باید
        // همان‌جا بیفتد، نه در تبی که آدرس می‌گوید.
        const t = tabFromUrl();
        if (t) setTab(t);
      }
      setErr(null);
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  // اسکریپت تلگرام ممکن است پیش از mount شدن این کامپوننت بار شده باشد، پس
  // هم onReady و هم این افکت می‌توانند شروع‌کننده باشند؛ ref جلوی دوباره‌کاری
  // را می‌گیرد.
  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    boot();
  }, [boot]);

  useEffect(() => {
    if (webApp()) start();
  }, [start]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={start}
      />

      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
        {/* هدر چسبان: موجودی همیشه در دید است، چون در اپی که با پول کار
            می‌کند اولین چیزی است که کاربر دنبالش می‌گردد. */}
        <header className="tg-safe-top sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink/85 px-5 pb-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-auto" />
            <span className="font-display text-[15px] font-black text-cream">
              نارمون
            </span>
          </div>
          {player && (
            <div className="flex items-center gap-1.5">
              <span
                dir="ltr"
                className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 font-mono text-[10.5px] font-bold text-gold"
              >
                {player.credits.toLocaleString("en-US")} MOON
              </span>
              <span
                dir="ltr"
                className="rounded-full border border-gain/25 bg-gain/10 px-2.5 py-1 font-mono text-[10.5px] font-bold text-gain"
              >
                ${player.usdtBalance.toFixed(2)}
              </span>
            </div>
          )}
        </header>

        {/* فضای پایین برای نوار تب، وگرنه آخرین کارت زیرش پنهان می‌شود */}
        <main className="flex-1 px-5 pb-32 pt-4">
          {loading && (
            <div className="flex flex-col gap-3 pt-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          )}

          {!loading && outside && (
            <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/5 p-5">
              <p className="text-sm font-bold text-gold">
                این صفحه داخل تلگرام باز می‌شود
              </p>
              <p className="mt-2 text-[11px] leading-6 text-muted">
                ورود بدون رمز فقط از طریق مینی‌اپ ممکن است، چون هویت را خودِ
                تلگرام امضا می‌کند. ربات{" "}
                <span className="font-mono">@NarmoonMarketBot</span> را باز کنید.
              </p>
              <a
                href="/login"
                className="mt-4 inline-block rounded-xl border border-line px-5 py-2.5 text-xs font-bold text-cream transition hover:border-gold hover:text-gold"
              >
                ورود با نام کاربری و رمز
              </a>
            </div>
          )}

          {!loading && err && (
            <div className="mt-4 rounded-2xl border border-loss/40 bg-loss/5 p-5">
              <p className="text-sm font-bold text-loss">{err}</p>
            </div>
          )}

          {player && (
            <>
              {created && tab === "markets" && (
                <div className="mb-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
                  <p className="text-[12px] font-bold text-gold">
                    خوش آمدی، {player.displayName}
                  </p>
                  <p className="mt-1 text-[11px] leading-6 text-muted">
                    حساب شما ساخته شد و {player.credits} MOON هدیه گرفتی.
                  </p>
                </div>
              )}

              {tab === "markets" && (
                // deepLink فقط در اولین mount اعمال می‌شود؛ وگرنه برگشت به
                // ریشه دوباره همان بازار را باز می‌کرد.
                <MarketsScreen
                  key={`markets-${homeNonce}`}
                  siteUrl={siteUrl}
                  deepLink={homeNonce === 0 ? deepLink : null}
                />
              )}
              {tab === "trade" && <TradeScreen key={`trade-${homeNonce}`} />}
              {tab === "pulse" && <PulseScreen key={`pulse-${homeNonce}`} />}
              {tab === "challenge" && (
                <ChallengeScreen key={`challenge-${homeNonce}`} />
              )}
              {tab === "wallet" && <WalletScreen key={`wallet-${homeNonce}`} />}
              {tab === "profile" && (
                <ProfileScreen key={`profile-${homeNonce}`} siteUrl={siteUrl} />
              )}
            </>
          )}
        </main>

        {player && <TabBar active={tab} onChange={goTab} />}
      </div>
    </>
  );
}
