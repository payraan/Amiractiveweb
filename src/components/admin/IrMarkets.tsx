"use client";

import { useCallback, useEffect, useState } from "react";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import { tehranAt } from "@/lib/dates";

type M = {
  id: number;
  question: string;
  category: string;
  sourceNote: string;
  closesAt: string;
  status: string;
  outcome: string | null;
  creator: string | null;
  creatorTg: string | null;
  yesTotal: number;
  noTotal: number;
  volume: number;
  bettors: number;
  yesPct: number;
  yesOdds: number;
  noOdds: number;
  wouldVoidYes: boolean;
  wouldVoidNo: boolean;
  disputeEndsAt: string | null;
  canFinalize: boolean;
  createdAt: string;
};

// چرخه‌ی عمر بازار — ترتیب همان ترتیب واقعی حرکت بازار است.
const TABS = [
  {
    id: "pending",
    label: "در انتظار تأیید",
    help: "کاربر بازار را ساخته و ۱ تتر داده، ولی هنوز منتشر نشده. تو باید بخوانی و تأیید یا رد کنی. تا تأیید نشود هیچ‌کس نمی‌تواند پیش‌بینی کند. اگر رد کنی، آن ۱ تتر کامل به سازنده برمی‌گردد.",
  },
  {
    id: "open",
    label: "باز",
    help: "بازار منتشر شده و مردم دارند با تتر پیش‌بینی می‌کنند. تا رسیدن زمان بسته‌شدن در همین حالت می‌ماند. اگر لازم شد می‌توانی زودتر دستی ببندیش.",
  },
  {
    id: "locked",
    label: "بسته",
    help: "ثبت پیش‌بینی تمام شده و پول در استخر قفل است، ولی نتیجه هنوز اعلام نشده. اینجا باید منبع تسویه را چک کنید و نتیجه را ثبت کنید.",
  },
  {
    id: "settling",
    label: "در پنجره اعتراض",
    help: "نتیجه را ثبت کرده‌ای و ۲۴ ساعت فرصت اعتراض شروع شده. هنوز هیچ پولی پرداخت نشده. بعد از پایان این ۲۴ ساعت، دکمه‌ی «تسویه‌ی نهایی» فعال می‌شود.",
  },
  {
    id: "settled",
    label: "تسویه‌شده",
    help: "پول برنده‌ها پرداخت شده و کمیسیون در دفترکل درآمد ثبت شده. این حالت پایانی است و برگشت‌پذیر نیست.",
  },
  {
    id: "void",
    label: "باطل",
    help: "بازار لغو شده و پول برگشته. سه دلیل دارد: پیشنهاد را رد کرده‌ای، ضریب برنده زیر حد مجاز بوده (برگشت کامل بدون کمیسیون)، یا هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرده (برگشت با کسر کمیسیون).",
  },
] as const;

const fa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type D = {
  id: number;
  market_id: number;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  username: string;
  question: string;
  outcome: string | null;
};

