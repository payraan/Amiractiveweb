"use client";

import { useEffect, useState } from "react";

// ── کارنامه‌ی پیش‌بینی‌های بازار ایران ────────────────────────
//
// تا امروز کاربر هیچ‌جا نمی‌دید در کدام بازار چقدر گذاشته و چه شده. در بازی
// امتیازی می‌شود از آن گذشت، ولی اینجا پول واقعی است — کاربری که نتواند
// حساب خودش را ببیند به پلتفرم اعتماد نمی‌کند، و حق دارد.
//
// اصل طراحی: هیچ عددی پنهان نشود. اصل، پاداش، سود خالص و سهم بونوس همه
// جدا نوشته می‌شوند، چون همین‌ها هستند که کاربر بعدا می‌خواهد با موجودی‌اش
// تطبیق بدهد.

type Bet = {
  marketId: number;
  question: string;
  marketStatus: string;
  outcome: string | null;
  voidReason: string | null;
  side: string;
  stake: number;
  demoStake: number;
  status: string;
  payout: number | null;
  net: number | null;
  createdAt: string;
};

type Summary = {
  total: number;
  open: number;
  won: number;
  lost: number;
  refunded: number;
  lockedStake: number;
  settledStake: number;
  settledReturn: number;
  net: number;
};

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "open", label: "در جریان" },
  { id: "closed", label: "تمام‌شده" },
] as const;

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** برچسب و رنگ هر وضعیت — یک جا، تا سه جور نوشته نشود. */
function statusOf(b: Bet): { label: string; cls: string } {
  if (b.status === "won") return { label: "برنده", cls: "text-gain" };
  if (b.status === "lost") return { label: "نتیجه‌ی دیگر", cls: "text-loss" };
  if (b.status === "refunded") return { label: "برگشت خورد", cls: "text-muted" };
  if (b.marketStatus === "locked") return { label: "بسته، منتظر نتیجه", cls: "text-gold" };
  return { label: "در جریان", cls: "text-cream" };
}

export default function MyBets({ reloadKey }: { reloadKey?: number }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [load, setLoad] = useState(true);
  const [authed, setAuthed] = useState(true);

  // ⚠️ خواندن عمدا داخل خود effect است و نه در یک useCallback بیرونی: هر
  // setState اینجا **پس از** await اجرا می‌شود، پس رندر آبشاری نمی‌سازد.
  // پرچم `alive` هم جلوی نشستن پاسخِ دیررسیده روی کامپوننتِ رفته را می‌گیرد
  // — با عوض‌کردن سریع فیلتر، پاسخِ کند می‌توانست نتیجه‌ی تازه را پس بزند.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/ir/my-bets?filter=${filter}`, {
          cache: "no-store",
        });
        if (!alive) return;
        if (r.status === 401) {
          setAuthed(false);
          return;
        }
        const j = await r.json();
        if (!alive) return;
        if (j.ok) {
          setBets(j.bets);
          setSum(j.summary);
          setAuthed(true);
        }
      } catch {
        /* شبکه قطع — دفعه‌ی بعد */
      } finally {
        if (alive) setLoad(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter, reloadKey]);

  if (!authed) return null;

  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
        <span className="text-[11px] font-bold text-cream">پیش‌بینی‌های من</span>
        {sum && (
          <span className="font-mono text-[10px] text-gold" dir="ltr">
            {sum.total}
          </span>
        )}
        <div className="ms-auto flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`no-zoom shrink-0 rounded px-2.5 py-1 text-[10px] transition ${
                filter === f.id
                  ? "bg-gold/15 text-gold"
                  : "text-muted hover:text-cream"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── جمع‌بندی ──
          «قفل‌شده» جدا از «سود خالص» است: کاربر باید بتواند این دو را با
          موجودی کیف پولش جمع بزند و به عدد درست برسد. */}
      {sum && sum.total > 0 && (
        <div className="grid grid-cols-2 gap-px border-b border-line bg-line md:grid-cols-4">
          {[
            { k: "در جریان", v: `$${money(sum.lockedStake)}`, cls: "text-cream" },
            { k: "جمع پیش‌بینی‌های تمام‌شده", v: `$${money(sum.settledStake)}`, cls: "text-cream" },
            { k: "جمع دریافتی", v: `$${money(sum.settledReturn)}`, cls: "text-cream" },
            {
              k: "سود خالص",
              v: `${sum.net >= 0 ? "+" : "−"}$${money(Math.abs(sum.net))}`,
              cls: sum.net > 0 ? "text-gain" : sum.net < 0 ? "text-loss" : "text-muted",
            },
          ].map((c) => (
            <div key={c.k} className="bg-surface/40 px-3 py-2.5">
              <div className="text-[10px] text-muted">{c.k}</div>
              <div className={`mt-0.5 font-mono text-sm font-bold ${c.cls}`} dir="ltr">
                {c.v}
              </div>
            </div>
          ))}
        </div>
      )}

      {bets.length === 0 ? (
        // پنل خالی = پنل نامرئی. حالت خالی باید بگوید چرا خالی است.
        <p className="py-10 text-center text-[11px] leading-6 text-muted">
          {load
            ? "در حال بارگذاری…"
            : filter === "all"
              ? "هنوز در هیچ بازاری پیش‌بینی نکرده‌ای."
              : "در این دسته چیزی نیست."}
        </p>
      ) : (
        <div className="divide-y divide-line">
          {bets.map((b) => {
            const st = statusOf(b);
            return (
              <a
                key={`${b.marketId}-${b.createdAt}`}
                href={`/iran/m/${b.marketId}`}
                className="block px-3 py-3 transition hover:bg-surface/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 flex-1 text-[11.5px] leading-6 text-cream">
                    {b.question}
                  </p>
                  <span className={`shrink-0 text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div
                  className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]"
                  dir="ltr"
                >
                  <span
                    className={b.side === "yes" ? "text-gain" : "text-loss"}
                  >
                    {b.side === "yes" ? "بله" : "خیر"}
                  </span>
                  <span className="text-muted">
                    اصل ${money(b.stake)}
                  </span>
                  {b.demoStake > 0 && (
                    <span className="text-gold/80">
                      (${money(b.demoStake)} هدیه)
                    </span>
                  )}
                  {b.payout !== null && (
                    <span className="text-muted">
                      دریافتی ${money(b.payout)}
                    </span>
                  )}
                  {b.net !== null && (
                    <span
                      className={`font-bold ${
                        b.net > 0
                          ? "text-gain"
                          : b.net < 0
                            ? "text-loss"
                            : "text-muted"
                      }`}
                    >
                      {b.net >= 0 ? "+" : "−"}${money(Math.abs(b.net))}
                    </span>
                  )}
                </div>

                {b.status === "refunded" && (
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    {b.voidReason === "low_odds"
                      ? "بازار باطل شد چون ضریب برنده زیر حد مجاز افتاد — کل مبلغ بدون کسر کارمزد برگشت."
                      : b.voidReason === "no_winners"
                        ? "هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرده بود — کل مبلغ برگشت."
                        : "بازار باطل شد و کل مبلغ برگشت."}
                  </p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
