"use client";

import { useCallback, useState } from "react";
import { ledgerLabel } from "@/lib/ledger-labels";
import { useResource } from "@/components/tg/useResource";
import { ErrorState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import {
  IconArrow,
  IconDeposit,
  IconMoon,
  IconWithdraw,
} from "@/components/tg/icons";
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
  /** مجموع قابل خرج: واقعی + دمو. */
  balance: number;
  /** فقط پول واقعی — تنها چیزی که می‌شود برداشت کرد. */
  withdrawable?: number;
  demoBalance?: number;
  ledger?: Ledger[];
  address?: string | null;
  network?: string;
  gatewayReady?: boolean;
  telegramLinked?: boolean;
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

// رنگ هر کنش معنی دارد: سبز پول به داخل، خنثی پول به بیرون، طلایی خرجِ
// درون‌پلتفرمی. همان قراردادی که در کل اپ برای سود و زیان به کار می‌رود.
const ACTIONS: {
  view: Exclude<View, "main">;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  ring: string;
}[] = [
  {
    view: "deposit",
    label: "واریز",
    Icon: IconDeposit,
    ring: "border-gain/40 bg-gain/10 text-gain active:border-gain",
  },
  {
    view: "withdraw",
    label: "برداشت",
    Icon: IconWithdraw,
    ring: "border-line bg-surface/50 text-cream active:border-gold",
  },
  {
    view: "buy",
    label: "خرید MOON",
    Icon: IconMoon,
    ring: "border-gold/40 bg-gold/10 text-gold active:border-gold",
  },
];

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
        balance={w.withdrawable ?? w.balance}
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
        {/* اسکلت باید شکل چیزی را بگیرد که قرار است بیاید، وگرنه صفحه موقع
            آمدن داده می‌پرد. سه دایره، نه دو مستطیل. */}
        <Skeleton className="h-[132px]" />
        <div className="mt-5 flex justify-center gap-6">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-8 h-16" />
        <Skeleton className="mt-2 h-16" />
      </div>
    );
  }

  const ledger = w.ledger ?? [];

  return (
    <div>
      <ScreenTitle title="کیف پول" />

      {/* کارت موجودی: تنها جای صفحه که طلا پرکننده است، تا چشم اول اینجا برود.
          وسط‌چین است نه چپ‌چین — در صفحه‌ای که کاربر برای دیدن *یک عدد* باز
          می‌کند، آن عدد باید مرکز ثقل باشد، نه یک خط از یک کارت. */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/12 via-surface/60 to-surface/40 px-5 py-7 text-center">
        <div className="text-[11px] text-muted">موجودی تتر</div>
        <div
          dir="ltr"
          className="mt-2 font-mono text-[42px] font-bold leading-none text-gold"
        >
          ${money(w.balance)}
        </div>
        {/* اگر بخشی از موجودی بونوس است، همین‌جا گفته می‌شود — نه در لحظه‌ی
            برداشت. کاربری که عدد بزرگ می‌بیند و بعد «موجودی کافی نیست»
            می‌گیرد، فکر می‌کند سیستم خراب است یا پولش را خورده‌ایم. */}
        {(w.demoBalance ?? 0) > 0 && (
          <div className="mt-2 text-[10px] leading-5 text-muted">
            شامل{" "}
            <span dir="ltr" className="font-mono text-gold/80">
              ${money(w.demoBalance ?? 0)}
            </span>{" "}
            هدیه — با آن پیش‌بینی می‌کنید، ولی فقط سودش قابل برداشت است.
            <br />
            قابل برداشت:{" "}
            <span dir="ltr" className="font-mono text-cream">
              ${money(w.withdrawable ?? 0)}
            </span>
          </div>
        )}
        <div className="mt-2.5 text-[10px] text-muted">شبکه‌ی {w.network ?? "TRON"}</div>
        {/* درخشش ملایم گوشه — عمق می‌دهد بدون اینکه تصویر لازم باشد */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
      </div>

      {/* سه کنش، دایره‌ای و وسط‌چین.
          دایره‌ی آیکون از برچسبش جداست تا هدفِ لمس گرد بماند ولی متن زیرش
          جا داشته باشد؛ برچسب داخل دایره یعنی یا دایره بزرگ می‌شود یا متن
          کوچک و ناخوانا. */}
      <div className="mt-5 flex items-start justify-center gap-6">
        {ACTIONS.map((a) => (
          <button
            key={a.view}
            type="button"
            onClick={() => {
              haptic.press();
              setView(a.view);
            }}
            className="flex w-20 flex-col items-center gap-2"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition active:scale-95 ${a.ring}`}
            >
              <a.Icon />
            </span>
            <span className="text-[10.5px] font-bold text-muted">{a.label}</span>
          </button>
        ))}
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
                    {ledgerLabel(l.kind)}
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
