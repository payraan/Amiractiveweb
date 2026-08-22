"use client";

import { useState, useSyncExternalStore } from "react";

// بنر «نسخه‌ی دمو» — مشترک بین سایت و مینی‌اپ.
//
// ── چرا اجباری است ──
// نسخه‌ی دمویی که کاربر ندانَد دمو است، فریب است. و مشکل فقط اخلاقی نیست:
// کسی که فکر کند موجودی‌اش واقعی است، روزی می‌خواهد برداشتش کند — و آن
// لحظه، لحظه‌ای است که اعتمادش را از دست می‌دهی، نه لحظه‌ای که راستش را
// گفته باشی.
//
// ── چرا «بعداً پول واقعی می‌آید» هم گفته می‌شود ──
// این خودش یک پیام بازاریابی است، نه اعتراف به کمبود: کاربری که الان
// می‌آید، پیش از شلوغی جای خودش را باز کرده. پنهان‌کردنش هر دو اثر را
// از بین می‌برد.
//
// ⚠️ متن از سرور می‌آید (`modeBanner()` در platform-mode.ts) و اینجا
// سخت‌کد نشده. دو متن یعنی روزی یکی عوض شود و دیگری نه.

export type DemoNotice = {
  title: string;
  body: string;
  allowance: number;
};

/** کلید فراموشیِ بستن بنر — تا بستنش با هر بار باز شدن صفحه برنگردد. */
const DISMISS_KEY = "narmoon_demo_notice_v1";

// ── خواندن وضعیتِ بسته‌بودن ──
//
// ⚠️ عمدا `useSyncExternalStore` و نه `useEffect` + `setState`. نسخه‌ی اول
// با افکت نوشته شده بود و لینت گرفتش: setState همگام داخل افکت یک رندر
// آبشاری اضافه می‌سازد. کدبیس این قاعده را فقط یک جا (`useResource`) با
// استثنای مستند خاموش کرده و اینجا لازم نیست — این ابزار دقیقا برای همین
// حالت است: خواندن منبعی بیرونی که React مالکش نیست.
//
// ⚠️ عکسِ سمت سرور `false` است، یعنی بنر در رندر سرور **دیده می‌شود** و بعد
// اگر کاربر قبلا بسته باشد جمع می‌شود. عکسش هم ممکن بود، ولی برای هشدارِ
// «این پول واقعی نیست» بهتر است لحظه‌ای اضافه دیده شود تا دیده نشود.

const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // حالت خصوصی مرورگر — بستن فقط تا رفرش بعدی می‌ماند.
    return false;
  }
}

function markDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* همان */
  }
  listeners.forEach((fn) => fn());
}

export default function DemoBanner({
  notice,
  compact = false,
}: {
  /** `null` یعنی حالت واقعی — هیچ چیزی نشان داده نمی‌شود. */
  notice: DemoNotice | null | undefined;
  /** نسخه‌ی کوتاه برای بالای مینی‌اپ، جایی که ارتفاع عمودی گران است. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);

  if (!notice) return null;

  // ── نوار همیشگی ──
  // حتی بعد از بستن، یک نشان کوچک می‌ماند. «بستن» یعنی «توضیح را خواندم»،
  // نه «فراموش کن که این پول واقعی نیست» — آن دومی همان چیزی است که
  // نباید ممکن باشد.
  if (dismissed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-gold transition active:bg-gold/20"
      >
        🎭 نسخه‌ی دمو
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gold/40 bg-gold/10 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-display text-[13px] font-extrabold text-gold">
            🎭 {notice.title}
          </div>
          <p
            className={`mt-1.5 leading-6 text-cream/90 ${
              compact ? "text-[11px]" : "text-[12px]"
            }`}
          >
            {notice.body}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            markDismissed();
            setOpen(false);
          }}
          aria-label="بستن"
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-muted transition active:text-cream"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
