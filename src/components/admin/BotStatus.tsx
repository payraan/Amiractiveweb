"use client";

import { useCallback, useEffect, useState } from "react";

// وضعیت ربات تلگرام و ثبت وبهوک.
//
// چرا اینجا و نه یک دستور ترمینال: ثبت وبهوک یعنی صدا زدن setWebhook با
// توکن ربات. اگر دستی زده شود، توکن در تاریخچه‌ی شل می‌ماند. اینجا فقط یک
// دکمه است و توکن از متغیر محیطی سرور خوانده می‌شود.
//
// این صفحه فقط برای راه‌اندازی اولیه نیست: هر بار دامنه عوض شود یا تلگرام
// وبهوک را به‌خاطر خطای پیاپی رها کند، همین‌جا دیده و دوباره ثبت می‌شود.

type Info = {
  expectedUrl: string;
  configError: string | null;
  bot: { username?: string; first_name?: string; id?: number; error?: string };
  webhook: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
    error?: string;
  };
};

const SETUP_ERRORS: Record<string, string> = {
  site_url_missing: "متغیر SITE_URL روی سرور ست نشده است.",
  site_url_not_https:
    "تلگرام فقط وبهوک HTTPS می‌پذیرد. مقدار SITE_URL باید با //:https شروع شود.",
  webhook_secret_missing: "متغیر TG_WEBHOOK_SECRET روی سرور ست نشده است.",
  webhook_secret_invalid:
    "مقدار TG_WEBHOOK_SECRET کاراکتر غیرمجاز دارد. تلگرام فقط حرف انگلیسی، عدد، _ و - را می‌پذیرد. با دستور openssl rand -hex 32 یک مقدار تازه بساز و در Railway جایگزین کن.",
};

const fa = (unix: number) =>
  new Date(unix * 1000).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BotStatus() {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // هیچ setState همگامی پیش از اولین await نیست — وگرنه فراخوانی‌اش داخل
  // useEffect رندر آبشاری می‌سازد (همان قاعده‌ای که eslint می‌گیرد).
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tg/setup", { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) {
        setErr(
          j.error === "bot_not_configured"
            ? "متغیرهای TG_BOT_TOKEN و TG_BOT_USERNAME روی سرور ست نشده‌اند."
            : j.error === "unauthorized"
              ? "نشست مدیریت منقضی شده. صفحه را تازه کن و دوباره وارد شو."
              : `خطا: ${j.error}`
        );
        setInfo(null);
      } else {
        setErr(null);
        setInfo(j);
      }
    } catch {
      setErr("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function register() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tg/setup", { method: "POST" });
      const j = await res.json();
      setMsg(
        j.ok
          ? { ok: true, text: `وبهوک روی ${j.url} ثبت شد.` }
          : {
              ok: false,
              text: SETUP_ERRORS[j.error] ?? `تلگرام نپذیرفت: ${j.error}`,
            }
      );
      await load();
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-xs text-muted">در حال بارگذاری…</p>;

  if (err) {
    return (
      <div className="rounded-2xl border border-loss/40 bg-loss/5 p-5">
        <p className="text-sm font-bold text-loss">{err}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 text-[11px] text-muted transition hover:text-cream"
        >
          بررسی دوباره
        </button>
      </div>
    );
  }

  const registered = info?.webhook.url ?? "";
  const expected = info?.expectedUrl ?? "";
  const state = !registered
    ? "none"
    : registered === expected
      ? "ok"
      : "mismatch";

  const STATE = {
    ok: { text: "وبهوک ثبت و سالم است", cls: "border-gain/40 bg-gain/5 text-gain" },
    none: {
      text: "وبهوک ثبت نشده؛ ربات به هیچ پیامی جواب نمی‌دهد",
      cls: "border-gold/40 bg-gold/5 text-gold",
    },
    mismatch: {
      text: "وبهوک روی آدرس دیگری ثبت شده",
      cls: "border-loss/40 bg-loss/5 text-loss",
    },
  }[state];

  const configError = info?.configError ?? null;

  return (
    <div className="flex flex-col gap-4">
      {configError && (
        <div className="rounded-2xl border border-loss/40 bg-loss/5 p-5">
          <p className="text-sm font-bold text-loss">ایراد پیکربندی سرور</p>
          <p className="mt-2 text-[11px] leading-6 text-cream">
            {SETUP_ERRORS[configError] ?? configError}
          </p>
          <p className="mt-2 text-[11px] leading-6 text-muted">
            تا این حل نشود، دکمه‌ی ثبت وبهوک کار نمی‌کند. پس از تغییر متغیر در
            Railway باید سرویس دوباره دیپلوی شود تا مقدار تازه خوانده شود.
          </p>
        </div>
      )}

      <div className={`rounded-2xl border p-5 ${STATE.cls}`}>
        <p className="text-sm font-bold">{STATE.text}</p>
        {state === "mismatch" && (
          <p className="mt-2 text-[11px] leading-6 text-muted">
            آدرس ثبت‌شده با <span className="font-mono">SITE_URL</span> فعلی نمی‌خواند.
            معمولا یعنی دامنه عوض شده. دکمه‌ی زیر آن را روی آدرس درست می‌نشاند.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ربات" value={info?.bot.username ? `@${info.bot.username}` : "—"} />
        <Field label="شناسه‌ی ربات" value={info?.bot.id ? String(info.bot.id) : "—"} />
        <Field label="آدرس مورد انتظار" value={expected || "SITE_URL ست نشده"} />
        <Field label="آدرس ثبت‌شده نزد تلگرام" value={registered || "—"} />
        <Field
          label="آپدیت‌های معلق"
          value={String(info?.webhook.pending_update_count ?? 0)}
        />
        <Field
          label="آخرین خطای تلگرام"
          value={
            info?.webhook.last_error_message
              ? `${info.webhook.last_error_message}${
                  info.webhook.last_error_date
                    ? ` — ${fa(info.webhook.last_error_date)}`
                    : ""
                }`
              : "بدون خطا"
          }
          bad={Boolean(info?.webhook.last_error_message)}
        />
      </div>

      {msg && (
        <p className={`text-xs ${msg.ok ? "text-gain" : "text-loss"}`}>{msg.text}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={register}
          disabled={busy}
          className="rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
        >
          {busy ? "…" : state === "ok" ? "ثبت دوباره‌ی وبهوک" : "ثبت وبهوک"}
        </button>
        <button
          type="button"
          onClick={load}
          className="text-[11px] text-muted transition hover:text-cream"
        >
          بررسی دوباره
        </button>
      </div>

      <p className="text-[11px] leading-6 text-muted">
        پس از ثبت، در تلگرام به ربات پیام <span className="font-mono">/start</span> بده.
        اگر جواب نداد، «آخرین خطای تلگرام» بالا را ببین؛ همان‌جا دلیلش نوشته می‌شود.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-4">
      <div className="text-[10px] text-muted">{label}</div>
      <div
        dir="ltr"
        className={`mt-1 break-all text-right font-mono text-[11px] ${
          bad ? "text-loss" : "text-cream"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
