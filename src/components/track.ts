"use client";

import { currentToken } from "@/components/tg/api";

// فرستنده‌ی رویدادهای رفتاری — مشترک بین سایت و مینی‌اپ.
//
// ── چرا دسته‌ای ──
// «باز کردن یک بازار» پرتکرارترین کار کاربر است. یک درخواست شبکه به‌ازای
// هر کلیک، هم باتری و دیتای کاربر ایرانی را می‌خورد و هم سقف نرخ را. پس
// رویدادها در حافظه جمع می‌شوند و هر ۱.۵ ثانیه یک‌جا می‌روند.
//
// ── چرا روی مخفی‌شدن صفحه هم فلاش می‌شود ──
// کاربری که بازار را باز می‌کند و بلافاصله اپ را می‌بندد، دقیقا همان
// «رها کردن» است که می‌خواهیم بشماریم. بدون فلاشِ visibilitychange، آن
// رویداد در صف می‌ماند و با بسته‌شدن صفحه از بین می‌رود — یعنی دقیقا
// داده‌ای که بیشترین معنا را دارد، همیشه گم می‌شود.
//
// ⚠️ این ماژول هرگز throw نمی‌کند و هرگز چیزی را نگه نمی‌دارد. آمار نباید
// بتواند تجربه‌ی کاربر را خراب کند.

export type TrackKind =
  | "list_view"
  | "market_open"
  | "predict"
  | "share"
  | "result_view";

export type TrackSurface = "site" | "app";
export type TrackGame = "iran" | "trade" | "pulse" | "combo";

type Pending = {
  kind: TrackKind;
  surface: TrackSurface;
  game?: TrackGame;
  marketId?: string | number;
  category?: string;
};

const FLUSH_MS = 1500;
// سقف صف: اگر شبکه قطع باشد، صف نباید بی‌نهایت رشد کند و حافظه بخورد.
const MAX_QUEUE = 60;

let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let bound = false;

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;

  const events = queue;
  queue = [];

  const token = currentToken();
  try {
    void fetch("/api/events", {
      method: "POST",
      cache: "no-store",
      // ⚠️ keepalive تا درخواستِ در حال پرواز با بسته‌شدن صفحه لغو نشود.
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-tg-auth": token } : {}),
      },
      body: JSON.stringify({ events }),
    }).catch(() => {
      /* آمار هرگز به کاربر خطا نشان نمی‌دهد */
    });
  } catch {
    /* همان */
  }
}

function bindOnce(): void {
  if (bound || typeof document === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function track(e: Pending): void {
  if (typeof window === "undefined") return;
  bindOnce();
  if (queue.length >= MAX_QUEUE) return;
  queue.push(e);
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}
