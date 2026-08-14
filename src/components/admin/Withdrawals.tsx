"use client";

import { useMemo, useState } from "react";
import { useAdminResource } from "@/components/admin/useAdminResource";

// برداشت‌ها — و مهم‌تر از همه، ردیف‌های `stuck`.
//
// کرون آشتی، برداشتی را که به نتیجه‌ی قطعی نرسیده خودش برنمی‌گرداند: نمی‌داند
// درگاه درخواست را دیده یا نه، و برگرداندنِ پولی که درگاه فرستاده یعنی دو
// بار پرداخت. پس تصمیمش انسانی است و اینجا گرفته می‌شود.

type Row = {
  id: string;
  player_id: number;
  amount: string;
  to_address: string;
  network: string;
  gateway_uuid: string | null;
  status: string;
  error: string | null;
  created_at: string;
  display_name: string | null;
  tg_username: string | null;
};

const TABS = [
  { id: "stuck", label: "نیازمند بررسی" },
  { id: "submitted", label: "در جریان" },
  { id: "failed", label: "برگشت‌خورده" },
  { id: "completed", label: "انجام‌شده" },
  { id: "all", label: "همه" },
];

const STATUS_FA: Record<string, string> = {
  requested: "ثبت‌شده",
  submitted: "در جریان",
  stuck: "بی‌سرانجام",
  failed: "برگشت‌خورده",
  completed: "انجام‌شده",
};

const money = (n: string) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" });
}

const EMPTY: Row[] = [];

export default function Withdrawals() {
  const [tab, setTab] = useState("stuck");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, error, reload } = useAdminResource<{
    rows: Row[];
    counts: Record<string, number>;
  }>(`/api/admin/withdrawals?status=${tab}`);

  const rows = error ? EMPTY : (data?.rows ?? null);
  const counts = data?.counts ?? {};

  const total = useMemo(
    () => Object.values(counts).reduce((s, n) => s + n, 0),
    [counts]
  );

  async function refund(r: Row) {
    // علت اجباری است — سرور هم ردش می‌کند اگر نیاید. برگرداندن پول فقط با
    // تکیه بر حرف درگاه درست است و باید بشود شش ماه بعد فهمید چرا.
    const note = window.prompt(
      `برگشت ${money(r.amount)} تتر به حساب ${r.display_name ?? r.player_id}.\n\n` +
        `فقط وقتی این کار را بکن که از درگاه مطمئن شده‌ای پول نرفته.\n\n` +
        `علت (اجباری):`
    );
    if (!note?.trim()) return;

    setBusy(r.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action: "refund", note: note.trim() }),
      });
      const j = await res.json();
      setMsg(
        j.ok
          ? "پول برگشت و به کاربر اطلاع داده شد."
          : j.error === "note_required"
            ? "علت باید حداقل سه کاراکتر باشد."
            : j.error === "not_refundable"
              ? "این ردیف دیگر قابل برگشت نیست (شاید همین حالا برگشته)."
              : `انجام نشد: ${j.error}`
      );
      if (j.ok) reload();
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-4 rounded-xl border border-line bg-raised/40 px-4 py-3 text-[11px] leading-6 text-muted">
        ردیف‌های <b>نیازمند بررسی</b> آن‌هایی‌اند که پول کاربر کسر شده ولی پاسخ
        قطعی از درگاه نیامده. کرون عمداً خودش برنمی‌گرداند، چون اگر درگاه پول را
        فرستاده باشد و ما هم برگردانیم، دو بار پرداخت شده. <b>اول در پنل درگاه
        چک کن</b>، بعد برگشت بزن.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = t.id === "all" ? total : (counts[t.id] ?? 0);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                tab === t.id
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-line text-muted hover:text-cream"
              }`}
            >
              {t.label}
              {n > 0 && <span className="ms-1.5 font-mono text-[10px]">{n}</span>}
            </button>
          );
        })}
      </div>

      {msg && (
        <p className="mb-4 rounded-xl border border-line bg-raised/40 px-4 py-3 text-[11.5px] text-cream">
          {msg}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11.5px] text-loss">
          فهرست برداشت‌ها نیامد ({error}).
        </p>
      )}

      {rows === null && <p className="text-sm text-muted">در حال بارگذاری…</p>}

      {/* فهرست خالی باید حرف بزند، وگرنه معلوم نیست چیزی نیست یا چیزی نیامده. */}
      {rows !== null && !rows.length && !error && (
        <p className="rounded-xl border border-line bg-raised/40 px-4 py-6 text-center text-[12px] text-muted">
          {tab === "stuck"
            ? "هیچ برداشتی نیازمند بررسی نیست."
            : "در این وضعیت برداشتی نیست."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(rows ?? []).map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-raised/40 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[13px] font-bold text-cream">
                {r.display_name ?? `کاربر ${r.player_id}`}
                {r.tg_username && (
                  <span className="ms-2 font-mono text-[10px] text-muted">
                    @{r.tg_username}
                  </span>
                )}
              </div>
              <div dir="ltr" className="font-mono text-[13px] font-bold text-gold">
                ${money(r.amount)}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span className="rounded-full border border-line px-2 py-0.5">
                {STATUS_FA[r.status] ?? r.status}
              </span>
              <span>{r.network}</span>
              <span>{when(r.created_at)}</span>
            </div>

            <div
              dir="ltr"
              className="mt-2 break-all font-mono text-[10px] leading-5 text-muted"
            >
              {r.to_address}
              {r.gateway_uuid && <div className="mt-0.5">uuid: {r.gateway_uuid}</div>}
            </div>

            {r.error && (
              <p className="mt-2 rounded-lg border border-line bg-surface/40 px-3 py-2 text-[10.5px] text-muted">
                {r.error}
              </p>
            )}

            {(r.status === "stuck" || r.status === "submitted") && (
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => refund(r)}
                className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-1.5 text-[11px] font-bold text-loss transition disabled:opacity-50"
              >
                {busy === r.id ? "…" : "برگشت پول به کاربر"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
