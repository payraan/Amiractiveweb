"use client";

import { useEffect } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, EmptyState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { showBackButton, haptic } from "@/components/tg/telegram";
import { remaining } from "@/lib/dates";
import { IR_CATEGORIES } from "@/lib/ir-categories";

// درآمد بازارساز.
//
// ⚠️ **دو عدد، نه یکی.** سهم سازنده با هر شرط بالا می‌رود ولی فقط سر تسویه
// پرداخت می‌شود. اگر یک عدد نشان داده شود، سازنده مبلغی می‌بیند که در کیف
// پولش نیست و فکر می‌کند پولش را خورده‌ایم. «در انتظار تسویه» و «پرداخت‌شده»
// جدا می‌مانند و توضیحشان همان‌جاست، نه در یک صفحه‌ی راهنمای دیگر.

type Market = {
  id: number;
  question: string;
  category: string;
  status: string;
  bettors: number;
  pool: number;
  accrued: number;
  settled: boolean;
  closesAt: string;
};

type Res = {
  demo: boolean;
  markets: Market[];
  summary: {
    count: number;
    open: number;
    totalBettors: number;
    totalVolume: number;
    accrued: number;
    pending: number;
    paid: number;
    payouts: number;
  };
  rates: { referred: number; other: number };
};

const CAT = Object.fromEntries(IR_CATEGORIES.map((c) => [c.id, c.label]));
const fa = (n: number) => n.toLocaleString("fa-IR");
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "در انتظار تأیید", cls: "text-muted" },
  open: { label: "باز", cls: "text-gain" },
  locked: { label: "بسته", cls: "text-gold" },
  settling: { label: "پنجره‌ی اعتراض", cls: "text-gold" },
  settled: { label: "تسویه‌شده", cls: "text-muted" },
  void: { label: "باطل", cls: "text-muted" },
};

export default function MyMarketsScreen({
  onBack,
  onOpenMarket,
}: {
  onBack: () => void;
  onOpenMarket: (id: number) => void;
}) {
  const { data, error, reload } = useResource<Res>("/api/ir/my-markets");
  useEffect(() => showBackButton(onBack), [onBack]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const s = data.summary;
  const unit = data.demo ? "تتر مجازی" : "تتر";

  return (
    <div className="flex flex-col gap-3">
      <ScreenTitle
        title="بازارهای من"
        subtitle={`سهم تو: ${fa(Math.round(data.rates.referred * 100))}٪ از دعوت‌شده‌های خودت، ${fa(
          data.rates.other * 100
        )}٪ از بقیه`}
      />

      {s.count === 0 ? (
        <EmptyState
          title="هنوز بازاری نساخته‌ای"
          hint="از تب بازار ایران، دکمه‌ی «ساخت بازار» را بزن. از هر پیش‌بینی که روی بازارت ثبت شود سهم می‌گیری."
        />
      ) : (
        <>
          {/* ── دو عدد اصلی ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-center">
              <div className="text-[10px] text-muted">در انتظار تسویه</div>
              <div className="mt-1 font-display text-xl font-black text-gold" dir="ltr">
                ${money(s.pending)}
              </div>
              <div className="mt-1 text-[9.5px] leading-4 text-muted">
                روی بازارهای باز — با هر پیش‌بینی تازه بالا می‌رود
              </div>
            </div>
            <div className="rounded-2xl border border-gain/30 bg-gain/5 p-4 text-center">
              <div className="text-[10px] text-muted">پرداخت‌شده</div>
              <div className="mt-1 font-display text-xl font-black text-gain" dir="ltr">
                ${money(s.paid)}
              </div>
              <div className="mt-1 text-[9.5px] leading-4 text-muted">
                {fa(s.payouts)} پرداخت — در کیف پولت است
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Mini label="بازار" v={fa(s.count)} />
            <Mini label="شرکت‌کننده" v={fa(s.totalBettors)} />
            <Mini label="حجم کل" v={`$${money(s.totalVolume)}`} />
          </div>

          <p className="px-1 text-[10px] leading-5 text-muted">
            سهم سازنده <b className="text-cream">از استخر</b> برداشته می‌شود، نه از
            جیب پلتفرم — پس با رشد بازارت بزرگ می‌شود. واحد: {unit}.
          </p>

          {/* ── فهرست بازارها ── */}
          <div className="mt-1 flex flex-col gap-2">
            {data.markets.map((m) => {
              const st = STATUS[m.status] ?? { label: m.status, cls: "text-muted" };
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    haptic.tap();
                    onOpenMarket(m.id);
                  }}
                  className="rounded-xl border border-line bg-surface/30 p-3 text-start transition active:bg-surface/60"
                >
                  <div className="line-clamp-2 text-[11.5px] leading-5 text-cream">
                    {m.question}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted">
                      {CAT[m.category] ?? m.category} · {fa(m.bettors)} نفر ·{" "}
                      <span className={st.cls}>{st.label}</span>
                      {m.status === "open" && ` · ${remaining(m.closesAt)}`}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[12px] font-bold ${
                        m.settled ? "text-gain" : "text-gold"
                      }`}
                      dir="ltr"
                    >
                      ${money(m.accrued)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="px-1 pb-2 text-[9.5px] leading-5 text-muted">
            عدد <span className="text-gold">طلایی</span> هنوز پرداخت نشده و تا
            تسویه‌ی بازار ممکن است بالا برود. عدد{" "}
            <span className="text-gain">سبز</span> نهایی است و در کیف پولت نشسته.
          </p>
        </>
      )}
    </div>
  );
}

function Mini({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/30 px-2 py-2.5 text-center">
      <div className="text-[9.5px] text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[12.5px] font-bold text-cream" dir="ltr">
        {v}
      </div>
    </div>
  );
}
