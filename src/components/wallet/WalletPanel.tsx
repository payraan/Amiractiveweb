"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import { MIN_WITHDRAW, withdrawAddressShapeValid } from "@/lib/wallet-rules";

type Ledger = {
  amount: number;
  kind: string;
  ref: string | null;
  balanceAfter: number;
  at: string;
};

type Data = {
  balance: number;
  network: string;
  address: string | null;
  addressError: string | null;
  gatewayReady: boolean;
  telegramLinked: boolean;
  ledger: Ledger[];
};

/** برچسب فارسی هر نوع تراکنش در دفترکل */
const KIND: Record<string, { label: string; tone: "in" | "out" }> = {
  deposit: { label: "واریز", tone: "in" },
  withdraw_hold: { label: "برداشت", tone: "out" },
  withdraw_refund: { label: "بازگشت برداشت", tone: "in" },
  ir_bet: { label: "ثبت پیش‌بینی (بازار ایران)", tone: "out" },
  ir_payout: { label: "پاداش پیش‌بینی موفق", tone: "in" },
  ir_refund: { label: "بازگشت مبلغ پیش‌بینی", tone: "in" },
};

const ERR: Record<string, string> = {
  telegram_required:
    "برای هر عملیات مالی باید حساب تلگرامت را وصل کنی. از صفحه‌ی دعوت وصلش کن یا مینی‌اپ را باز کن.",
  gateway_off: "درگاه پرداخت هنوز فعال نشده است.",
  amount_too_low: "مبلغ کمتر از حداقل برداشت است.",
  bad_address: "آدرس مقصد معتبر نیست.",
  insufficient_funds: "موجودی کافی نیست.",
  not_authed: "ابتدا وارد شوید.",
};

