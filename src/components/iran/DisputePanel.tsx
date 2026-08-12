"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * پنجره‌ی اعتراض — سمت کاربر.
 *
 * تا پیش از این، آن ۲۴ ساعت فقط تأخیر بود و هیچ‌کس نمی‌توانست اعتراض کند.
 * حالا شرکت‌کننده‌های همان بازار می‌توانند دلیل بنویسند و تا وقتی اعتراضی
 * رسیدگی نشده باشد، پرداخت انجام نمی‌شود.
 */
type State = {
  windowOpen: boolean;
  canDispute: boolean;
  openCount: number;
  mine: { status: string; reason: string } | null;
  endsAt: string | null;
};

const ERR: Record<string, string> = {
  not_authed: "برای اعتراض وارد حساب شوید.",
  bad_reason: "دلیل اعتراض باید بین ۱۵ تا ۶۰۰ کاراکتر باشد.",
  not_participant: "فقط کسانی که روی این بازار پیش‌بینی کرده‌اند می‌توانند اعتراض کنند.",
  not_disputable: "این بازار در وضعیت اعتراض نیست.",
  window_closed: "مهلت اعتراض تمام شده است.",
  already_disputed: "شما قبلاً روی این بازار اعتراض ثبت کرده‌اید.",
};

const MINE_LABEL: Record<string, { t: string; cls: string }> = {
  open: { t: "در حال بررسی", cls: "border-gold/40 text-gold" },
  accepted: { t: "اعتراض پذیرفته شد", cls: "border-gain/40 text-gain" },
  rejected: { t: "اعتراض رد شد", cls: "border-loss/40 text-loss" },
};

export default function DisputePanel({ marketId }: { marketId: number }) {
  const [s, setS] = useState<State | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ir/dispute?market=${marketId}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (j.ok) setS(j);
    } catch {
      /* اگر نشد، پنل ساکت می‌ماند — بخش حیاتی صفحه نیست */
    }
  }, [marketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ir/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, reason }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ ok: false, text: ERR[j.error] ?? "خطایی رخ داد." });
        return;
      }
      setMsg({ ok: true, text: "اعتراض ثبت شد. تا رسیدگی، پرداخت انجام نمی‌شود." });
      setReason("");
      setOpen(false);
      await load();
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  // خارج از پنجره و بدون اعتراض ثبت‌شده، چیزی نشان نده
  if (!s || (!s.windowOpen && !s.mine)) return null;

  const endsFa = s.endsAt
    ? new Date(s.endsAt).toLocaleString("fa-IR", {
        timeZone: "Asia/Tehran",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="no-lift mt-5 rounded-xl border border-gold/30 bg-gold/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-bold text-gold">دوره‌ی بازبینی نتیجه</h3>
        {s.openCount > 0 && (
          <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] text-gold">
            {s.openCount} اعتراض در حال بررسی
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-6 text-muted">
        نتیجه ثبت شده ولی هنوز پرداخت نشده. اگر فکر می‌کنی نتیجه با منبع اعلام‌شده
        نمی‌خواند، همین‌جا اعتراض کن.
        {endsFa && s.windowOpen && (
          <>
            {" "}
            مهلت تا <b className="text-cream">{endsFa}</b>.
          </>
        )}
      </p>

      {s.mine ? (
        <div className="mt-3 rounded-lg border border-line bg-ink/30 p-3">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${
              MINE_LABEL[s.mine.status]?.cls ?? "border-line text-muted"
            }`}
          >
            {MINE_LABEL[s.mine.status]?.t ?? s.mine.status}
          </span>
          <p className="mt-2 text-[11px] leading-6 text-muted">{s.mine.reason}</p>
        </div>
      ) : s.canDispute ? (
        open ? (
          <div className="mt-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="دقیقاً بگو چرا نتیجه اشتباه است؛ مثلاً «قیمت پایانی در همان منبع ۹۲ هزار بود، نه ۸۸ هزار»."
              className="no-zoom w-full rounded-lg border border-line bg-ink/50 px-3 py-2.5 text-[12px] leading-7 text-cream outline-none transition focus:border-gold/60"
            />
            <div className="mt-1 text-end font-mono text-[10px] text-muted" dir="ltr">
              {reason.trim().length}/600
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={busy || reason.trim().length < 15}
                className="no-zoom flex-1 rounded-lg bg-gold py-2.5 text-[12px] font-bold text-ink transition hover:bg-gold-deep disabled:opacity-40"
              >
                {busy ? "…" : "ثبت اعتراض"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="no-zoom rounded-lg border border-line px-4 text-[12px] text-muted transition hover:text-cream"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="no-zoom mt-3 w-full rounded-lg border border-gold/40 py-2.5 text-[12px] font-bold text-gold transition hover:bg-gold hover:text-ink"
          >
            اعتراض به نتیجه
          </button>
        )
      ) : (
        <p className="mt-3 text-[10px] text-muted">
          فقط کسانی که روی این بازار پیش‌بینی کرده‌اند می‌توانند اعتراض ثبت کنند.
        </p>
      )}

      {msg && (
        <p className={`mt-2 text-[11px] ${msg.ok ? "text-gain" : "text-loss"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
