"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import { ErrorState, EmptyState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";
import ProposeScreen from "@/components/tg/screens/ProposeScreen";
import MarketDetail, { type Market } from "@/components/tg/screens/MarketDetail";

// فهرست بازارهای ایران — از همان /api/ir/markets که سایت استفاده می‌کند.

type MarketsResponse = {
  markets: Market[];
  balance: number;
  myBets: Record<number, { side: string; stake: number }>;
  config: { minStake: number; commission: number };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "باز", cls: "border-gain/40 bg-gain/10 text-gain" },
  locked: { label: "بسته", cls: "border-line bg-raised text-muted" },
  settling: { label: "در انتظار نتیجه", cls: "border-gold/40 bg-gold/10 text-gold" },
};

const CAT_LABEL = Object.fromEntries(IR_CATEGORIES.map((c) => [c.id, c.label]));

function remaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "پایان‌یافته";
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "کمتر از یک ساعت";
  if (h < 24) return `${h} ساعت مانده`;
  return `${Math.floor(h / 24)} روز مانده`;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));

// بازارهای باز همیشه اول. وقتی هزاران بازار ساخته شود، بازارِ قابلِ شرط‌بستن
// نباید لای بازارهای بسته و در انتظار نتیجه گم شود — و ترتیبِ داخل هر گروه را
// کاربر انتخاب می‌کند.
const STATUS_RANK: Record<string, number> = { open: 0, settling: 1, locked: 2 };

const SORTS = [
  { id: "hot", label: "داغ‌ترین" },
  { id: "closing", label: "نزدیک به پایان" },
  { id: "new", label: "تازه‌ترین" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function sortMarkets(list: Market[], sort: SortId): Market[] {
  return [...list].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    if (sort === "closing") {
      return new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime();
    }
    if (sort === "new") return b.id - a.id;
    // داغ‌ترین: مشارکت مهم‌تر از حجم است، چون یک نفر با پول زیاد نباید
    // بازارِ کم‌مخاطب را بالای فهرست بنشاند.
    return b.bettors - a.bettors || b.volume - a.volume;
  });
}

