"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

// پوسته‌ی مینی‌اپ تلگرام.
//
// این مرحله عمدا کوچک است: تنها هدفش اثبات این است که حلقه‌ی احراز هویت
// داخل خود تلگرام بسته می‌شود. اگر اول کل رابط ساخته می‌شد و بعد معلوم
// می‌شد مثلا هدر x-tg-auth در WebView تلگرام مشکل دارد، همه‌اش باید دوباره
// چیده می‌شد.
//
// نکته‌ی مهم: توکن فقط در حافظه نگه داشته می‌شود، نه localStorage. داخل
// مینی‌اپ همیشه initData در دسترس است، پس با هر بار باز شدن دوباره ورود
// می‌کنیم — ذخیره‌ی یک اعتبارنامه روی دستگاه هیچ چیزی به دست نمی‌آورد و
// فقط سطح افشا را بیشتر می‌کند.

type Player = {
  id: number;
  displayName: string;
  handle: string | null;
  credits: number;
  usdtBalance: number;
  totalPoints: number;
};

type TgWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "ربات روی سرور پیکربندی نشده است.",
  malformed: "داده‌ی ورود تلگرام ناقص است. اپ را ببند و دوباره باز کن.",
  bad_hash: "امضای تلگرام معتبر نیست. اپ را ببند و دوباره باز کن.",
  expired: "نشست تلگرام کهنه شده. اپ را ببند و دوباره باز کن.",
  no_user: "اطلاعات کاربر از تلگرام نرسید.",
  server_error: "خطای سرور. کمی بعد دوباره امتحان کن.",
};

export default function MiniApp() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [created, setCreated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const [loading, setLoading] = useState(true);
  const token = useRef<string | null>(null);
  const started = useRef(false);

  const boot = useCallback(async () => {
    const wa = window.Telegram?.WebApp;
    if (!wa || !wa.initData) {
      setOutside(true);
      setLoading(false);
      return;
    }
    wa.ready();
    wa.expand();
    wa.setHeaderColor?.("#0a0a0c");
    wa.setBackgroundColor?.("#0a0a0c");

    try {
      const res = await fetch("/api/tg/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: wa.initData }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(AUTH_ERRORS[j.error] ?? `خطا: ${j.error}`);
        setLoading(false);
        return;
      }
      token.current = j.token;
      setCreated(Boolean(j.created));

      const meRes = await fetch("/api/tg/me", {
        headers: { "x-tg-auth": j.token },
        cache: "no-store",
      });
      const me = await meRes.json();
      if (me.ok) {
        setPlayer(me.player);
        setErr(null);
      } else {
        setErr("نشست پذیرفته نشد. اپ را ببند و دوباره باز کن.");
      }
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  // اسکریپت تلگرام ممکن است پیش از mount شدن این کامپوننت بار شده باشد؛
  // پس هم onReady اسکریپت و هم این افکت می‌توانند شروع‌کننده باشند و
  // started جلوی ورود دوباره را می‌گیرد.
  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    boot();
  }, [boot]);

  useEffect(() => {
    if (window.Telegram?.WebApp) start();
  }, [start]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={start}
      />
      <main className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-xl font-black text-gold">نارمون</h1>

        {loading && <p className="mt-6 text-xs text-muted">در حال ورود…</p>}

        {!loading && outside && (
          <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5">
            <p className="text-sm font-bold text-gold">این صفحه داخل تلگرام باز می‌شود</p>
            <p className="mt-2 text-[11px] leading-6 text-muted">
              ورود بدون رمز فقط از طریق مینی‌اپ تلگرام ممکن است، چون هویت را خودِ
              تلگرام امضا می‌کند. ربات{" "}
              <span className="font-mono">@NarmoonMarketBot</span> را باز کن و از
              آنجا وارد شو.
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
          <div className="mt-6 rounded-2xl border border-loss/40 bg-loss/5 p-5">
            <p className="text-sm font-bold text-loss">{err}</p>
          </div>
        )}

        {player && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface/40 p-5">
              <p className="text-sm font-bold text-cream">
                {created ? "خوش آمدی" : "خوش برگشتی"}، {player.displayName}
              </p>
              {player.handle && (
                <p dir="ltr" className="mt-1 text-right font-mono text-[11px] text-muted">
                  @{player.handle}
                </p>
              )}
              {created && (
                <p className="mt-3 text-[11px] leading-6 text-gold">
                  حسابت همین حالا ساخته شد و {player.credits} MOON هدیه گرفتی.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="MOON" value={String(player.credits)} />
              <Stat label="تتر" value={player.usdtBalance.toFixed(2)} />
              <Stat label="امتیاز" value={String(player.totalPoints)} />
            </div>

            <p className="text-[11px] leading-6 text-muted">
              بازارها به‌زودی همین‌جا اضافه می‌شوند. فعلا از سایت ادامه بده.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-4 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm text-cream">{value}</div>
    </div>
  );
}
