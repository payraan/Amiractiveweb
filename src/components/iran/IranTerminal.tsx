"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/components/predict/usePlayer";
import AuthPanel from "@/components/predict/AuthPanel";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import DisputePanel from "@/components/iran/DisputePanel";

type M = {
  id: number;
  question: string;
  category: string;
  sourceNote: string;
  closesAt: string;
  status: string;
  outcome: string | null;
  yesTotal: number;
  noTotal: number;
  volume: number;
  bettors: number;
  yesPct: number;
  yesOdds: number;
  noOdds: number;
  creator: string | null;
};

type Cfg = { minStake: number; commission: number };

const CATS = [{ id: "all", label: "همه" }, ...IR_CATEGORIES];

// مرتب‌سازی اکسپلور. «داغ» عمدا بر پایه‌ی حجم به‌ازای زمانِ سپری‌شده است، نه
// حجم خام: وگرنه بازار قدیمی همیشه بالای بازار تازه‌ی پرشتاب می‌ماند و هیچ
// بازار جدیدی هرگز دیده نمی‌شود.
const SORTS = [
  { id: "hot", label: "داغ", help: "سریع‌ترین رشد مشارکت" },
  { id: "volume", label: "بیشترین حجم", help: "بزرگ‌ترین استخر" },
  { id: "bettors", label: "پرمشارکت‌ترین", help: "بیشترین تعداد شرکت‌کننده" },
  { id: "closing", label: "نزدیک به پایان", help: "زودتر بسته می‌شوند" },
  { id: "new", label: "تازه‌ترین", help: "جدیدترین بازارها" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

const ERR: Record<string, string> = {
  telegram_blocked:
    "ربات نارمون را در تلگرام بلاک کرده‌اید. اعلان‌های امنیتی حساب از همان ربات می‌آید، پس تا آنبلاک نکنید این عملیات انجام نمی‌شود. برداشت وجه بسته نیست.",
  rate_limited: "درخواست‌های پیاپی بیش از حد بود. کمی صبر کنید و دوباره تلاش کنید.",
  telegram_required:
    "برای هر عملیات مالی باید حساب تلگرامت را وصل کنی. از صفحه‌ی دعوت وصلش کن یا مینی‌اپ را باز کنید.",
  not_authed: "برای ثبت پیش‌بینی وارد شوید.",
  insufficient_funds: "موجودی کیف پول کافی نیست.",
  stake_too_low: "مبلغ کمتر از حداقل مجاز است.",
  market_closed: "این بازار بسته شده است.",
  not_found: "بازار پیدا نشد.",
};

const catLabel = (id: string) =>
  IR_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** فقط بازار بازِ به‌موعدنرسیده قابل پیش‌بینی است. */
const isBettable = (x: { status: string; closesAt: string }) =>
  x.status === "open" && new Date(x.closesAt).getTime() > Date.now();

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: "باز", cls: "border-gain/40 text-gain" },
  locked: { label: "بسته، منتظر نتیجه", cls: "border-line text-muted" },
  settling: { label: "در پنجره اعتراض", cls: "border-gold/40 text-gold" },
  settled: { label: "تسویه‌شده", cls: "border-line text-muted" },
  void: { label: "باطل", cls: "border-loss/40 text-loss" },
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
  const [cfg, setCfg] = useState<Cfg>({ minStake: 3, commission: 0.03 });
  const [balance, setBalance] = useState(0);
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<number | null>(null);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [load, setLoad] = useState(true);
  const [sort, setSort] = useState<SortId>("hot");

  const fetchMarkets = useCallback(async () => {
    try {
      const r = await fetch(`/api/ir/markets?category=${cat}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setMarkets(j.markets);
        setBalance(j.balance ?? 0);
        if (j.config) setCfg(j.config);
        // پیش‌فرض روی بازاری که واقعا می‌شود رویش شرط بست، نه صرفا اولین بازار
        setSel((s) => {
          if (s && j.markets.some((m: M) => m.id === s)) return s;
          const bettable = j.markets.find((m: M) => isBettable(m));
          return bettable?.id ?? j.markets[0]?.id ?? null;
        });
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

  const noPct = m ? Math.round((100 - m.yesPct) * 10) / 10 : 0;

  // همه‌ی بازارها در اکسپلور دیده می‌شوند، نه فقط بازها. قبلا فقط status=open
  // نشان داده می‌شد و کاربری که سه بازار ساخته بود فقط یکی را می‌دید — چون
  // بقیه locked یا settling بودند. حالا همه می‌آیند و وضعیتشان روی کارت
  // برچسب می‌خورد؛ بازارِ غیرقابل‌شرط کم‌رنگ‌تر است ولی همچنان قابل دیدن.
  const explore = useMemo(() => {
    const byClose = (x: M) => new Date(x.closesAt).getTime();
    // بازارهای قابل شرط همیشه بالاتر از بسته‌ها می‌آیند
    const rank = (x: M) => (isBettable(x) ? 0 : 1);
    const arr = [...markets];
    switch (sort) {
      case "volume":
        return arr.sort((a, b) => rank(a) - rank(b) || b.volume - a.volume);
      case "bettors":
        return arr.sort(
          (a, b) => rank(a) - rank(b) || b.bettors - a.bettors || b.volume - a.volume
        );
      case "closing":
        return arr.sort((a, b) => rank(a) - rank(b) || byClose(a) - byClose(b));
      case "new":
        return arr.sort((a, b) => rank(a) - rank(b) || b.id - a.id);
      case "hot":
      default:
        // شتاب مشارکت: حجم تقسیم بر ساعت‌های باقی‌مانده تا بسته‌شدن. بازاری که
        // در فرصت کمتر حجم بیشتری جمع کرده، داغ‌تر است.
        return arr.sort((a, b) => {
          const heat = (x: M) => {
            const hoursLeft = Math.max(1, (byClose(x) - Date.now()) / 3600000);
            return (x.volume + x.bettors * 2) / Math.sqrt(hoursLeft);
          };
          return rank(a) - rank(b) || heat(b) - heat(a);
        });
    }
  }, [markets, sort]);

  return (
    // rounded-xl عمدی است: قاعده‌ی سراسری globals.css فقط rounded-2xl را
    // موقع هاور زوم و قاب طلایی می‌دهد، که برای یک ترمینال تمام‌صفحه بد است.
    // پنل /trade هم دقیقا به همین دلیل rounded-xl است.
    <div className="rounded-xl border border-line bg-surface/40">
      {/* ── نوار بالا ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
        {/* روی موبایل سؤال یک ردیف کامل می‌گیرد، وگرنه بین آمارها له می‌شود */}
        <div className="flex w-full min-w-0 items-center gap-3 lg:w-auto lg:flex-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 font-mono text-[10px] font-bold text-gold">
            IR
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">
              {m?.question ?? (load ? "در حال بارگذاری…" : "بازار ایران")}
            </h1>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 font-mono text-[9px] tracking-wide text-muted">
              <span className="shrink-0 rounded border border-line px-1.5 py-px">
                {m ? catLabel(m.category) : "—"}
              </span>
              {/* truncate لازم است نه line-clamp: منبع می‌تواند یک URL یا
                  رشته‌ی بی‌فاصله‌ی بلند باشد که کل ترمینال را پهن می‌کند. */}
              <span className="truncate">
                {m ? `منبع: ${m.sourceNote}` : "بازارها را کاربران می‌سازند"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Stat k="حجم استخر" v={m ? `$${m.volume.toFixed(2)}` : "—"} />
          <Stat k="بله" v={m ? `${m.yesPct}٪` : "—"} tone="gain" />
          <Stat k="خیر" v={m ? `${noPct}٪` : "—"} tone="loss" />
          <Stat k="تا بسته‌شدن" v={m ? remain(m.closesAt) : "—"} tone="gold" />
          <Stat k="مشارکت‌کنندگان" v={m ? String(m.bettors) : "—"} />
        </div>

        <div className="flex gap-2">
          {m && (
            <Link
              href={`/iran/m/${m.id}`}
              className="no-zoom rounded-lg border border-line px-3 py-1.5 text-[10px] text-muted transition hover:border-gold/50 hover:text-gold"
            >
              اشتراک‌گذاری
            </Link>
          )}
          <Link
            href="/iran/propose"
            className="no-zoom rounded-lg border border-gold/40 px-3 py-1.5 text-[10px] font-bold text-gold transition hover:bg-gold hover:text-ink"
          >
            ساخت بازار
          </Link>
        </div>
      </div>

      {/* ── بدنه ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_260px]">
        {/* استخر */}
        <div className="order-2 min-w-0 border-b border-line lg:order-2 lg:border-e lg:border-b-0">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[11px] font-bold text-cream">اجماع بازار</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gain" />
              </span>
              زنده
            </span>
          </div>

          {m ? (
            <div className="p-4">
              {/* نوار بزرگ سهم دو طرف */}
              <div className="flex items-end justify-between font-mono text-xs">
                <span className="text-gain">
                  بله <b className="text-lg">{m.yesPct}%</b>
                </span>
                <span className="text-loss">
                  <b className="text-lg">{noPct}%</b> خیر
                </span>
              </div>
              <div className="mt-2 flex h-14 overflow-hidden rounded-lg border border-line">
                <div
                  className="flex items-center justify-start bg-gain/25 ps-2 font-mono text-[10px] text-gain transition-all duration-500"
                  style={{ width: `${Math.max(m.yesPct, 0)}%` }}
                  dir="ltr"
                >
                  {m.yesTotal > 0 ? `$${m.yesTotal.toFixed(2)}` : ""}
                </div>
                <div
                  className="flex flex-1 items-center justify-end bg-loss/25 pe-2 font-mono text-[10px] text-loss transition-all duration-500"
                  dir="ltr"
                >
                  {m.noTotal > 0 ? `$${m.noTotal.toFixed(2)}` : ""}
                </div>
              </div>

              {/* عمق استخر و ضریب هر طرف */}
              <div className="mt-4 overflow-hidden rounded-lg border border-line font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-line bg-gain/5 px-3 py-2">
                  <span className="text-gain">استخر بله</span>
                  <span className="flex gap-4" dir="ltr">
                    <span className="text-cream">${m.yesTotal.toFixed(2)}</span>
                    <span className="text-gain">×{m.yesOdds || "—"}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between bg-loss/5 px-3 py-2">
                  <span className="text-loss">استخر خیر</span>
                  <span className="flex gap-4" dir="ltr">
                    <span className="text-cream">${m.noTotal.toFixed(2)}</span>
                    <span className="text-loss">×{m.noOdds || "—"}</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-ink/30 p-3">
                <h3 className="text-[11px] font-bold text-cream">چطور محاسبه می‌شود</h3>
                <p className="mt-2 text-[11px] leading-7 text-muted">
                  همه‌ی شرط‌ها در یک استخر جمع می‌شوند. پس از کسر{" "}
                  {Math.round(cfg.commission * 100)}٪ کارمزد، باقی بین برنده‌ها به نسبت
                  سهمشان تقسیم می‌شود. هرچه طرفدار یک گزینه کمتر باشد، ضریب آن بزرگ‌تر
                  است. اگر ضریب برنده زیر حد مجاز بیفتد، بازار باطل و کل پول بدون کسر
                  کارمزد برگردانده می‌شود؛ و اگر هیچ‌کس روی گزینه‌ی برنده پیش‌بینی نکرده
                  باشد، پول همه پس از کسر کارمزد برمی‌گردد.
                </p>
              </div>

              <p className="mt-3 break-all text-[10px] leading-6 text-muted">
                <b className="text-gold">منبع تسویه:</b> {m.sourceNote}
              </p>
            </div>
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-bold text-cream">
                {load ? "در حال بارگذاری…" : "هنوز بازاری منتشر نشده"}
              </p>
              {!load && (
                <>
                  <p className="mx-auto mt-3 max-w-md text-[12px] leading-7 text-muted">
                    بازارهای این بخش را خود کاربران پیشنهاد می‌دهند و پس از بررسی
                    انسانی منتشر می‌شوند. اولین نفری باش که یک بازار می‌سازد.
                  </p>
                  <Link
                    href="/iran/propose"
                    className="no-zoom mt-5 rounded-lg bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
                  >
                    پیشنهاد بازار جدید
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* نردبان بازارها */}
        <div className="order-3 min-w-0 border-b border-line lg:order-3 lg:border-b-0">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[11px] font-bold text-cream">بازارهای ایران</span>
            <span className="font-mono text-[10px] text-gold" dir="ltr">
              {markets.length}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`no-zoom shrink-0 rounded px-2 py-1 text-[10px] transition ${
                  cat === c.id ? "bg-gold/15 text-gold" : "text-muted hover:text-cream"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {markets.map((x) => {
              const active = x.id === sel;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setSel(x.id)}
                  className={`no-zoom relative block w-full px-3 py-2.5 text-start transition ${
                    active ? "bg-gold/10" : "hover:bg-raised/40"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 start-0 bg-gain/10"
                    style={{ width: `${x.yesPct}%` }}
                  />
                  <span className="relative flex items-start justify-between gap-2">
                    <span className="line-clamp-2 min-w-0 flex-1 break-words text-[11px] leading-5">
                      {x.question}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11px] font-bold ${
                        x.yesPct >= 50 ? "text-gain" : "text-loss"
                      }`}
                      dir="ltr"
                    >
                      {x.yesPct}%
                    </span>
                  </span>
                  <span className="relative mt-1 flex items-center justify-between font-mono text-[9px] text-muted" dir="ltr">
                    <span>${x.volume.toFixed(0)} · {x.bettors}</span>
                    <span>{fa(x.closesAt)}</span>
                  </span>
                </button>
              );
            })}
            {!load && markets.length === 0 && (
              <div className="py-10 text-center text-[10px] text-muted">
                بازاری در این دسته نیست
              </div>
            )}
          </div>
        </div>

        {/* پنل سفارش — روی موبایل اول می‌آید تا کاربر بدون خواندن هیچ متنی
            بتواند پیش‌بینی‌اش را ثبت کند. */}
        <div className="order-1 min-w-0 border-b border-line lg:order-1 lg:border-e lg:border-b-0">
          <div className="border-b border-line px-3 py-2">
            <span className="text-[11px] font-bold text-gold">ثبت پیش‌بینی</span>
          </div>

          <div className="p-3">
            {!loading && !player ? (
              <>
                <p className="text-[10px] leading-5 text-muted">
                  برای ثبت پیش‌بینی با تتر وارد حساب شوید.
                </p>
                <div className="mt-3">
                  <AuthPanel onAuthed={() => refresh()} />
                </div>
              </>
            ) : m && !isBettable(m) ? (
              // بازار انتخاب‌شده دیگر شرط نمی‌پذیرد — فرم را نشان نده، دلیلش را بگو
              <div className="rounded-lg border border-line bg-ink/30 p-4 text-center">
                <p className="text-[12px] font-bold text-cream">
                  {STATUS_BADGE[m.status]?.label ?? "بسته"}
                </p>
                <p className="mt-2 text-[11px] leading-6 text-muted">
                  {m.status === "locked"
                    ? "ثبت پیش‌بینی روی این بازار تمام شده و منتظر اعلام نتیجه است."
                    : m.status === "settling"
                      ? "نتیجه ثبت شده و در پنجره‌ی ۲۴ ساعته‌ی اعتراض است. پس از آن پرداخت انجام می‌شود."
                      : m.status === "settled"
                        ? "این بازار تسویه شده و پرداخت برنده‌ها انجام شده است."
                        : m.status === "void"
                          ? "این بازار باطل شده و پول شرکت‌کننده‌ها برگشته است."
                          : "زمان این بازار به پایان رسیده است."}
                </p>
                <p className="mt-3 text-[10px] text-muted">
                  از فهرست پایین یک بازار باز انتخاب کنید.
                </p>

                {/* پنجره‌ی اعتراض — هرکس روی این بازار پیش‌بینی کرده
                    می‌تواند اعتراض کند، نه فقط سازنده */}
                {m.status === "settling" && <DisputePanel marketId={m.id} />}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!m}
                    onClick={() => setSide("yes")}
                    className={`no-zoom rounded-lg border py-2.5 text-sm font-bold transition disabled:opacity-40 ${
                      side === "yes"
                        ? "border-gain bg-gain/10 text-gain"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    بله
                    <span className="ms-2 font-mono text-[11px]" dir="ltr">
                      ×{m?.yesOdds || "—"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!m}
                    onClick={() => setSide("no")}
                    className={`no-zoom rounded-lg border py-2.5 text-sm font-bold transition disabled:opacity-40 ${
                      side === "no"
                        ? "border-loss bg-loss/10 text-loss"
                        : "border-line text-muted hover:text-cream"
                    }`}
                  >
                    خیر
                    <span className="ms-2 font-mono text-[11px]" dir="ltr">
                      ×{m?.noOdds || "—"}
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
                    disabled={!m}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder={`حداقل ${cfg.minStake}`}
                    className="no-zoom mt-1.5 w-full rounded-lg border border-line bg-ink/50 px-3 py-2 font-mono text-sm text-cream outline-none transition focus:border-gold/60 disabled:opacity-40"
                  />
                  <div className="mt-2 flex gap-1.5">
                    {[25, 50, 100].map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={!m || balance <= 0}
                        onClick={() => setStake(((balance * p) / 100).toFixed(2))}
                        className="no-zoom flex-1 rounded border border-line py-1 font-mono text-[10px] text-muted transition hover:border-gold/40 hover:text-cream disabled:opacity-40"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-line bg-ink/40 p-3 font-mono text-[11px]">
                  <Row k="ضریب" v={preview ? `×${preview.odds.toFixed(2)}` : "—"} />
                  <Row
                    k="دریافتی در صورت برد"
                    v={preview ? `$${preview.payout.toFixed(2)}` : "—"}
                    tone="gain"
                  />
                  <Row
                    k="سود خالص"
                    v={preview ? `+$${preview.profit.toFixed(2)}` : "—"}
                    tone="gain"
                  />
                  <Row k="کارمزد" v={`${Math.round(cfg.commission * 100)}٪`} />
                </div>

                <button
                  type="button"
                  disabled={busy || !m || !stake || Number(stake) < cfg.minStake}
                  onClick={submit}
                  className={`no-zoom mt-3 w-full rounded-lg py-2.5 font-display text-sm font-extrabold transition disabled:opacity-40 ${
                    side === "yes"
                      ? "bg-gain/90 text-ink hover:bg-gain"
                      : "bg-loss/90 text-cream hover:bg-loss"
                  }`}
                >
                  {busy ? "…" : side === "yes" ? "ثبت بله" : "ثبت خیر"}
                </button>

                {balance <= 0 && (
                  <Link
                    href="/wallet"
                    className="no-zoom mt-2 block rounded-lg border border-gold/40 py-2 text-center text-[11px] font-bold text-gold transition hover:bg-gold hover:text-ink"
                  >
                    شارژ کیف پول
                  </Link>
                )}

                {msg && (
                  <p className={`mt-2 text-[11px] ${msg.ok ? "text-gain" : "text-loss"}`}>
                    {msg.text}
                  </p>
                )}

                <p className="mt-3 text-[10px] leading-6 text-muted">
                  ضریب نمایش‌داده‌شده با ثبت پیش‌بینی شما بازمحاسبه شده است و تا لحظه‌ی
                  بسته‌شدن بازار می‌تواند تغییر کند.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── اکسپلور: همه‌ی بازارهای باز ── */}
      <div className="border-t border-line">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
          <span className="text-[11px] font-bold text-cream">اکسپلور بازارها</span>
          <span className="font-mono text-[10px] text-gold" dir="ltr">
            {explore.length}
          </span>

          <div className="flex gap-1 overflow-x-auto">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`no-zoom shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[10px] transition ${
                  sort === s.id ? "bg-gold/15 text-gold" : "text-muted hover:text-cream"
                }`}
                title={s.help}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="ms-auto flex gap-1 overflow-x-auto">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`no-zoom shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[10px] transition ${
                  cat === c.id
                    ? "bg-gold text-ink"
                    : "border border-line text-muted hover:text-cream"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {explore.length === 0 ? (
          <p className="py-10 text-center text-[11px] text-muted">
            {load ? "در حال بارگذاری…" : "بازاری در این دسته باز نیست."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {explore.map((x) => {
              const active = x.id === sel;
              const xNo = Math.round((100 - x.yesPct) * 10) / 10;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setSel(x.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`no-zoom min-w-0 border-b border-line p-4 text-start transition md:border-e ${
                    active ? "bg-gold/10" : "hover:bg-raised/40"
                  } ${isBettable(x) ? "" : "opacity-60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 shrink items-center gap-1.5">
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
                        {catLabel(x.category)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                          STATUS_BADGE[x.status]?.cls ?? "border-line text-muted"
                        }`}
                      >
                        {STATUS_BADGE[x.status]?.label ?? x.status}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted" dir="ltr">
                      ${x.volume.toFixed(0)} · {x.bettors} نفر
                    </span>
                  </div>

                  <p className="mt-2.5 line-clamp-2 break-words text-[12px] font-bold leading-6">
                    {x.question}
                  </p>

                  <div className="mt-3 flex justify-between font-mono text-[10px]">
                    <span className="text-gain">بله {x.yesPct}٪</span>
                    <span className="text-loss">خیر {xNo}٪</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-loss/25">
                    <div className="h-full bg-gain" style={{ width: `${x.yesPct}%` }} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted">
                    <span>بسته‌شدن: {fa(x.closesAt)}</span>
                    {isBettable(x) ? (
                      <span className="text-gold">{remain(x.closesAt)}</span>
                    ) : (
                      <span>ثبت پیش‌بینی بسته است</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "gain" | "loss" | "gold";
}) {
  const c =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : tone === "gold"
          ? "text-gold"
          : "text-cream";
  return (
    <div>
      <div className="font-mono text-[9px] tracking-wider text-muted" dir="ltr">
        {k}
      </div>
      <div className={`mt-0.5 font-mono text-xs font-bold ${c}`} dir="ltr">
        {v}
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
