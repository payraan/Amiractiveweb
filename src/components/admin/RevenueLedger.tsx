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
    config: { commission: number; proposeFee: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/revenue", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setD(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
