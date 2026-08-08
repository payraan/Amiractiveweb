"use client";

import { useEffect, useState } from "react";

type Kind = { kind: string; total: number; n: number };
type Row = {
  id: number;
  kind: string;
  amount: number;
  note: string | null;
  created_at: string;
  market_id: number | null;
  question: string | null;
  username: string | null;
};

const LABEL: Record<string, string> = {
  ir_propose_fee: "هزینه‌ی ساخت بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  ir_commission: "کمیسیون تسویه",
  ir_commission_void: "کمیسیون بازار بدون برنده",
  credit_sale: "فروش MOON",
};

const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

const fa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function RevenueLedger() {
  const [d, setD] = useState<{
    totals: { all_time: number; d30: number; d7: number; today: number };
    byKind: Kind[];
    recent: Row[];
    topMarkets: { market_id: number; question: string | null; total: number }[];
    liabilities: { user_balances: number; locked_in_markets: number };
    split: {
      real_total: number;
      demo_total: number;
      demo_players: number;
      real_players: number;
    };
    daily: { day: string; total: number }[];
    config: { commission: number; proposeFee: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"real" | "demo" | "all">("real");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/revenue?scope=${scope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setD(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [scope]);

  if (loading) return <p className="text-xs text-muted">در حال بارگذاری…</p>;
  if (!d) return <p className="text-xs text-loss">خطا در دریافت دفترکل.</p>;

  const cards = [
    { label: "امروز", v: d.totals.today },
    { label: "۷ روز اخیر", v: d.totals.d7 },
    { label: "۳۰ روز اخیر", v: d.totals.d30 },
    { label: "کل درآمد", v: d.totals.all_time, big: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* واقعی در برابر دمو — پیش‌فرض روی واقعی است */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-ink/40 p-1">
          {(
            [
              { id: "real", label: "پول واقعی" },
              { id: "demo", label: "دمو (تستی)" },
              { id: "all", label: "همه" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setScope(t.id)}
              className={`no-zoom rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                scope === t.id ? "bg-gold text-ink" : "text-muted hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-5 text-muted">
          پول واقعی فقط از درگاه می‌آید؛ هر شارژ دستی ادمین «دمو» علامت می‌خورد.
          {" "}
          <b className="text-cream">
            واقعی {usd(d.split.real_total)} · دمو {usd(d.split.demo_total)}
          </b>{" "}
          — {d.split.real_players} حساب واقعی، {d.split.demo_players} حساب تستی.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`no-lift rounded-xl border px-4 py-3 ${
              c.big ? "border-gold/40 bg-gold/5" : "border-line bg-raised/40"
            }`}
          >
            <div className="text-[11px] text-muted">{c.label}</div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${c.big ? "text-gold" : "text-cream"}`}
              dir="ltr"
            >
              {usd(c.v)}
            </div>
          </div>
        ))}
      </div>

      {d.daily.length > 0 && (
        <div className="no-lift rounded-xl border border-line bg-ink/30 p-4">
          <h3 className="text-sm font-bold">روند درآمد</h3>
          <RevenueChart data={d.daily} />
        </div>
      )}

      {/* تفکیک بر اساس نوع */}
      <div>
        <h3 className="mb-2 text-sm font-bold">تفکیک بر اساس نوع</h3>
        <div className="overflow-hidden rounded-xl border border-line text-xs">
          {d.byKind.length === 0 ? (
            <div className="px-4 py-4 text-muted">هنوز درآمدی ثبت نشده.</div>
          ) : (
            d.byKind.map((k, i) => (
              <div
                key={k.kind}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i % 2 ? "bg-surface/30" : "bg-surface/50"
                }`}
              >
                <span>{LABEL[k.kind] ?? k.kind}</span>
                <span className="flex items-center gap-4 font-mono" dir="ltr">
                  <span className="text-muted">{k.n}×</span>
                  <span className={k.total >= 0 ? "text-gain" : "text-loss"}>
                    {usd(k.total)}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* پردرآمدترین بازارها */}
      {d.topMarkets.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">پردرآمدترین بازارها</h3>
          <div className="overflow-hidden rounded-xl border border-line text-xs">
            {d.topMarkets.map((m, i) => (
              <div
                key={m.market_id}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i % 2 ? "bg-surface/30" : "bg-surface/50"
                }`}
              >
                <span className="line-clamp-1 flex-1">
                  <span className="font-mono text-muted" dir="ltr">
                    #{m.market_id}
                  </span>{" "}
                  {m.question ?? "—"}
                </span>
                <span className="shrink-0 font-mono text-gain" dir="ltr">
                  {usd(m.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* بدهی به کاربران */}
      <div className="no-lift rounded-xl border border-line bg-ink/30 p-4">
        <h3 className="text-sm font-bold">وضعیت پول کاربران</h3>
        <p className="mt-2 text-[11px] leading-6 text-muted">
          این اعداد <b className="text-cream">درآمد نیستند</b> — بدهی ما به
          کاربران‌اند. مجموع این دو باید همیشه از تتر واقعی موجود در کیف پول
          درگاه کمتر باشد؛ اختلافشان همان درآمد انباشته‌ی بالاست.
        </p>
        <div className="mt-3 flex flex-wrap gap-6 font-mono text-xs" dir="ltr">
          <span>
            user balances:{" "}
            <b className="text-cream">{usd(d.liabilities.user_balances)}</b>
          </span>
          <span>
            locked in open markets:{" "}
            <b className="text-cream">{usd(d.liabilities.locked_in_markets)}</b>
          </span>
          <span>
            total owed:{" "}
            <b className="text-gold">
              {usd(d.liabilities.user_balances + d.liabilities.locked_in_markets)}
            </b>
          </span>
        </div>
      </div>

      {/* ریز تراکنش‌ها */}
      <div>
        <h3 className="mb-2 text-sm font-bold">
          ریز تراکنش‌ها{" "}
          <span className="font-normal text-muted">(۱۰۰ مورد آخر)</span>
        </h3>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 text-start font-normal">تاریخ</th>
                <th className="px-3 py-2 text-start font-normal">نوع</th>
                <th className="px-3 py-2 text-start font-normal">بازار</th>
                <th className="px-3 py-2 text-start font-normal">کاربر</th>
                <th className="px-3 py-2 text-end font-normal">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-muted">
                    هنوز تراکنشی ثبت نشده.
                  </td>
                </tr>
              ) : (
                d.recent.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? "bg-surface/30" : ""}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {fa(r.created_at)}
                    </td>
                    <td className="px-3 py-2">{LABEL[r.kind] ?? r.kind}</td>
                    <td className="max-w-[240px] px-3 py-2">
                      {r.market_id ? (
                        <span className="line-clamp-1">
                          <span className="font-mono text-muted" dir="ltr">
                            #{r.market_id}
                          </span>{" "}
                          {r.question ?? "—"}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted" dir="ltr">
                      {r.username ? `@${r.username}` : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-end font-mono font-bold ${
                        r.amount >= 0 ? "text-gain" : "text-loss"
                      }`}
                      dir="ltr"
                    >
                      {r.amount >= 0 ? "+" : ""}
                      {usd(r.amount).replace("$-", "-$")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] leading-6 text-muted">
        نرخ فعلی: کمیسیون{" "}
        <b className="text-cream">{Math.round(d.config.commission * 100)}٪</b> از
        حجم استخر هنگام تسویه، و{" "}
        <b className="text-cream">{d.config.proposeFee} تتر</b> بابت ساخت هر
        بازار (اگر بازار رد شود کامل برمی‌گردد و سطر منفی ثبت می‌شود). بازاری که
        به‌خاطر ضریب پایین باطل شود هیچ کمیسیونی ندارد.
      </p>
    </div>
  );
}

/**
 * نمودار درآمد روزانه + خط تجمعی.
 * بدون کتابخانه: فقط چند عدد است و افزودن وابستگی برای آن توجیه ندارد.
 */
function RevenueChart({ data }: { data: { day: string; total: number }[] }) {
  const W = 720;
  const H = 150;
  const pad = 10;
  const maxDay = Math.max(0.01, ...data.map((d) => Math.abs(d.total)));
  const bw = Math.min(30, (W / data.length) * 0.62);

  let run = 0;
  const cum = data.map((d) => (run += d.total));
  const cMax = Math.max(0.01, ...cum);
  const cPts = cum.map((v, i) => {
    const x = ((i + 0.5) / data.length) * W;
    const y = pad + (1 - v / cMax) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const faDay = (s: string) =>
    new Date(s + "T12:00:00Z").toLocaleDateString("fa-IR", {
      timeZone: "Asia/Tehran",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (Math.abs(d.total) / maxDay) * (H - pad * 2);
          const x = ((i + 0.5) / data.length) * W - bw / 2;
          return (
            <rect
              key={d.day}
              x={x}
              y={H - pad - h}
              width={bw}
              height={Math.max(1, h)}
              rx="2"
              fill={d.total >= 0 ? "rgba(62,207,142,0.45)" : "rgba(229,72,77,0.45)"}
            />
          );
        })}
        {cPts.length > 1 && (
          <path
            d={`M ${cPts[0]} L ${cPts.slice(1).join(" L ")}`}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.8"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-muted">
        <span>{faDay(data[0].day)}</span>
        <span className="text-gold">خط طلایی: درآمد تجمعی — {usd(cum[cum.length - 1])}</span>
        <span>{faDay(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}