const fa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function WalletPanel() {
  const { player, loading: pLoading } = usePlayer();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [copied, setCopied] = useState(false);

  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/wallet", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setD(j);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (player) load();
    else if (!pLoading) setLoading(false);
  }, [player, pLoading, load]);

  async function copy() {
    if (!d?.address) return;
    try {
      await navigator.clipboard.writeText(d.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* کلیپ‌بورد در دسترس نبود */
    }
  }

  async function withdraw() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), toAddress: toAddress.trim() }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ ok: false, text: ERR[j.error] ?? `خطا: ${j.error}` });
        return;
      }
      setMsg({
        ok: true,
        text: "درخواست برداشت ثبت شد. پس از تأیید شبکه، به آدرس شما واریز می‌شود.",
      });
      setAmount("");
      setToAddress("");
      await load();
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  if (pLoading || loading) {
    return <p className="py-16 text-center text-xs text-muted">در حال بارگذاری…</p>;
  }

  if (!player) {
    return (
      <div className="rounded-2xl border border-line bg-surface/40 p-10 text-center">
        <p className="text-sm text-muted">برای دسترسی به کیف پول وارد شوید.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink"
        >
          ورود / ثبت‌نام
        </Link>
      </div>
    );
  }

  const network = d?.network ?? "TRON";
  const addressOk = withdrawAddressShapeValid(toAddress, network);
  const withdrawOk =
    Number(amount) >= MIN_WITHDRAW &&
    Number(amount) <= (d?.balance ?? 0) &&
    addressOk;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      {/* ── ستون راست: موجودی و عملیات ── */}
      <div>
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
          <div className="text-[11px] text-muted">موجودی کیف پول</div>
          <div className="mt-2 font-mono text-4xl font-black text-gold" dir="ltr">
            ${(d?.balance ?? 0).toFixed(2)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
            USDT · {d?.network ?? "TRON"}
          </div>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-line bg-raised/40 p-1">
          {(
            [
              { id: "deposit" as const, label: "واریز" },
              { id: "withdraw" as const, label: "برداشت" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setMsg(null);
              }}
              className={`no-zoom flex-1 rounded-lg py-2.5 text-xs font-bold transition ${
                tab === t.id ? "bg-gold text-ink" : "text-muted hover:text-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* واریز */}
        {tab === "deposit" && (
          <div className="mt-4 rounded-2xl border border-line bg-surface/40 p-5">
            {!d?.gatewayReady ? (
              <p className="py-6 text-center text-[12px] leading-7 text-muted">
                درگاه پرداخت هنوز فعال نشده است. پس از فعال‌سازی، آدرس واریز
                اختصاصی شما اینجا نمایش داده می‌شود.
              </p>
            ) : d.address ? (
              <>
                <div className="text-[11px] text-muted">
                  آدرس واریز اختصاصی شما ({d.network})
                </div>
                <div
                  className="mt-2 break-all rounded-xl border border-line bg-ink/50 px-4 py-3 font-mono text-[12px] leading-6 text-cream"
                  dir="ltr"
                >
                  {d.address}
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className="mt-3 w-full rounded-xl border border-gold/40 py-2.5 text-xs text-gold transition hover:bg-gold hover:text-ink"
                >
                  {copied ? "کپی شد ✓" : "کپی آدرس"}
                </button>

                <div className="mt-4 rounded-xl border border-loss/30 bg-loss/5 p-4">
                  <h4 className="text-[11px] font-bold text-loss">قبل از واریز</h4>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-6 text-muted">
                    <li>• فقط <b className="text-cream">USDT</b> روی شبکه‌ی{" "}
                      <b className="text-cream">{d.network}</b> بفرستید. ارز یا شبکه‌ی
                      دیگر قابل بازگشت نیست.
                    </li>
                    <li>• این آدرس مخصوص حساب شماست و تغییر نمی‌کند.</li>
                    <li>• پس از تأیید شبکه، موجودی خودکار شارژ می‌شود. معمولاً چند
                      دقیقه طول می‌کشد.
                    </li>
                  </ul>
                </div>
              </>
            ) : !d.telegramLinked ? (
              // پیام قبلی «دریافت آدرس واریز ممکن نشد» بود و هیچ نمی‌گفت چرا و
              // چه باید کرد. علتِ واقعی تقریبا همیشه همین است: حساب هنوز به
              // تلگرام وصل نشده. حالا هم دلیل گفته می‌شود، هم راهش یک کلیک است.
              <div className="py-6 text-center">
                <p className="text-[12px] leading-7 text-cream">
                  برای دریافت آدرس واریز و استفاده از امکانات سایت، لطفاً ابتدا
                  حساب تلگرام خود را متصل کنید.
                </p>
                <a
                  href="/referral#telegram"
                  className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 text-xs font-bold text-ink transition hover:bg-gold-deep"
                >
                  اتصال حساب تلگرام
                </a>
              </div>
            ) : (
              <p className="py-6 text-center text-[12px] leading-7 text-loss">
                دریافت آدرس واریز ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید.
                {d.addressError && (
                  <span className="mt-1 block font-mono text-[10px] text-muted" dir="ltr">
                    {d.addressError}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* برداشت */}
        {tab === "withdraw" && (
          <div className="mt-4 rounded-2xl border border-line bg-surface/40 p-5">
            <label className="block text-[11px] text-muted">مبلغ (تتر)</label>
            <input
              type="number"
              inputMode="decimal"
              dir="ltr"
              min={MIN_WITHDRAW}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`حداقل ${MIN_WITHDRAW}`}
              className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-2.5 font-mono text-sm text-cream focus:border-gold focus:outline-none"
            />
            <div className="mt-2 flex gap-1.5">
              {[25, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setAmount((((d?.balance ?? 0) * p) / 100).toFixed(2))
                  }
                  className="flex-1 rounded-lg border border-line py-1.5 font-mono text-[10px] text-muted transition hover:border-gold/40 hover:text-cream"
                >
                  {p}%
                </button>
              ))}
            </div>

            <label className="mt-4 block text-[11px] text-muted">
              آدرس مقصد ({network})
            </label>
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              dir="ltr"
              placeholder="T..."
              className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-2.5 font-mono text-[12px] text-cream focus:border-gold focus:outline-none"
            />
            {toAddress.trim().length > 0 && !addressOk && (
              <p className="mt-1.5 text-[10px] leading-5 text-loss">
                این آدرس با شبکه‌ی {network} نمی‌خواند. آدرس تتر روی این شبکه با
                «T» شروع می‌شود و ۳۴ کاراکتر است.
              </p>
            )}

            <button
              type="button"
              disabled={busy || !withdrawOk || !d?.gatewayReady}
              onClick={withdraw}
              className="mt-5 w-full rounded-xl bg-gold py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-40"
            >
              {busy ? "…" : "درخواست برداشت"}
            </button>

            {msg && (
              <p className={`mt-3 text-[11px] leading-6 ${msg.ok ? "text-gain" : "text-loss"}`}>
                {msg.text}
              </p>
            )}

            <p className="mt-3 text-[10px] leading-6 text-muted">
              آدرس مقصد را با دقت بررسی کنید. تراکنش‌های بلاکچین برگشت‌پذیر نیستند و
              ارسال به آدرس اشتباه قابل جبران نیست.
            </p>
          </div>
        )}
      </div>

      {/* ── ستون چپ: تاریخچه ── */}
      <div className="rounded-2xl border border-line bg-surface/40 p-5">
        <h2 className="font-display text-sm font-extrabold">تاریخچه‌ی تراکنش‌ها</h2>

        {!d || d.ledger.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted">
            هنوز تراکنشی ثبت نشده است.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-2 py-2.5 text-start font-bold">نوع</th>
                  <th className="px-2 py-2.5 text-start font-bold">مبلغ</th>
                  <th className="px-2 py-2.5 text-start font-bold">موجودی پس از آن</th>
                  <th className="px-2 py-2.5 text-start font-bold">مرجع</th>
                  <th className="px-2 py-2.5 text-start font-bold">زمان</th>
                </tr>
              </thead>
              <tbody>
                {d.ledger.map((l, i) => {
                  const meta = KIND[l.kind] ?? { label: l.kind, tone: "in" as const };
                  const pos = l.amount >= 0;
                  return (
                    <tr key={i} className={i % 2 ? "bg-ink/20" : ""}>
                      <td className="px-2 py-2.5 text-cream">{meta.label}</td>
                      <td
                        className={`px-2 py-2.5 font-mono ${pos ? "text-gain" : "text-loss"}`}
                        dir="ltr"
                      >
                        {pos ? "+" : ""}
                        {l.amount.toFixed(2)}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-muted" dir="ltr">
                        ${l.balanceAfter.toFixed(2)}
                      </td>
                      <td
                        className="max-w-[140px] truncate px-2 py-2.5 font-mono text-[10px] text-muted"
                        dir="ltr"
                      >
                        {l.ref ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted">
                        {fa(l.at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
