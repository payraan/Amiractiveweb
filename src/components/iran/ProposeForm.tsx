"use client";

import { useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import { IR_CATEGORIES as CATS } from "@/lib/ir-categories";
import JalaliDateTime from "@/components/iran/JalaliDateTime";

const ERR: Record<string, string> = {
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کنید و دوباره تلاش کنید.",
  telegram_required:
    "برای هر عملیات مالی باید حساب تلگرامت را وصل کنی. از صفحه‌ی دعوت وصلش کن یا مینی‌اپ را باز کنید.",
  not_authed: "برای پیشنهاد بازار وارد شوید.",
  bad_question: "سؤال باید بین ۱۵ تا ۲۰۰ کاراکتر باشد.",
  source_required: "منبع تسویه اجباری است و باید دقیق باشد.",
  bad_date: "تاریخ بسته‌شدن باید در آینده باشد.",
  bad_category: "دسته‌بندی نامعتبر است.",
  too_many_pending: "بیش از ۳ پیشنهاد در انتظار تأیید دارید.",
  insufficient_funds: "موجودی تتر کیف پول کافی نیست.",
};

export default function ProposeForm() {
  const { player, refresh } = usePlayer();
  const [question, setQuestion] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [category, setCategory] = useState("economy");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ir/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sourceNote, category, closesAt }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ ok: false, text: ERR[j.error] ?? "خطایی رخ داد." });
        return;
      }
      setMsg({
        ok: true,
        text: `پیشنهاد ثبت شد و در صف بررسی است. ${j.cost} تتر از کیف پول کسر شد.`,
      });
      setQuestion("");
      setSourceNote("");
      setClosesAt("");
      await refresh();
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  // اعتبارسنجی زنده — کاربر باید بداند دقیقا چه چیزی کم است، نه اینکه
  // با دکمه‌ی خاکستریِ بی‌توضیح روبه‌رو شود.
  const issues: string[] = [];
  if (question.trim().length < 15) {
    issues.push(`سؤال باید حداقل ۱۵ کاراکتر باشد (الان ${question.trim().length})`);
  }
  if (sourceNote.trim().length < 10) {
    issues.push(
      `منبع تسویه باید حداقل ۱۰ کاراکتر و دقیق باشد (الان ${sourceNote.trim().length})`
    );
  }
  if (!closesAt) {
    issues.push("زمان بسته‌شدن را انتخاب کنید");
  } else if (new Date(closesAt).getTime() <= Date.now()) {
    issues.push("زمان بسته‌شدن باید در آینده باشد");
  }
  const ok = issues.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-lift rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <h2 className="font-display text-sm font-extrabold text-gold">
          قبل از پیشنهاد بخوانید
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[12px] leading-7 text-muted">
          <li>
            • سؤال باید <b className="text-cream">دقیق و دوحالته</b> باشد.
            «آیا اوضاع بهتر می‌شود؟» بازار نیست؛ «آیا دلار تا ۳۰ آذر بالای X
            بسته می‌شود؟» بازار است.
          </li>
          <li>
            • <b className="text-cream">منبع تسویه اجباری است.</b> باید بگویید
            نتیجه از کجا خوانده می‌شود: یک سایت مشخص، یک عدد مشخص، یک ساعت مشخص.
          </li>
          <li>
            • هر پیشنهاد <b className="text-cream">۱ تتر</b> از کیف پول هزینه
            دارد و پس از بررسی انسانی منتشر می‌شود. این هزینه برای جلوگیری از
            اسپم است و اگر بازار رد شود، کامل برمی‌گردد.
          </li>
          <li>
            • بازارهای مبهم، یا موضوعاتی که نتیجه‌شان قابل اثبات عمومی نیست، رد
            می‌شوند.
          </li>
        </ul>
      </div>

      {!player ? (
        <div className="no-lift mt-6 rounded-2xl border border-line bg-surface/40 p-8 text-center">
          <p className="text-sm text-muted">برای پیشنهاد بازار باید وارد شوید.</p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink"
          >
            ورود / ثبت‌نام
          </Link>
        </div>
      ) : (
        <div className="no-lift mt-6 rounded-2xl border border-line bg-surface/40 p-5">
          <label className="block text-[11px] text-muted">سؤال بازار</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="مثال: آیا نرخ دلار آزاد تا ۳۰ آذر بالای ۹۰ هزار تومان بسته می‌شود؟"
            className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm leading-7 text-cream focus:border-gold focus:outline-none"
          />
          <div className="mt-1 text-end font-mono text-[10px] text-muted" dir="ltr">
            {question.length}/200
          </div>

          <label className="mt-4 block text-[11px] text-muted">
            منبع تسویه: نتیجه از کجا خوانده می‌شود؟
          </label>
          <textarea
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            rows={2}
            placeholder="مثال: قیمت پایانی دلار آزاد در سایت tgju.org، ساعت ۱۸ روز ۳۰ آذر ۱۴۰۵"
            className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm leading-7 text-cream focus:border-gold focus:outline-none"
          />

          <label className="mt-4 block text-[11px] text-muted">دسته</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  category === c.id
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-line text-muted hover:text-cream"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-[11px] text-muted">
            زمان بسته‌شدن بازار (به وقت تهران)
          </label>
          <div className="mt-1.5">
            <JalaliDateTime value={closesAt} onChange={setClosesAt} />
          </div>

          {issues.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 rounded-xl border border-line bg-ink/30 px-4 py-3">
              {issues.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[11px] leading-6 text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-loss" />
                  {t}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={busy || !ok}
            onClick={submit}
            className="mt-4 w-full rounded-xl bg-gold py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-40"
          >
            {busy ? "…" : "ثبت پیشنهاد (۱ تتر)"}
          </button>

          {msg && (
            <p className={`mt-3 text-xs ${msg.ok ? "text-gain" : "text-loss"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
