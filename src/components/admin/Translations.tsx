"use client";

import { useCallback, useEffect, useState } from "react";

// بازبینی ترجمه‌ی عنوان بازارهای خارجی.
//
// ترجمه‌ی ماشینی روی اسم‌های خاص می‌لنگد («George Russell» نباید «جرج
// راسل» شود، چون کاربری که دنبال اوست همان لاتین را می‌شناسد). این صفحه
// برای همان اصلاح‌های کوچک است، نه ترجمه‌ی دستی همه‌چیز.

type Row = {
  hash: string;
  en: string;
  fa: string | null;
  edited: boolean;
  failures: number;
};

type Data = {
  ready: boolean;
  counts: { total: string; pending: string; edited: string };
  rows: Row[];
};

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "pending", label: "ترجمه‌نشده" },
  { id: "edited", label: "اصلاح‌شده" },
] as const;

export default function Translations() {
  const [filter, setFilter] = useState<string>("all");
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/translations?filter=${filter}`, {
      cache: "no-store",
    });
    const j = await r.json();
    if (j.ok) setData(j);
  }, [filter]);

  useEffect(() => {
    // همان استثنای مستندِ useResource: گرفتن داده هنگام mount ذاتا یعنی
    // setState از داخل افکت. اینجا از useResource استفاده نشد چون آن هوک
    // توکن مینی‌اپ را می‌فرستد و این صفحه با کوکی ادمین کار می‌کند.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(hash: string, fa: string) {
    setBusy(hash);
    try {
      await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, fa }),
      });
      setDraft((d) => {
        const n = { ...d };
        delete n[hash];
        return n;
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setBusy("__run");
    setRunMsg(null);
    try {
      const r = await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: true }),
      });
      const j = await r.json();
      setRunMsg(
        j.ok
          ? `${j.translated} ترجمه شد · ${j.failed} ناموفق · ${j.pending} در صف`
          : "اجرا نشد."
      );
      setRunErr(j.error ?? null);
      setModel(j.model ?? null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function resetAll() {
    setBusy("__reset");
    try {
      await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetAll: true }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function retry(hash: string) {
    setBusy(hash);
    try {
      await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, retry: true }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="py-10 text-center text-xs text-muted">در حال بارگذاری…</p>;

  return (
    <div>
      {!data.ready && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/5 p-4 text-[12px] leading-7 text-gold">
          کلید ترجمه (<code>GEMINI_API_KEY</code>) روی سرور ست نشده است. عنوان‌ها
          در صف می‌مانند و تا آن موقع نسخه‌ی انگلیسی به کاربر نشان داده می‌شود.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span>
          کل: <b className="text-cream">{data.counts.total}</b>
        </span>
        <span>
          ترجمه‌نشده: <b className="text-loss">{data.counts.pending}</b>
        </span>
        <span>
          اصلاح‌شده: <b className="text-gold">{data.counts.edited}</b>
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy === "__run"}
          onClick={runNow}
          className="rounded-lg bg-gold px-4 py-2 text-[11px] font-bold text-ink transition disabled:opacity-40"
        >
          {busy === "__run" ? "در حال ترجمه…" : "ترجمه‌ی همین حالا"}
        </button>
        <button
          type="button"
          disabled={busy === "__reset"}
          onClick={resetAll}
          title="شمارنده‌ی شکست همه را صفر می‌کند تا دوباره امتحان شوند"
          className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted transition disabled:opacity-40"
        >
          تلاش دوباره‌ی همه
        </button>
        {runMsg && <span className="text-[11px] text-muted">{runMsg}</span>}
        {model && (
          <span className="text-[10px] text-muted" dir="ltr">
            model: {model}
          </span>
        )}
      </div>

      {/* خطای واقعی گوگل، بدون دستکاری. بدون این، «ناموفق» یک عدد بی‌معنا
          بود و هیچ راهی برای فهمیدن علت وجود نداشت. */}
      {runErr && (
        <div
          dir="ltr"
          className="mb-4 rounded-xl border border-loss/40 bg-loss/5 p-3 text-start font-mono text-[11px] leading-6 text-loss"
        >
          {runErr}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
              filter === f.id
                ? "border-gold bg-gold/10 font-bold text-gold"
                : "border-line text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {data.rows.length === 0 && (
        <p className="py-10 text-center text-xs text-muted">موردی نیست.</p>
      )}

      <div className="flex flex-col gap-3">
        {data.rows.map((r) => {
          const value = draft[r.hash] ?? r.fa ?? "";
          const dirty = draft[r.hash] !== undefined && draft[r.hash] !== (r.fa ?? "");
          return (
            <div
              key={r.hash}
              className="rounded-xl border border-line bg-surface/40 p-3"
            >
              <p dir="ltr" className="text-start text-[11px] leading-6 text-muted">
                {r.en}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [r.hash]: e.target.value }))
                  }
                  placeholder={r.failures >= 3 ? "ترجمه شکست خورد — دستی بنویسید" : "ترجمه‌ی فارسی…"}
                  className="flex-1 rounded-lg border border-line bg-ink/50 px-3 py-2 text-[12px] text-cream outline-none focus:border-gold/50"
                />
                <button
                  type="button"
                  disabled={!dirty || busy === r.hash}
                  onClick={() => save(r.hash, value)}
                  className="shrink-0 rounded-lg bg-gold px-3 py-2 text-[11px] font-bold text-ink transition disabled:opacity-30"
                >
                  ذخیره
                </button>
                <button
                  type="button"
                  disabled={busy === r.hash}
                  onClick={() => retry(r.hash)}
                  title="پاک کردن و برگرداندن به صف ترجمه‌ی خودکار"
                  className="shrink-0 rounded-lg border border-line px-3 py-2 text-[11px] text-muted transition disabled:opacity-30"
                >
                  دوباره
                </button>
              </div>

              <div className="mt-1.5 flex gap-3 text-[10px] text-muted">
                {r.edited && <span className="text-gold">اصلاح دستی</span>}
                {r.failures > 0 && (
                  <span className="text-loss">{r.failures} بار شکست</span>
                )}
                {!r.fa && !r.failures && <span>در صف</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
