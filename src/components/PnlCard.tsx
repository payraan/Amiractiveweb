"use client";

import { useState } from "react";

// کارت سود و زیان تتری — بازار ایران.
//
// ── چرا کارت جدا و نه چند عدد پراکنده ──
// این اعداد تا امروز به‌شکل سه «Metric» کنار هم بودند و مثل بقیه‌ی آمار
// خوانده می‌شدند. ولی این تنها جایی از پلتفرم است که **پول واقعی** را
// گزارش می‌کند؛ اگر مثل امتیاز دیده شود، کاربر نمی‌فهمد کدام عدد پول است و
// کدام بازی.
//
// ── چرا دو بازه ──
// «از ابتدا» عدد حقیقیِ حساب است و باید همیشه در دسترس باشد. ولی برای کسی
// که تازه شروع کرده و یک ماه بد داشته، تنها عددِ قابلِ دیدن است و دلسرد
// می‌کند. «۳۰ روز» می‌گوید همین حالا کجاست. هیچ‌کدام جای دیگری را نمی‌گیرد.
//
// ⚠️ این کارت **خصوصی** است و دکمه‌ی اشتراک ندارد. کارت اشتراکی عمومی
// عمدا مهارت را نشان می‌دهد نه مبلغ: «از پیش‌بینی پول دربیار» خط قرمز برند
// است، و یک اسکرین‌شات از سود دقیقا همان پیام را می‌دهد.

export type PnlSlice = {
  settledBets: number;
  won: number;
  lost: number;
  refunded: number;
  staked: number;
  returned: number;
  net: number;
  winRate: number | null;
};

const money = (n: number) =>
  Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fa = (n: number) => n.toLocaleString("fa-IR");
const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${money(n)}`;

export default function PnlCard({
  allTime,
  last30,
  deposited,
  withdrawn,
  locked,
  openBets,
}: {
  allTime: PnlSlice;
  last30: PnlSlice;
  deposited: number;
  withdrawn: number;
  locked: number;
  openBets: number;
}) {
  const [range, setRange] = useState<"all" | "30">("all");
  const s = range === "all" ? allTime : last30;

  const empty = s.settledBets === 0;
  const up = s.net >= 0;

  return (
    <div className="rounded-2xl border border-line bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold text-cream">سود و زیان تتری</h3>
        <div className="flex gap-1">
          {(
            [
              ["all", "از ابتدا"],
              ["30", "۳۰ روز"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] transition ${
                range === id
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-line text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        // ⚠️ حالت خالی توضیح می‌دهد، نه اینکه صفر نشان بدهد. «$۰.۰۰» به کسی
        // که هنوز پیش‌بینی نکرده می‌گوید «چیزی از دست دادی» — که غلط است.
        <p className="py-4 text-center text-[11px] leading-6 text-muted">
          {range === "30"
            ? "در ۳۰ روز گذشته پیش‌بینی تسویه‌شده‌ای نداشتی."
            : "هنوز پیش‌بینی تسویه‌شده‌ای نداری. با اولین بازار که تعیین تکلیف شود، این کارت پر می‌شود."}
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] text-muted">سود خالص</div>
              <div
                className={`font-display text-2xl font-black ${
                  up ? "text-gain" : "text-loss"
                }`}
                dir="ltr"
              >
                {signed(s.net)}
              </div>
            </div>
            <div className="text-end">
              <div className="text-[10px] text-muted">درصد موفقیت</div>
              <div
                className={`font-mono text-lg font-bold ${
                  s.winRate !== null && s.winRate >= 50 ? "text-gain" : "text-cream"
                }`}
                dir="ltr"
              >
                {s.winRate === null ? "—" : `${s.winRate}%`}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <Cell label="درست" v={fa(s.won)} tone="gain" />
            <Cell label="نادرست" v={fa(s.lost)} tone="muted" />
            <Cell label="برگشتی" v={fa(s.refunded)} tone="muted" />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
            <Cell label="کل پیش‌بینی" v={`$${money(s.staked)}`} />
            <Cell label="کل دریافتی" v={`$${money(s.returned)}`} />
          </div>
        </>
      )}

      {/* ── جریان پول کیف، مستقل از بازه ──
          عمدا پایین و جدا: واریز و برداشت «سود» نیستند، جابه‌جایی پول‌اند.
          قاطی‌کردنشان با سود خالص، همان اشتباهی است که کاربر خودش هم
          می‌کند و کارت باید جلویش را بگیرد. */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1.5 text-[10px] text-muted">
          جریان کیف پول — مستقل از سود و زیان
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <Cell label="کل واریز" v={`$${money(deposited)}`} />
          <Cell label="کل برداشت" v={`$${money(withdrawn)}`} />
        </div>
        {openBets > 0 && (
          <p className="mt-2 text-[10px] text-gold">
            ${money(locked)} روی {fa(openBets)} پیش‌بینیِ باز قفل است — پس از
            تسویه در همین کارت می‌آید.
          </p>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  v,
  tone,
}: {
  label: string;
  v: string;
  tone?: "gain" | "muted";
}) {
  const c =
    tone === "gain" ? "text-gain" : tone === "muted" ? "text-muted" : "text-cream";
  return (
    <div className="rounded-lg border border-line bg-ink/30 px-2 py-2">
      <div className="text-[9.5px] text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-[12.5px] font-bold ${c}`} dir="ltr">
        {v}
      </div>
    </div>
  );
}
