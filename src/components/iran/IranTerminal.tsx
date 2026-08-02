"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthCallout from "@/components/predict/AuthCallout";

type M = {
  id: number;
  question: string;
  category: string;
  sourceNote: string;
  closesAt: string;
  status: string;
  yesTotal: number;
  noTotal: number;
  volume: number;
  bettors: number;
  yesPct: number;
  yesOdds: number;
  noOdds: number;
  forming: boolean;
  creator: string | null;
};

type Cfg = { minStake: number; commission: number; minParticipants: number };

const CATS = [
  { id: "all", label: "همه" },
  { id: "economy", label: "اقتصاد" },
  { id: "sports", label: "ورزش" },
  { id: "crypto", label: "کریپتو" },
  { id: "social", label: "اجتماعی" },
  { id: "other", label: "سایر" },
];

const ERR: Record<string, string> = {
  not_authed: "برای ثبت پیش‌بینی وارد شوید.",
  insufficient_funds: "موجودی کیف پول کافی نیست.",
  stake_too_low: "مبلغ کمتر از حداقل مجاز است.",
  market_closed: "این بازار بسته شده است.",
  not_found: "بازار پیدا نشد.",
};

const fa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function remain(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "بسته";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)} روز`;
  if (h > 0) return `${h} ساعت`;
  return `${Math.floor(ms / 60000)} دقیقه`;
}

export default function IranTerminal() {
  const { player, loading, refresh } = usePlayer();
  const [markets, setMarkets] = useState<M[]>([]);
  const [cfg, setCfg] = useState<Cfg>({
    minStake: 3,
    commission: 0.03,
    minParticipants: 10,
  });
  const [balance, setBalance] = useState(0);
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<number | null>(null);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [load, setLoad] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const r = await fetch(`/api/ir/markets?category=${cat}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setMarkets(j.markets);
        setBalance(j.balance ?? 0);
        if (j.config) setCfg(j.config);
        setSel((s) => (s && j.markets.some((m: M) => m.id === s) ? s : j.markets[0]?.id ?? null));
      }
    } finally {
      setLoad(false);
    }
  }, [cat]);

  useEffect(() => {
    fetchMarkets();
    const id = setInterval(fetchMarkets, 20000);
    return () => clearInterval(id);
  }, [fetchMarkets]);

  const m = useMemo(() => markets.find((x) => x.id === sel) ?? null, [markets, sel]);

  // پیش‌نمایش زنده — ضریب پس از ورود شرط خودِ کاربر بازمحاسبه می‌شود،
  // چون شرط تو خودش ضریب را جابه‌جا می‌کند و کاربر باید عدد واقعی را ببیند.
  const preview = useMemo(() => {
    if (!m) return null;
    const s = Number(stake);
    if (!Number.isFinite(s) || s <= 0) return null;
    const yes = m.yesTotal + (side === "yes" ? s : 0);
    const no = m.noTotal + (side === "no" ? s : 0);
    const winners = side === "yes" ? yes : no;
    if (winners <= 0) return null;
    const odds = ((yes + no) * (1 - cfg.commission)) / winners;
    return { odds, payout: s * odds, profit: s * odds - s };
  }, [m, stake, side, cfg.commission]);

  async function submit() {
    if (!m) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ir/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: m.id, side, stake: Number(stake) }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMsg({ ok: false, text: ERR[j.error] ?? "خطایی رخ داد." });
        return;
      }
      setMsg({ ok: true, text: "پیش‌بینی ثبت شد ✓" });
      setStake("");
      await Promise.all([fetchMarkets(), refresh()]);
    } catch {
      setMsg({ ok: false, text: "ارتباط با سرور برقرار نشد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!loading && !player && (
        <div className="mb-8">
          <AuthCallout
            benefits={[
              "پیش‌بینی روی رویدادهای واقعی ایران",
              "برد از استخر شرط‌ها — گزینه‌ی کم‌طرفدارتر، ضریب بزرگ‌تر",
              "برداشت مستقیم به کیف پول",
              "۱۰ کردیت هدیه‌ی خوش‌آمد",
            ]}
            onAuthed={() => refresh()}
          />
        </div>
      )}

      {/* ── پنل بالا ── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/40">
        {m ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
              <div className="min-w-0 flex-1">
                <span className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted">
                  {CATS.find((c) => c.id === m.category)?.label ?? m.category}
                </span>
                <h2 className="mt-3 font-display text-lg font-extrabold leading-8 md:text-xl">
                  {m.question}
                </h2>
                <p className="mt-2 text-[11px] leading-6 text-muted">
                  <b className="text-gold">منبع تسویه:</b> {m.sourceNote}
                </p>
              </div>
              <div className="flex shrink-0 gap-6 font-mono text-[11px]">
                <div>
                  <div className="text-[9px] text-muted">TOTAL POOL</div>
                  <div className="mt-1 text-base text-cream" dir="ltr">
                    ${m.volume.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-muted">CLOSES IN</div>
                  <div className="mt-1 text-base text-cream">{remain(m.closesAt)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted">BETTORS</div>
                  <div className="mt-1 text-base text-cream" dir="ltr">
                    {m.bettors}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
              {/* نمودار سهم */}
              <div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-gain">بله {m.yesPct}%</span>
                  <span className="text-loss">
                    خیر {Math.round((100 - m.yesPct) * 10) / 10}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-loss/25">
                  <div
                    className="h-full rounded-full bg-gain transition-all duration-500"
                    style={{ width: `${m.yesPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[10px] text-muted" dir="ltr">
                  <span>${m.yesTotal.toFixed(2)}</span>
                  <span>${m.noTotal.toFixed(2)}</span>
                </div>

                {m.forming && (
                  <p className="mt-4 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-[11px] leading-6 text-muted">
                    این بازار هنوز <b className="text-gold">در حال شکل‌گیری</b> است.
                    تا رسیدن به {cfg.minParticipants} شرکت‌کننده، ضریب‌ها ناپایدارند
                    چون شرط‌های اولیه می‌توانند آن‌ها را جابه‌جا کنند.
                  </p>
                )}

                <div className="mt-4 rounded-xl border border-line bg-ink/30 p-4">
                  <h3 className="text-[11px] font-bold text-cream">چطور محاسبه می‌شود</h3>
                  <p className="mt-2 text-[11px] leading-7 text-muted">
                    همه‌ی شرط‌ها در یک استخر جمع می‌شوند. پس از کسر{" "}
                    {Math.round(cfg.commission * 100)}٪ کارمزد، باقی بین برنده‌ها به
                    نسبت سهمشان تقسیم می‌شود. هرچه طرفدار یک گزینه کمتر باشد، ضریب آن
                    بزرگ‌تر است. اگر بازار چنان یک‌طرفه شود که ضریب برنده زیر حد مجاز
                    بیفتد، بازار باطل و کل پول بدون کسر کارمزد برگردانده می‌شود.
                  </p>
                </div>
              </div>

              {/* پنل سفارش */}
              <div className="rounded-xl border border-line bg-raised/30 p-4">
                <div className="font-mono text-[10px] tracking-wider text-muted">
                  PLACE PREDICTION
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("yes")}
                    className={`rounded-xl border py-3 text-sm font-bold transition ${
                      side === "yes"
                        ? "border-gain bg-gain/10 text-gain"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    بله
                    <span className="ms-2 font-mono text-[11px]" dir="ltr">
                      ×{m.yesOdds || "—"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("no")}
                    className={`rounded-xl border py-3 text-sm font-bold transition ${
                      side === "no"
                        ? "border-loss bg-loss/10 text-loss"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    خیر
                    <span className="ms-2 font-mono text-[11px]" dir="ltr">
                      ×{m.noOdds || "—"}
                    </span>
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>مبلغ (تتر)</span>
                    <span className="font-mono" dir="ltr">
                      موجودی: ${balance.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    dir="ltr"
                    min={cfg.minStake}
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder={`حداقل ${cfg.minStake}`}
                    className="mt-1.5 w-full rounded-xl border border-line bg-ink/50 px-4 py-2.5 font-mono text-sm text-cream focus:border-gold focus:outline-none"
                  />
                  <div className="mt-2 flex gap-1.5">
                    {[25, 50, 100].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setStake(((balance * p) / 100).toFixed(2))}
                        className="flex-1 rounded-lg border border-line py-1.5 font-mono text-[10px] text-muted transition hover:border-gold/40 hover:text-cream"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-line bg-ink/40 p-3 font-mono text-[11px]">
                  <Row k="Odds" v={preview ? `×${preview.odds.toFixed(2)}` : "—"} />
                  <Row
                    k="To win"
                    v={preview ? `$${preview.payout.toFixed(2)}` : "—"}
                    tone="gain"
                  />
                  <Row
                    k="Profit"
                    v={preview ? `+$${preview.profit.toFixed(2)}` : "—"}
                    tone="gain"
                  />
                  <Row k="Fee" v={`${Math.round(cfg.commission * 100)}%`} />
                </div>

                {player ? (
                  <button
                    type="button"
                    disabled={busy || !stake || Number(stake) < cfg.minStake}
                    onClick={submit}
                    className={`mt-3 w-full rounded-xl py-3 font-display text-sm font-extrabold transition disabled:opacity-40 ${
                      side === "yes"
                        ? "bg-gain/90 text-ink hover:bg-gain"
                        : "bg-loss/90 text-cream hover:bg-loss"
                    }`}
                  >
                    {busy ? "…" : side === "yes" ? "ثبت بله" : "ثبت خیر"}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="mt-3 block rounded-xl bg-gold py-3 text-center font-display text-sm font-extrabold text-ink"
                  >
                    برای پیش‌بینی وارد شوید
                  </Link>
                )}

                {msg && (
                  <p className={`mt-2 text-[11px] ${msg.ok ? "text-gain" : "text-loss"}`}>
                    {msg.text}
                  </p>
                )}

                <p className="mt-3 text-[10px] leading-6 text-muted">
                  ضریب نمایش‌داده‌شده با ورود شرط شما بازمحاسبه شده است و تا لحظه‌ی
                  بسته‌شدن بازار می‌تواند تغییر کند.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-xs text-muted">
            {load ? "در حال بارگذاری…" : "هنوز بازاری در این دسته باز نیست."}
          </div>
        )}
      </div>

      {/* ── لیست بازارها ── */}
      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`rounded-full px-4 py-1.5 text-xs transition ${
                  cat === c.id
                    ? "bg-gold text-ink"
                    : "border border-line text-muted hover:text-cream"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Link
            href="/iran/propose"
            className="rounded-xl border border-gold/40 px-4 py-2 text-xs text-gold transition hover:bg-gold hover:text-ink"
          >
            پیشنهاد بازار جدید
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {markets.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setSel(x.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`rounded-2xl border p-5 text-start transition hover:border-gold/50 ${
                sel === x.id ? "border-gold/60 bg-surface/60" : "border-line bg-surface/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted">
                  {CATS.find((c) => c.id === x.category)?.label ?? x.category}
                </span>
                <span className="font-mono text-[10px] text-muted" dir="ltr">
                  ${x.volume.toFixed(0)} · {x.bettors}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-[13px] font-bold leading-7">
                {x.question}
              </p>
              <div className="mt-3 flex justify-between font-mono text-[10px]">
                <span className="text-gain">بله {x.yesPct}%</span>
                <span className="text-loss">
                  خیر {Math.round((100 - x.yesPct) * 10) / 10}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-loss/25">
                <div className="h-full bg-gain" style={{ width: `${x.yesPct}%` }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted">
                <span>بسته‌شدن: {fa(x.closesAt)}</span>
                {x.forming && <span className="text-gold">در حال شکل‌گیری</span>}
              </div>
            </button>
          ))}
        </div>

        {!load && markets.length === 0 && (
          <p className="py-12 text-center text-xs text-muted">
            هنوز بازاری در این دسته منتشر نشده است.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "gain" }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted" dir="ltr">
        {k}
      </span>
      <span className={tone === "gain" ? "text-gain" : "text-cream"} dir="ltr">
        {v}
      </span>
    </div>
  );
}
