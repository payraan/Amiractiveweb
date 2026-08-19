"use client";

import { LINKS } from "@/config/site";
import { BackLink } from "@/components/tg/ui";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/components/tg/api";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import JalaliDateTime from "@/components/iran/JalaliDateTime";
import { haptic, hasMainButton, openTelegramChat, showBackButton } from "@/components/tg/telegram";
import { useMainButton } from "@/components/tg/useMainButton";

// ساخت بازار ایران — همان قواعد و همان روت سایت (/api/ir/propose).
//
// هیچ اعتبارسنجی تازه‌ای اینجا اختراع نشده: همان حداقل‌ها و همان پیام‌های
// خطای فرم سایت. تقویم شمسی هم عینا همان کامپوننت سایت است، نه یک نسخه‌ی
// دوم — مبدل شمسی نوشته‌ی خودمان است و داشتن دو پیاده‌سازی از آن یعنی دو
// رفتار متفاوت در دو رابط.

const ERR: Record<string, string> = {
  telegram_blocked:
    "ربات نارمون را در تلگرام بلاک کرده‌اید. اعلان‌های امنیتی حساب از همان ربات می‌آید، پس تا آنبلاک نکنید این عملیات انجام نمی‌شود. برداشت وجه بسته نیست.",
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کن و دوباره تلاش کن.",
  not_authed: "برای پیشنهاد بازار وارد شوید.",
  bad_question: "سؤال باید بین ۱۵ تا ۲۰۰ کاراکتر باشد.",
  source_required: "منبع تسویه اجباری است و باید دقیق باشد.",
  bad_date: "تاریخ بسته‌شدن باید در آینده باشد.",
  bad_category: "دسته‌بندی نامعتبر است.",
  too_many_pending: "بیش از ۳ پیشنهاد در انتظار تأیید داری.",
  insufficient_funds: "موجودی تتر کیف پول کافی نیست.",
};