export default function IrMarkets() {
  const [status, setStatus] = useState<string>("pending");
  const [rows, setRows] = useState<M[]>([]);
  const [disputes, setDisputes] = useState<D[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/ir?status=${status}`, { cache: "no-store" });
      const j = await r.json();
      setRows(j.ok ? j.markets : []);
      setDisputes(j.ok ? (j.disputes ?? []) : []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // انتشار در کانال. دو حالت، چون تلگرام اجازه نمی‌دهد هر دو را با هم داشت:
  //  • live     — دکمه‌های callback، رأی درجا و درصدهای خودکار. ربات باید در
  //               آن کانال ادمین باشد و کارت با فوروارد دکمه‌هایش را از دست
  //               می‌دهد.
  //  • forward  — دکمه‌های لینک، در فوروارد باقی می‌مانند، ولی درصدها روی
  //               همان لحظه یخ می‌زنند و کارت هم همین را می‌نویسد.
  async function publish(id: number, mode: "live" | "forward") {
    const chatId = window.prompt(
      mode === "live"
        ? "شناسه‌ی کانال برای ارسال زنده (@username یا -100…).\nربات باید در آن کانال ادمین باشد."
        : "شناسه‌ی کانال یا چت برای کارت فوروارد (@username یا -100…)."
    );
    if (!chatId?.trim()) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin/ir-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: id, chatId: chatId.trim(), mode }),
      });
      const j = await r.json();
      window.alert(
        j.ok
          ? mode === "live"
            ? "ارسال شد. درصدها هر ۱۵ دقیقه خودکار به‌روز می‌شوند."
            : "ارسال شد. حالا می‌توانی فورواردش کنی."
          : j.error === "market_not_open"
            ? "فقط بازار باز را می‌شود منتشر کرد."
            : `ارسال نشد: ${j.error}`
      );
      if (j.ok) load();
    } catch {
      window.alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function act(id: number, action: string, extra?: Record<string, unknown>) {
    setBusy(id);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/ir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const j = await r.json();
      setMsg(j.ok ? "انجام شد." : `خطا: ${j.error ?? "نامشخص"}`);
      await load();
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <QuickCreate onCreated={load} />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              status === t.id
                ? "border-gold bg-gold/10 text-gold"
                : "border-line text-muted hover:text-cream"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* توضیح همان وضعیتی که انتخاب شده — تا معنی هر مرحله جلوی چشم باشد */}
      <p className="no-lift mb-4 rounded-xl border border-line bg-ink/30 px-4 py-3 text-[11px] leading-7 text-muted">
        <b className="text-gold">{TABS.find((t) => t.id === status)?.label}:</b>{" "}
        {TABS.find((t) => t.id === status)?.help}
      </p>

      {disputes.filter((d) => d.status === "open").length > 0 && (
        <div className="no-lift mb-5 rounded-xl border border-gold/40 bg-gold/5 p-4">
          <h3 className="text-sm font-bold text-gold">
            اعتراض‌های در انتظار رسیدگی
          </h3>
          <p className="mt-1 text-[11px] leading-6 text-muted">
            تا وقتی اعتراضی باز باشد، تسویه‌ی نهایی آن بازار انجام نمی‌شود. اگر
            اعتراض وارد است، اول نتیجه را با «اصلاح نتیجه» درست کن، بعد اعتراض را
            بپذیر.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {disputes
              .filter((d) => d.status === "open")
              .map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-line bg-ink/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-muted" dir="ltr">
                      #{d.market_id} · @{d.username}
                    </span>
                    <span className="text-muted">
                      نتیجه‌ی ثبت‌شده:{" "}
                      <b className="text-cream">
                        {d.outcome === "yes"
                          ? "بله"
                          : d.outcome === "no"
                            ? "خیر"
                            : "باطل"}
                      </b>
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[11px] text-cream">
                    {d.question}
                  </p>
                  <p className="mt-2 rounded border border-line bg-surface/40 px-3 py-2 text-[11px] leading-6 text-muted">
                    {d.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn
                      tone="ok"
                      busy={busy === d.market_id}
                      onClick={() =>
                        act(d.market_id, "dispute_resolve", {
                          disputeId: d.id,
                          verdict: "accept",
                          reason: prompt("توضیح برای پذیرش اعتراض؟") ?? "",
                        })
                      }
                    >
                      پذیرش اعتراض
                    </Btn>
                    <Btn
                      tone="bad"
                      busy={busy === d.market_id}
                      onClick={() =>
                        act(d.market_id, "dispute_resolve", {
                          disputeId: d.id,
                          verdict: "reject",
                          reason: prompt("دلیل رد اعتراض؟") ?? "",
                        })
                      }
                    >
                      رد اعتراض
                    </Btn>
                    <Btn
                      busy={busy === d.market_id}
                      onClick={() => {
                        const o = prompt("نتیجه‌ی درست چیست؟ yes / no / void");
                        if (o) act(d.market_id, "revise", { outcome: o.trim() });
                      }}
                    >
                      اصلاح نتیجه
                    </Btn>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {msg && <p className="mb-3 text-xs text-gold">{msg}</p>}

      {loading ? (
        <p className="py-8 text-center text-xs text-muted">در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">موردی نیست.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-line bg-surface/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-cream">{m.question}</p>
                  <p className="mt-1.5 text-[11px] leading-6 text-muted">
                    <b className="text-gold">منبع تسویه:</b> {m.sourceNote}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted">
                    <span dir="ltr">#{m.id}</span>
                    <span>{m.category}</span>
                    <span>بسته‌شدن: {fa(m.closesAt)}</span>
                    {m.creator && <span>سازنده: {m.creator}</span>}
                    {m.creatorTg && <span dir="ltr">@{m.creatorTg}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-end">
                  <div className="font-mono text-lg font-bold text-cream" dir="ltr">
                    ${m.volume.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted">{m.bettors} شرکت‌کننده</div>
                </div>
              </div>

              {m.volume > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="rounded-lg border border-gain/30 px-3 py-2">
                    <span className="text-gain">بله {m.yesPct}%</span>
                    <span className="ms-2 text-muted" dir="ltr">
                      ${m.yesTotal.toFixed(2)} · ×{m.yesOdds}
                    </span>
                  </div>
                  <div className="rounded-lg border border-loss/30 px-3 py-2">
                    <span className="text-loss">
                      خیر {Math.round((100 - m.yesPct) * 10) / 10}%
                    </span>
                    <span className="ms-2 text-muted" dir="ltr">
                      ${m.noTotal.toFixed(2)} · ×{m.noOdds}
                    </span>
                  </div>
                </div>
              )}

              {/* هشدار باطل‌شدن — پیش از ثبت نتیجه */}
              {(m.wouldVoidYes || m.wouldVoidNo) && (
                <p className="mt-2.5 rounded-lg border border-loss/40 bg-loss/5 px-3 py-2 text-[11px] leading-6 text-loss">
                  هشدار: اگر نتیجه{" "}
                  {m.wouldVoidYes && m.wouldVoidNo
                    ? "هر کدام"
                    : m.wouldVoidYes
                      ? "«بله»"
                      : "«خیر»"}{" "}
                  باشد، ضریب برد زیر حد مجاز است و بازار خودکار باطل و پول
                  برگردانده می‌شود.
                </p>
              )}

              {m.disputeEndsAt && (
                <p className="mt-2.5 text-[11px] text-muted">
                  نتیجه: <b className="text-cream">{m.outcome}</b> · پایان پنجره
                  اعتراض: {fa(m.disputeEndsAt)}
                  {m.canFinalize && (
                    <b className="ms-2 text-gain">آماده‌ی تسویه‌ی نهایی</b>
                  )}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {m.status === "pending" && (
                  <>
                    <Btn tone="ok" busy={busy === m.id} onClick={() => act(m.id, "approve")}>
                      تأیید و انتشار
                    </Btn>
                    <Btn
                      tone="bad"
                      busy={busy === m.id}
                      onClick={() => {
                        const reason = prompt("دلیل رد؟") ?? "rejected";
                        act(m.id, "reject", { reason });
                      }}
                    >
                      رد و برگشت هزینه
                    </Btn>
                  </>
                )}
                {m.status === "open" && (
                  <>
                    <Btn busy={busy === m.id} onClick={() => act(m.id, "lock")}>
                      بستن دستی
                    </Btn>
                    <Btn busy={busy === m.id} onClick={() => publish(m.id, "live")}>
                      ارسال زنده به کانال
                    </Btn>
                    <Btn busy={busy === m.id} onClick={() => publish(m.id, "forward")}>
                      کارت فوروارد
                    </Btn>
                  </>
                )}
                {(m.status === "open" || m.status === "locked") && (
                  <>
                    <Btn tone="ok" busy={busy === m.id} onClick={() => act(m.id, "resolve", { outcome: "yes" })}>
                      نتیجه: بله
                    </Btn>
                    <Btn tone="bad" busy={busy === m.id} onClick={() => act(m.id, "resolve", { outcome: "no" })}>
                      نتیجه: خیر
                    </Btn>
                    <Btn busy={busy === m.id} onClick={() => act(m.id, "resolve", { outcome: "void" })}>
                      باطل
                    </Btn>
                  </>
                )}
                {m.status === "settling" && (
                  <Btn
                    tone="ok"
                    busy={busy === m.id}
                    disabled={!m.canFinalize}
                    onClick={() => act(m.id, "finalize")}
                  >
                    {m.canFinalize ? "تسویه‌ی نهایی و پرداخت" : "پنجره اعتراض باز است"}
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "ok" | "bad";
}) {
  const c =
    tone === "ok"
      ? "border-gain/50 text-gain hover:bg-gain/10"
      : tone === "bad"
        ? "border-loss/50 text-loss hover:bg-loss/10"
        : "border-line text-muted hover:text-cream";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`rounded-lg border px-3 py-1.5 text-[11px] transition disabled:opacity-40 ${c}`}
    >
      {busy ? "…" : children}
    </button>
  );
}


/* ────────────────────────── بازار سریع ───────────────────────── */

// ساخت و انتشار در یک قدم.
//
// ── چرا وجود دارد ──
// مسیر عادی دو قدم است: پیشنهاد، بعد تأیید در پنل. برای یک آیین **روزانه**
// آن دو قدم زیادی است. کاری که هر شب باید تکرار شود، اگر سه دقیقه طول
// بکشد تکرار نمی‌شود — و بازار روزانه دقیقا همان چیزی است که حلقه‌ی
// بازخورد را می‌بندد: کاربر امشب پیش‌بینی می‌کند و فردا نتیجه را می‌بیند.
//
// ⚠️ دکمه‌های زمانی به **ساعتِ دیوارِ تهران**‌اند، نه ساعت سرور. سرور در
// استانبول است؛ «امشب ۲۳:۵۹» با ساعت سرور یعنی یک ساعت زودتر از آنچه
// کاربر ایرانی می‌فهمد.

const PRESETS = [
  { label: "امشب ۲۳:۵۹", make: () => tehranAt(0, 23, 59) },
  { label: "فردا ۱۲:۰۰", make: () => tehranAt(1, 12, 0) },
  { label: "فردا ۲۳:۵۹", make: () => tehranAt(1, 23, 59) },
  { label: "پس‌فردا ۲۳:۵۹", make: () => tehranAt(2, 23, 59) },
];

/** «۲۰ ساعت دیگر» — تا ادمین ببیند واقعا چقدر فرصت می‌دهد. */
function untilText(d: Date | null): string {
  if (!d) return "";
  const h = Math.round((d.getTime() - Date.now()) / 3600_000);
  if (h < 1) return "کمتر از یک ساعت دیگر";
  if (h < 48) return `${h.toLocaleString("fa-IR")} ساعت دیگر`;
  return `${Math.round(h / 24).toLocaleString("fa-IR")} روز دیگر`;
}

function QuickCreate({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("economy");
  const [sourceNote, setSourceNote] = useState("");
  const [closesAt, setClosesAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ready =
    question.trim().length >= 10 && sourceNote.trim().length >= 3 && !!closesAt;

  async function submit() {
    if (!ready || !closesAt) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/ir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          question: question.trim(),
          category,
          sourceNote: sourceNote.trim(),
          closesAt: closesAt.toISOString(),
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`بازار ساخته و منتشر شد (شناسه ${j.id}).`);
        setQuestion("");
        setSourceNote("");
        setClosesAt(null);
        onCreated();
      } else {
        const why: Record<string, string> = {
          bad_question: "سؤال باید بین ۱۰ تا ۳۰۰ کاراکتر باشد.",
          bad_category: "دسته معتبر نیست.",
          source_required: "منبع تسویه اجباری است.",
          bad_date: "زمان بسته‌شدن باید در آینده باشد.",
        };
        setMsg(why[j.error] ?? `خطا: ${j.error}`);
      }
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-xl border border-gold/40 bg-gold/5 py-3 text-sm font-bold text-gold transition hover:bg-gold/10"
      >
        ⚡ ساخت بازار سریع — منتشر می‌شود بدون صف تأیید
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-gold/40 bg-gold/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gold">⚡ بازار سریع</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-muted hover:text-cream"
        >
          بستن
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-[10.5px] text-muted">
            سؤال — باید با «بله» یا «خیر» جواب داشته باشد
          </label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="آیا دلار آزاد امشب بالای ۱۸۷٬۰۰۰ تومان بسته می‌شود؟"
            className="w-full rounded-lg border border-line bg-raised/50 px-3 py-2 text-xs text-cream focus:border-gold focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10.5px] text-muted">دسته</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-line bg-raised/50 px-3 py-2 text-xs text-cream focus:border-gold focus:outline-none"
            >
              {IR_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-muted">
              منبع تسویه — اجباری
            </label>
            <input
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="نرخ بسته‌شدن tgju.org"
              className="w-full rounded-lg border border-line bg-raised/50 px-3 py-2 text-xs text-cream focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10.5px] text-muted">
            بسته‌شدن — به وقت تهران
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const d = p.make();
              const active = closesAt?.getTime() === d.getTime();
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setClosesAt(d)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
                    active
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-line text-muted hover:text-cream"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {closesAt && (
            <p className="mt-1.5 text-[10.5px] text-gain">
              {untilText(closesAt)} — کاربر نتیجه را همین بازه می‌بیند.
            </p>
          )}
        </div>

        {msg && (
          <p
            className={`text-[11px] ${
              msg.includes("منتشر شد") ? "text-gain" : "text-loss"
            }`}
          >
            {msg}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="rounded-lg bg-gold py-2.5 text-xs font-bold text-ink transition disabled:opacity-40"
        >
          {busy ? "در حال ساخت…" : "ساخت و انتشار"}
        </button>
      </div>
    </div>
  );
}
