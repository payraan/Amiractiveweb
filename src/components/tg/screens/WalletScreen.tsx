"use client";

import { useResource } from "@/components/tg/useResource";
import { Card, ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";

// کیف پول — از همان /api/wallet سایت.
//
// واریز و برداشت در مرحله‌ی بعد اضافه می‌شوند؛ برداشت هنوز منتظر تصمیم
// مالک درباره‌ی لایه‌ی تأیید دوم است.

type Ledger = {
  amount: number;
  kind: string;
  ref: string | null;
  balance_after: number;
  created_at: string;
};

type Wallet = {
  balance: number;
  ledger?: Ledger[];
  address?: string | null;
  network?: string;
  gatewayReady?: boolean;
};

const KIND: Record<string, string> = {
  deposit: "واریز",
  withdraw_hold: "برداشت",
  withdraw_refund: "برگشت برداشت",
  ir_bet: "شرط بازار ایران",
  ir_payout: "برد بازار ایران",
  ir_refund: "برگشت شرط",
  ir_propose_fee: "هزینه‌ی ساخت بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  credit_purchase: "خرید MOON",
  admin_adjust: "تنظیم دستی",
};

const fa = (iso: string) =>
  new Date(iso).toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
  });

export default function WalletScreen() {
  const { data: w, error, reload } = useResource<Wallet>("/api/wallet");

  if (error) return <ErrorState message="اطلاعات کیف پول نیامد." onRetry={reload} />;

  if (!w) {
    return (
      <div>
        <ScreenTitle title="کیف پول" />
        <Skeleton className="h-24" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const ledger = w.ledger ?? [];

  return (
    <div>
      <ScreenTitle title="کیف پول" subtitle="موجودی تتر و تاریخچه" />

      <Card className="text-center">
        <div className="text-[10px] text-muted">موجودی</div>
        <div dir="ltr" className="mt-1 font-mono text-3xl font-bold text-gold">
          ${w.balance.toFixed(2)}
        </div>
      </Card>

      <p className="mt-4 rounded-xl border border-line bg-surface/30 p-3 text-[11px] leading-6 text-muted">
        واریز و برداشت به‌زودی همین‌جا اضافه می‌شود. تا آن‌وقت از کیف پول سایت
        استفاده کن.
      </p>

      <h3 className="mb-2 mt-5 text-xs font-bold text-cream">تاریخچه</h3>
      {ledger.length === 0 ? (
        <p className="text-[11px] text-muted">هنوز تراکنشی نداری.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ledger.slice(0, 30).map((l, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-line bg-surface/30 px-3 py-2.5"
            >
              <div>
                <div className="text-[11px] font-bold text-cream">
                  {KIND[l.kind] ?? l.kind}
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  {fa(l.created_at)}
                </div>
              </div>
              <div
                dir="ltr"
                className={`font-mono text-[12px] ${
                  l.amount >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {l.amount >= 0 ? "+" : ""}
                {l.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