export default function MarketsScreen({
  siteUrl,
  deepLink,
}: {
  siteUrl: string;
  deepLink?: { marketId: number; side: "yes" | "no" | null } | null;
}) {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<SortId>("hot");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [proposing, setProposing] = useState(false);
  // مقصد deep link به‌عنوان مقدار اولیه‌ی state می‌نشیند، نه در یک افکت:
  // این‌طور یک‌بار اعمال می‌شود، بازگشت کاربر آن را دوباره باز نمی‌کند، و
  // setState داخل افکت هم لازم نمی‌شود.
  const [openId, setOpenId] = useState<number | null>(deepLink?.marketId ?? null);
  const { data, error, reload } = useResource<MarketsResponse>(
    `/api/ir/markets?category=${encodeURIComponent(cat)}`
  );
  const markets = data?.markets ?? null;

  // زیرصفحه، نه تب پنجم: ساخت بازار یک کار است نه یک مقصد، و دکمه‌ی بازگشتِ
  // خود تلگرام همان چیزی است که کاربر برای بستنش دنبالش می‌گردد.
  if (proposing) {
    return (
      <ProposeScreen
        onBack={() => setProposing(false)}
        onDone={() => {
          setProposing(false);
          reload();
        }}
      />
    );
  }

  // بازار باز شده را از همان فهرست برمی‌داریم — با شناسه نگه می‌داریم نه با
  // خودِ شیء، تا بعد از reload داده‌ی تازه نشان داده شود نه نسخه‌ی کهنه.
  const shown = markets
    ? sortMarkets(
        onlyOpen ? markets.filter((m) => m.status === "open") : markets,
        sort
      )
    : null;

  const open = markets?.find((m) => m.id === openId) ?? null;
  if (open && data) {
    return (
      <MarketDetail
        market={open}
        siteUrl={siteUrl}
        balance={data.balance}
        minStake={data.config.minStake}
        commission={data.config.commission}
        myBet={data.myBets?.[open.id]}
        initialSide={open.id === deepLink?.marketId ? deepLink.side : null}
        onBack={() => setOpenId(null)}
        onPlaced={() => {
          setOpenId(null);
          reload();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0"><ScreenTitle title="بازار ایران" subtitle="پیش‌بینی با تتر واقعی" /></div>
        <button
          type="button"
          onClick={() => {
            haptic.press();
            setProposing(true);
          }}
          className="shrink-0 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[11px] font-bold text-gold"
        >
          + بازار بساز
        </button>
      </div>

      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {[{ id: "all", label: "همه" }, ...IR_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              haptic.tap();
              setCat(c.id);
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] transition ${
              cat === c.id
                ? "border-gold bg-gold text-ink font-bold"
                : "border-line bg-surface/40 text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {SORTS.map((sOpt) => (
            <button
              key={sOpt.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setSort(sOpt.id);
              }}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
                sort === sOpt.id
                  ? "border-gold/60 bg-gold/10 text-gold font-bold"
                  : "border-line bg-surface/40 text-muted"
              }`}
            >
              {sOpt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setOnlyOpen((v) => !v);
          }}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
            onlyOpen
              ? "border-gain/60 bg-gain/10 text-gain font-bold"
              : "border-line bg-surface/40 text-muted"
          }`}
        >
          فقط باز
        </button>
      </div>

      {error && <ErrorState message="فهرست بازارها نیامد." onRetry={reload} />}

      {!error && markets === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {!error && shown?.length === 0 && (
        <EmptyState
          title="بازاری در این دسته نیست"
          hint="دسته‌ی دیگری را امتحان کن یا بعدا سر بزن."
        />
      )}

      {!error && shown && shown.length > 0 && (
        <div className="flex flex-col gap-3">
          {shown.map((m) => {
            const st = STATUS[m.status] ?? {
              label: m.status,
              cls: "border-line bg-raised text-muted",
            };
            const noPct = Math.round((100 - m.yesPct) * 10) / 10;
            return (
              <article
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic.press();
                  setOpenId(m.id);
                }}
                className="cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface/40 transition active:border-gold/50"
              >
                <div className="p-4">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[9.5px] text-muted">
                      {CAT_LABEL[m.category] ?? m.category}
                    </span>
                    <span className="ms-auto text-[10px] text-muted">
                      {remaining(m.closesAt)}
                    </span>
                  </div>

                  <p className="text-[13.5px] font-bold leading-[1.9] text-cream">
                    {m.question}
                  </p>

                  {/* نوار اجماع با برچسب دو طرف — درصد روی خودِ نوار، تا چشم
                      برای خواندنش به سطر دیگری نرود */}
                  <div className="mt-3.5 flex h-7 w-full overflow-hidden rounded-lg bg-raised">
                    <div
                      className="flex items-center justify-start bg-gain/25 px-2"
                      style={{ width: `${Math.max(14, Math.min(86, m.yesPct))}%` }}
                    >
                      <span dir="ltr" className="font-mono text-[10px] font-bold text-gain">
                        {m.yesPct}%
                      </span>
                    </div>
                    <div className="flex flex-1 items-center justify-end bg-loss/15 px-2">
                      <span dir="ltr" className="font-mono text-[10px] font-bold text-loss">
                        {noPct}%
                      </span>
                    </div>
                  </div>

                  {/* فاصله با gap در فلکس، نه با ms/me: آن‌ها نسبت به جهتِ
                      خودِ span حساب می‌شوند و چون span عددها ltr است، فاصله
                      سمت اشتباه می‌افتد و برچسب به عدد می‌چسبد. */}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-gain">
                      بله
                      {m.yesOdds > 0 && (
                        <span dir="ltr" className="font-mono text-[10px] text-muted">
                          ×{m.yesOdds}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-loss">
                      {m.noOdds > 0 && (
                        <span dir="ltr" className="font-mono text-[10px] text-muted">
                          ×{m.noOdds}
                        </span>
                      )}
                      خیر
                    </span>
                  </div>
                </div>

                {/* پانوشت آمار، جدا شده تا از سؤال و ضریب‌ها تفکیک شود */}
                <div className="flex items-center gap-4 border-t border-line/70 bg-ink/40 px-4 py-2 text-[10px] text-muted">
                  <span>
                    <span dir="ltr" className="font-mono text-cream">
                      {m.bettors}
                    </span>{" "}
                    شرکت‌کننده
                  </span>
                  <span>
                    حجم{" "}
                    <span dir="ltr" className="font-mono text-cream">
                      ${compact(m.volume)}
                    </span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