export default function ProposeScreen({
  onDone,
  onBack,
}: {
  onDone: () => void;
  onBack: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [category, setCategory] = useState("economy");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // لینک عمیقِ افزودن کاور — فقط پس از ساخت موفق معنا دارد.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // این صفحه فقط بعد از لمس کاربر رندر می‌شود، یعنی همیشه بعد از hydration،
  // پس خواندن مستقیم وضعیت کلاینت اینجا امن است و به state و افکت نیاز ندارد.
  const nativeButton = typeof window === "undefined" ? true : hasMainButton();

  // اعتبارسنجی زنده — کاربر باید بداند دقیقا چه چیزی کم است، نه اینکه با
  // دکمه‌ی خاکستریِ بی‌توضیح روبه‌رو شود.
  //
  // «گذشته بودن تاریخ» عمدا اینجا سنجیده نمی‌شود: خواندن ساعت در بدنه‌ی رندر
  // ناخالص است و هر رندر جواب متفاوت می‌دهد. ملاک از اول هم سرور بوده که
  // موقع ثبت تاریخ را می‌سنجد و bad_date برمی‌گرداند؛ همان پیام در ERR هست.
  const issues: string[] = [];
  if (question.trim().length < 15) {
    issues.push(`سؤال حداقل ۱۵ کاراکتر (الان ${question.trim().length})`);
  }
  if (sourceNote.trim().length < 10) {
    issues.push(`منبع تسویه حداقل ۱۰ کاراکتر (الان ${sourceNote.trim().length})`);
  }
  if (!closesAt) issues.push("زمان بسته‌شدن را انتخاب کن");
  const valid = issues.length === 0;

  useEffect(() => showBackButton(onBack), [onBack]);

  const submit = useCallback(async () => {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const j = await api<{ cost: number; coverUrl: string | null }>("/api/ir/propose", {
        method: "POST",
        body: JSON.stringify({ question, sourceNote, category, closesAt }),
      });
      haptic.success();
      setCoverUrl(j.coverUrl ?? null);
      setMsg({
        ok: true,
        // با معافیت ادمین، cost صفر می‌شود و «۰ تتر کسر شد» بی‌معنی است.
        text:
          j.cost > 0
            ? `پیشنهاد ثبت شد و در صف بررسی است. ${j.cost} تتر از کیف پول کسر شد.`
            : "پیشنهاد ثبت شد و در صف بررسی است.",
      });
      setQuestion("");
      setSourceNote("");
      setClosesAt("");
      onDone();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg({ ok: false, text: ERR[code] ?? "خطایی رخ داد." });
    } finally {
      setBusy(false);
    }
  }, [valid, busy, question, sourceNote, category, closesAt, onDone]);

  useMainButton({
    visible: nativeButton,
    text: busy ? "در حال ثبت…" : "ثبت پیشنهاد (۱ تتر)",
    enabled: valid && !busy,
    busy,
    onClick: submit,
  });

  return (
    <div>
      <BackLink label={"بازگشت به بازار ایران"} onClick={onBack} />
      <h2 className="mb-1 font-display text-lg font-black text-cream">ساخت بازار</h2>
      <p className="mb-4 text-[11px] text-muted">
        پس از بررسی انسانی منتشر می‌شود
      </p>

      <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
        <h3 className="text-[12px] font-extrabold text-gold">قبل از پیشنهاد بخوان</h3>
        <ul className="mt-2.5 flex flex-col gap-2 text-[11px] leading-6 text-muted">
          <li>• سؤال باید <b className="text-cream">دقیق و دوحالته</b> باشد. «آیا
            اوضاع بهتر می‌شود؟» بازار نیست؛ «آیا دلار تا ۳۰ آذر بالای X بسته
            می‌شود؟» بازار است.
          </li>
          <li>• <b className="text-cream">منبع تسویه اجباری است.</b> یک سایت مشخص،
            یک عدد مشخص، یک ساعت مشخص.
          </li>
          <li>• هر پیشنهاد <b className="text-cream">۱ تتر</b> هزینه دارد. اگر بازار
            رد شود، کامل برمی‌گردد.
          </li>
          <li>• بازار مبهم یا غیرقابل‌اثبات رد می‌شود.</li>
        </ul>
      </div>

      <div className="mt-4">
        <label className="block text-[11px] text-muted">سؤال بازار</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="مثال: آیا نرخ دلار آزاد تا ۳۰ آذر بالای ۹۰ هزار تومان بسته می‌شود؟"
          className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-3.5 py-3 text-[13px] leading-7 text-cream outline-none transition focus:border-gold/60"
        />
        <div dir="ltr" className="mt-1 text-left font-mono text-[10px] text-muted">
          {question.length}/200
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[11px] text-muted">
          منبع تسویه: نتیجه از کجا خوانده می‌شود؟
        </label>
        <textarea
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          rows={2}
          placeholder="مثال: قیمت پایانی دلار آزاد در tgju.org، ساعت ۱۸ روز ۳۰ آذر ۱۴۰۵"
          className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-3.5 py-3 text-[13px] leading-7 text-cream outline-none transition focus:border-gold/60"
        />
      </div>

      <div className="mt-3">
        <label className="block text-[11px] text-muted">دسته</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {IR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setCategory(c.id);
              }}
              className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
                category === c.id
                  ? "border-gold bg-gold text-ink font-bold"
                  : "border-line bg-surface/40 text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[11px] text-muted">
          زمان بسته‌شدن (به وقت تهران)
        </label>
        <div className="mt-1.5">
          <JalaliDateTime value={closesAt} onChange={setClosesAt} />
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 rounded-xl border border-line bg-ink/40 px-4 py-3">
          {issues.map((t) => (
            <li
              key={t}
              className="flex items-start gap-2 text-[11px] leading-6 text-muted"
            >
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-loss" />
              {t}
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-[11.5px] leading-6 ${
            msg.ok
              ? "border-gain/40 bg-gain/5 text-gain"
              : "border-loss/40 bg-loss/5 text-loss"
          }`}
        >
          <p>{msg.text}</p>
          {/* بازار تازه دست ادمین است و کاربر هیچ راهی برای پیگیری نداشت.
              انتظارِ بی‌مخاطب، همان‌جایی است که کاربر فکر می‌کند پولش را
              گرفته‌اند و خبری نیست. */}
          {msg.ok && coverUrl && (
            <button
              type="button"
              onClick={() => openTelegramChat(coverUrl)}
              className="mt-2 block w-full rounded-xl border border-gold/40 bg-gold/10 py-2.5 text-center text-[11.5px] font-bold text-gold"
            >
              🖼 افزودن کاور در ربات — بازارِ کاوردار بیشتر دیده می‌شود
            </button>
          )}
          {msg.ok && (
            <a
              href={LINKS.telegramSupport}
              onClick={(e) => {
                e.preventDefault();
                openTelegramChat(LINKS.telegramSupport);
              }}
              className="mt-2 inline-block text-[11px] text-muted underline decoration-line underline-offset-4"
            >
              سؤالی درباره‌ی بازارت داری یا پیگیری می‌خواهی؟ پشتیبانی
            </a>
          )}
        </div>
      )}

      {/* اگر کلاینت MainButton نداشته باشد، فرم بدون راه ثبت می‌ماند — پس
          دکمه‌ی درون‌صفحه‌ای جایگزینش می‌شود. */}
      {nativeButton ? (
        <p className="mt-4 text-center text-[10px] text-muted">
          برای ثبت، دکمه‌ی پایین صفحه‌ی تلگرام را بزن
        </p>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="mt-4 w-full rounded-xl bg-gold py-3.5 font-display text-sm font-extrabold text-ink transition disabled:opacity-40"
        >
          {busy ? "در حال ثبت…" : "ثبت پیشنهاد (۱ تتر)"}
        </button>
      )}
    </div>
  );
}
