"use client";

import { useCallback, useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { IconArrow } from "@/components/tg/icons";
import { haptic } from "@/components/tg/telegram";
import DepositScreen from "@/components/tg/screens/DepositScreen";
import WithdrawScreen from "@/components/tg/screens/WithdrawScreen";
import BuyMoonScreen from "@/components/tg/screens/BuyMoonScreen";

// کیف پول — از همان /api/wallet سایت.
//
// ⚠️ نام فیلدها را از خود روت بگیر، نه از حدس: این روت `at` و `balanceAfter`
// برمی‌گرداند، نه `created_at` و `balance_after`. نسخه‌ی اول همان را اشتباه
// خوانده بود و نتیجه‌اش «Invalid Date» روی تک‌تک ردیف‌های تاریخچه شد.

type Ledger = {
  amount: number;
  kind: string;
  ref: string | null;
  balanceAfter: number;
  at: string;
};

type Wallet = {
  balance: number;
  ledger?: Ledger[];
  address?: string | null;
  network?: string;
  gatewayReady?: boolean;
  telegramLinked?: boolean;
};

const KIND: Record<string, string> = {
  deposit: "واریز",
  withdraw_hold: "برداشت",
  withdraw_refund: "برگشت برداشت",
  ir_bet: "ثبت پیش‌بینی (بازار ایران)",
  ir_payout: "پاداش پیش‌بینی موفق",
  ir_refund: "بازگشت مبلغ پیش‌بینی",
  ir_propose_fee: "کارمزد ایجاد بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  credit_purchase: "خرید MOON",
  admin_adjust: "تنظیم دستی",
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
  });
}

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type View = "main" | "deposit" | "withdraw" | "buy";

export default function WalletScreen() {
  const { data: w, error, reload } = useResource<Wallet>("/api/wallet");
  const [view, setView] = useState<View>("main");

  const back = useCallback(() => setView("main"), []);
  const done = useCallback(() => {
    setView("main");
    reload();
  }, [reload]);

  if (error) return <ErrorState message="اطلاعات کیف پول نیامد." onRetry={reload} />;

  if (w && view === "deposit") {
    return (
      <DepositScreen
        address={w.address ?? null}
        network={w.network ?? "TRON"}
        gatewayReady={Boolean(w.gatewayReady)}
        telegramLinked={w.telegramLinked !== false}
        onBack={back}
      />
    );
  }
  if (w && view === "withdraw") {
    return (
      <WithdrawScreen
        balance={w.balance}
        network={w.network ?? "TRON"}
        onBack={back}
        onDone={done}
      />
    );
  }
  if (w && view === "buy") {
    return <BuyMoonScreen balance={w.balance} onBack={back} onDone={done} />;
  }

  if (!w) {
    return (
      <div>
        <ScreenTitle title="کیف پول" />
        <Skeleton className="h-36" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
        <Skeleton className="mt-5 h-16" />
        <Skeleton className="mt-2 h-16" />
      </div>
    );
  }

  const ledger = w.ledger ?? [];

  return (
    <div>
      <ScreenTitle title="کیف پول" />

      {/* کارت موجودی: تنها جای صفحه که طلا پرکننده است، تا چشم اول اینجا برود */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-bl from-gold/12 via-surface/60 to-surface/40 p-5">
        <div className="text-[11px] text-muted">موجودی تتر</div>
        <div dir="ltr" className="mt-1.5 text-right font-mono text-[34px] font-bold leading-none text-gold">
          ${money(w.balance)}
        </div>
        <div className="mt-2 text-[10px] text-muted">
          شبکه‌ی {w.network ?? "TRON"}
        </div>
        {/* درخشش ملایم گوشه — عمق می‌دهد بدون اینکه تصویر لازم باشد */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => {
            haptic.press();
            setView("deposit");
          }}
          className="rounded-xl border border-gain/30 bg-gain/10 py-3 text-xs font-bold text-gain transition active:border-gain"
        >
          واریز
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.press();
            setView("withdraw");
          }}
          className="rounded-xl border border-line bg-surface/40 py-3 text-xs font-bold text-cream transition active:border-gold"
        >
          برداشت
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.press();
            setView("buy");
          }}
          className="rounded-xl border border-gold/30 bg-gold/10 py-3 text-xs font-bold text-gold transition active:border-gold"
        >
          خرید MOON
        </button>
      </div>

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <h3 className="text-xs font-bold text-cream">تاریخچه</h3>
        <span className="text-[10px] text-muted">{ledger.length} تراکنش</span>
      </div>

      {ledger.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface/30 p-4 text-center text-[11px] text-muted">
          هنوز تراکنشی نداری.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ledger.slice(0, 40).map((l, i) => {
            const inflow = l.amount >= 0;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface/30 px-3 py-2.5"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    inflow ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
                  }`}
                >
                  <IconArrow up={!inflow} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-bold text-cream">
                    {KIND[l.kind] ?? l.kind}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted">{when(l.at)}</div>
                </div>

                <div className="text-left">
                  <div
                    dir="ltr"
                    className={`font-mono text-[12.5px] font-bold ${
                      inflow ? "text-gain" : "text-loss"
                    }`}
                  >
                    {inflow ? "+" : "−"}${money(Math.abs(l.amount))}
                  </div>
                  <div dir="ltr" className="mt-0.5 font-mono text-[9.5px] text-muted">
                    ${money(l.balanceAfter)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
