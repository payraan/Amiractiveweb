"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChallengeDashboard, {
  type ChallengeStateView,
} from "@/components/predict/ChallengeDashboard";

// کارنامه‌ی چلنج، پایین صفحه‌ی ترید.
//
// چرا اینجا: ارزیابی چلنج فقط از پیش‌بینی‌های ترید تغذیه می‌شود، پس کاربر
// دقیقا همین‌جا باید ببیند هر ثبت چه اثری روی کارنامه‌اش گذاشت. فرستادنش به
// صفحه‌ی دیگر یعنی عملا هیچ‌وقت نگاهش نمی‌کند.
//
// اگر چلنجی در کار نباشد هیچ چیزی رندر نمی‌شود — صفحه‌ی ترید نباید برای
// کسی که چلنج ندارد شلوغ شود.

export default function ChallengeRecap() {
  const [state, setState] = useState<ChallengeStateView | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/predict/challenge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) setState(j?.state ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  return (
    <section className="mx-auto mt-8 max-w-6xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-extrabold text-cream">
          کارنامه‌ی چلنج پراپ شما
        </h2>
        <Link
          href="/challenge"
          className="text-[11px] text-gold transition hover:text-gold-deep"
        >
          صفحه‌ی چلنج ←
        </Link>
      </div>
      <ChallengeDashboard s={state} />
    </section>
  );
}
