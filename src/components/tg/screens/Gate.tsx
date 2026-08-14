"use client";

import { useState } from "react";
import { api } from "@/components/tg/api";
import { haptic } from "@/components/tg/telegram";
import { TERMS, TOUR } from "@/lib/onboarding";
import Logo from "@/components/Logo";

// دو دروازه‌ی اولین ورود: پذیرش قوانین، سپس آموزش کوتاه.
//
// هر دو تمام‌صفحه‌اند و نوار تب زیرشان نیست — کاربری که هنوز قوانین را
// نپذیرفته نباید بتواند با یک لمس اشتباهی داخل بازارها بیفتد.
//
// ⚠️ ثبت در سرور **مسدودکننده نیست**: اگر شبکه بلرزد، کاربر پشت یک مودال گیر
// نمی‌افتد. بدترین حالتش این است که دفعه‌ی بعد دوباره ببیند — که از قفل‌شدن
// پشت صفحه‌ای که هیچ راه فراری ندارد به‌مراتب بهتر است.
async function mark(what: "terms" | "tour") {
  try {
    await api("/api/tg/onboarding", {
      method: "POST",
      body: JSON.stringify({ what }),
    });
  } catch {
    /* دفعه‌ی بعد دوباره پرسیده می‌شود */
  }
}

export function TermsGate({ onAccept }: { onAccept: () => void }) {
  const [busy, setBusy] = useState(false);

  return (
    // ⚠️ `h` است نه `min-h`. با `min-h` ظرف تا اندازه‌ی محتوا بزرگ می‌شود، پس
    // `flex-1` هیچ سقفی ندارد، فهرست هرگز داخل خودش اسکرول نمی‌کند و دکمه‌ی
    // پذیرش زیر لبه‌ی صفحه می‌افتد — یعنی دروازه‌ای که راه عبورش دیده نمی‌شود.
    <div className="flex h-[100dvh] flex-col px-6 pb-8 pt-10">
      <div className="flex items-center gap-2">
        <Logo className="h-7 w-auto" />
        <span className="font-display text-base font-black text-cream">نارمون</span>
      </div>

      <h1 className="mt-6 font-display text-xl font-black text-cream">
        پیش از شروع، این پنج بند
      </h1>
      <p className="mt-2 text-[11.5px] leading-6 text-muted">
        کوتاه است و به کارتان می‌آید. یک بار پرسیده می‌شود.
      </p>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {TERMS.map((t, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface/30 p-4">
            <div className="text-[12.5px] font-bold text-cream">{t.title}</div>
            <p className="mt-1.5 text-[11px] leading-6 text-muted">{t.body}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          haptic.press();
          setBusy(true);
          await mark("terms");
          haptic.success();
          onAccept();
        }}
        className="mt-5 w-full shrink-0 rounded-xl bg-gold py-4 font-display text-sm font-extrabold text-ink transition disabled:opacity-50"
      >
        {busy ? "…" : "خواندم و می‌پذیرم"}
      </button>
    </div>
  );
}

export function TourGate({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === TOUR.length - 1;
  const step = TOUR[i];

  const finish = async () => {
    haptic.success();
    onDone();
    // بعد از onDone صدا زده می‌شود، نه قبلش: کاربر نباید منتظر شبکه بماند
    // تا اسلاید آخر بسته شود.
    mark("tour");
  };

  return (
    <div className="flex h-[100dvh] flex-col px-6 pb-8 pt-10">
      {/* نوار پیشرفت بالا — کاربر باید از همان اسلاید اول بداند چقدر مانده،
          وگرنه نمی‌داند وارد چند مرحله شده و همان اول می‌بندد. */}
      <div className="flex shrink-0 gap-1.5">
        {TOUR.map((_, n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition ${
              n <= i ? "bg-gold" : "bg-line"
            }`}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto text-center">
        <div className="text-[56px] leading-none">{step.emoji}</div>
        <h2 className="mt-6 font-display text-xl font-black text-cream">
          {step.title}
        </h2>
        <p className="mt-3 text-[12.5px] leading-8 text-muted">{step.body}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {/* رد شدن همیشه در دسترس است. آموزشی که نشود بست، آموزش نیست. */}
        <button
          type="button"
          onClick={() => {
            haptic.press();
            finish();
          }}
          className="px-2 py-3 text-[11.5px] font-bold text-muted"
        >
          رد کردن
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.press();
            if (last) finish();
            else setI((n) => n + 1);
          }}
          className="flex-1 rounded-xl bg-gold py-4 font-display text-sm font-extrabold text-ink transition"
        >
          {last ? "شروع کنیم" : "بعدی"}
        </button>
      </div>
    </div>
  );
}
