"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import { ErrorState, EmptyState, ScreenTitle, Skeleton, SearchBar } from "@/components/tg/ui";
import { matchesQuery } from "@/lib/search";
import { haptic } from "@/components/tg/telegram";
import ProposeScreen from "@/components/tg/screens/ProposeScreen";
import MarketDetail, { type Market } from "@/components/tg/screens/MarketDetail";
import { remaining, closingSoon } from "@/lib/dates";

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

/**
 * چند بازار در نوار «داغ‌ترین‌ها»، و از چند بازار به بعد اصلا نشان داده شود.
 *
 * ⚠️ آستانه سخاوتمندانه است چون تکرار، بدترین حالتِ این نوار است. با ۸
 * بازار، نوارِ شش‌تایی تقریبا همان فهرست را دو بار نشان می‌داد و فقط فضا
 * می‌خورد. نوار وقتی معنا دارد که فهرست آن‌قدر بلند باشد که استخرهای بزرگ
 * زیرش گم شوند.
 */
const HOT_COUNT = 4;
const HOT_MIN_MARKETS = 10;

/** از چند بازار به بعد فیلد جست‌وجو نشان داده شود. */
const SEARCH_MIN = 8;

/**
 * داغ = بزرگ‌ترین استخر.
 *
 * ⚠️ فقط بازارهای باز. بازار قفل‌شده هرچقدر هم حجم داشته باشد، کاری از
 * دست کاربر برنمی‌آید و بردنش به صدر یعنی هدر دادن گران‌ترین فضای صفحه.
 */
function hotMarkets(list: Market[]): Market[] {
  return list
    .filter((m) => m.status === "open" && m.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, HOT_COUNT);
}


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
  // پیش‌فرض «نزدیک به پایان» است، نه «داغ‌ترین».
  //
  // دو دلیل: کاربر بیشتر دنبال بازاری است که همین حالا تعیین تکلیف می‌شود،
  // و مهم‌تر اینکه نوار داغ خودش بر اساس حجم مرتب است — اگر فهرست هم همان
  // ترتیب را داشته باشد، دو بار یک چیز را نشان می‌دهیم. این‌طور نوار و
  // فهرست مکمل‌اند نه تکرار.
  const [sort, setSort] = useState<SortId>("closing");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlySoon, setOnlySoon] = useState(false);
  const [q, setQ] = useState("");
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
  const filtered = markets
    ? markets
        .filter((m) => (onlyOpen ? m.status === "open" : true))
        .filter((m) => (onlySoon ? closingSoon(m.closesAt) : true))
        .filter((m) => matchesQuery(q, m.question))
    : null;
  const shown = filtered ? sortMarkets(filtered, sort) : null;

  // نوار داغ از فهرستِ فیلترشده می‌آید، نه از کل بازارها: وقتی کاربر روی
  // «ورزش» است، داغ‌ترینِ ورزش را می‌خواهد نه داغ‌ترینِ کل پلتفرم.
  const hot = filtered && filtered.length >= HOT_MIN_MARKETS ? hotMarkets(filtered) : [];

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

      {/* آستانه از روی کل بازارها حساب می‌شود نه فهرست فیلترشده، وگرنه
          جست‌وجویی که نتیجه را کم می‌کند خودش را ناپدید می‌کرد. */}
      {(markets?.length ?? 0) >= SEARCH_MIN && (
        <SearchBar value={q} onChange={setQ} placeholder="جست‌وجو در بازارها…" />
      )}

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
        {/* «تا ۲۴ ساعت» کنار مرتب‌سازی می‌نشیند نه داخلش: مرتب‌سازی ترتیب را
            عوض می‌کند، این یکی فهرست را کوتاه می‌کند — و کاربری که دنبال
            بازارِ امشب است، نمی‌خواهد ته فهرست هم بازارهای دو هفته‌ی دیگر
            باشد. */}
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setOnlySoon((v) => !v);
          }}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
            onlySoon
              ? "border-gold/60 bg-gold/10 text-gold font-bold"
              : "border-line bg-surface/40 text-muted"
          }`}
        >
          تا ۲۴ ساعت
        </button>
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

      {/* ── داغ‌ترین‌ها ──────────────────────────────────────────
          پیمایش افقی، جدا از فهرست عمودی. کاربری که نمی‌داند دنبال چه
          می‌گردد اینجا کشف می‌کند؛ کسی که می‌داند، پایین‌تر می‌گردد. */}
      {!error && hot.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-gold">🔥 داغ‌ترین‌ها</span>
            <span className="text-[9px] text-muted">بزرگ‌ترین استخرها</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
            {hot.map((m) => (
              <article
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic.press();
                  setOpenId(m.id);
                }}
                className="w-[168px] shrink-0 cursor-pointer rounded-xl border border-gold/25 bg-gradient-to-bl from-gold/[0.07] to-surface/50 p-2.5 transition active:border-gold/60"
              >
                <p className="line-clamp-2 text-[10.5px] font-bold leading-[1.75] text-cream">
                  {m.question}
                </p>
                <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-loss/30">
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{ width: `${m.yesPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted">
                  <span dir="ltr" className="font-mono font-bold text-gain">
                    {Math.round(m.yesPct)}%
                  </span>
                  <span>بله</span>
                  <span className="opacity-40">·</span>
                  <span dir="ltr" className="font-mono text-cream">
                    ${compact(m.volume)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

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
          hint="دسته‌ی دیگری را امتحان کنید یا بعدا سر بزنید."
        />
      )}

      {!error && shown && shown.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {shown.map((m) => {
            const st = STATUS[m.status] ?? {
              label: m.status,
              cls: "border-line bg-raised text-muted",
            };
            return (
              <article
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic.press();
                  setOpenId(m.id);
                }}
                className="cursor-pointer rounded-xl border border-line bg-surface/40 p-3 transition active:border-gold/50"
              >
                {/* درصد از نوار ۲۸ پیکسلی درآمد و کنار سؤال نشست: مهم‌ترین
                    عدد صفحه است و نباید برای خواندنش چشم به سطر دیگری برود.
                    نتیجه‌اش هم دو برابر شدن تعداد کارت در یک صفحه است. */}
                <div className="flex items-start gap-2.5">
                  <div className="min-w-[46px] shrink-0 text-center">
                    <div
                      dir="ltr"
                      className="font-mono text-[17px] font-black leading-none text-gain"
                    >
                      {Math.round(m.yesPct)}%
                    </div>
                    <div className="mt-1 text-[8.5px] text-muted">بله</div>
                  </div>
                  <p className="line-clamp-2 flex-1 text-[12px] font-bold leading-[1.85] text-cream">
                    {m.question}
                  </p>
                </div>

                <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-loss/30">
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{ width: `${m.yesPct}%` }}
                  />
                </div>

                {/* ضریب‌ها عمدا اینجا نیستند — کسی بر اساس ×۱.۹۱ در فهرست
                    تصمیم نمی‌گیرد، و صفحه‌ی بازار جای بهتری برایشان است. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] text-muted">
                  {m.status !== "open" && (
                    <span className={`rounded-full border px-1.5 py-px text-[8.5px] ${st.cls}`}>
                      {st.label}
                    </span>
                  )}
                  <span className={closingSoon(m.closesAt) ? "font-bold text-gold" : ""}>
                    {remaining(m.closesAt)}
                  </span>
                  <span className="opacity-40">·</span>
                  <span>{CAT_LABEL[m.category] ?? m.category}</span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span dir="ltr" className="font-mono text-cream">
                      {m.bettors}
                    </span>{" "}
                    نفر
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
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
