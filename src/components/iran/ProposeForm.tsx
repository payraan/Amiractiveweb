"use client";

import { useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";

const CATS = [
  { id: "economy", label: "اقتصاد" },
  { id: "sports", label: "ورزش" },
  { id: "crypto", label: "کریپتو" },
  { id: "social", label: "اجتماعی" },
  { id: "other", label: "سایر" },
];

const ERR: Record<string, string> = {
  not_authed: "برای پیشنهاد بازار وارد شوید.",
  bad_question: "سؤال باید بین ۱۵ تا ۲۰۰ کاراکتر باشد.",
  source_required: "منبع تسویه اجباری است و باید دقیق باشد.",
  bad_date: "تاریخ بسته‌شدن باید در آینده باشد.",
  too_many_pending: "بیش از ۳ پیشنهاد در انتظار تأیید دارید.",
  insufficient_credits: "کردیت کافی ندارید.",
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
        text: `پیشنهاد ثبت شد و در صف بررسی است. ${j.cost} کردیت کسر شد.`,
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

  const ok =
    question.trim().length >= 15 &&
    sourceNote.trim().length >= 10 &&
    closesAt.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <h2 className="font-display text-sm font-extrabold text-gold">
          قبل از پیشنهاد بخوانید
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[12px] leading-7 text-muted">
          <li>
            — سؤال باید <b className="text-cream">دقیق و دوحالته</b> باشد.
            «آیا اوضاع بهتر می‌شود؟» بازار نیست؛ «آیا دلار تا ۳۰ آذر بالای X
            بسته می‌شود؟» بازار است.
          </li>
          <li>
            — <b className="text-cream">منبع تسویه اجباری است.</b> باید بگویید
            نتیجه از کجا خوانده می‌شود: یک سایت مشخص، یک عدد مشخص، یک ساعت مشخص.
          </li>
          <li>
            — هر پیشنهاد <b className="text-cream">۱۰۰ کردیت</b> هزینه دارد و پس
            از بررسی انسانی منتشر می‌شود. این هزینه برای جلوگیری از اسپم است.
          </li>
          <li>
            — بازارهای مبهم، یا موضوعاتی که نتیجه‌شان قابل اثبات عمومی نیست، رد
            می‌شوند.
          </li>
        </ul>
      </div>

      {!player ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface/40 p-8 text-center">
          <p className="text-sm text-muted">برای پیشنهاد بازار باید وارد شوید.</p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink"
          >
            ورود / ثبت‌نام
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface/40 p-5">
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
            منبع تسویه — نتیجه از کجا خوانده می‌شود؟
          </label>
          <textarea
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            rows={2}
            placeholder="مثال: قیمت پایانی دلار آزاد در سایت TGJU، ساعت ۱۸ روز ۳۰ آذر"
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
            زمان بسته‌شدن بازار
          </label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            dir="ltr"
            className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-2.5 font-mono text-sm text-cream focus:border-gold focus:outline-none"
          />

          <button
            type="button"
            disabled={busy || !ok}
            onClick={submit}
            className="mt-5 w-full rounded-xl bg-gold py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-40"
          >
            {busy ? "…" : "ثبت پیشنهاد (۱۰۰ کردیت)"}
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
