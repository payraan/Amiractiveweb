"use client";

import { useMemo, useState } from "react";
import { displayTitle, matchesQuery } from "@/lib/search";
import { useAdminResource } from "@/components/admin/useAdminResource";

// انتشار کارت بازارهای ترید در کانال — قرینه‌ی همان دکمه‌ها در تب بازار ایران.
//
// چرا فهرست جداگانه و نه فیلد «شناسه را بنویس»: شناسه‌ی پالی‌مارکت یک عدد
// بی‌معنی است و ادمین جایی آن را نمی‌بیند. انتخاب باید از روی عنوانِ فارسی
// انجام شود، وگرنه هر انتشار یک رفت‌وبرگشت به مینی‌اپ لازم دارد.

type Market = {
  id: string;
  question: string;
  questionFa?: string | null;
  eventTitle?: string;
  eventTitleFa?: string | null;
  yesPct: number;
  volume: number;
  categoryLabel: string;
};

// فهرست منتخب تا ۴۰۰ بازار دارد. رندر همه‌شان صفحه‌ی ادمین را سنگین می‌کند و
// فایده‌ای هم ندارد: ادمین یا دنبال پرحجم‌ترین‌هاست یا اسم مشخصی را می‌جوید.
const SHOWN = 40;

const EMPTY: Market[] = [];

function usdShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

export default function TradePoll() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, error } = useAdminResource<{ markets: Market[] }>(
    "/api/predict/poly-markets"
  );
  // ثابتِ سطح ماژول است نه `[]` درجا: آرایه‌ی تازه در هر رندر، وابستگی‌های
  // useMemo پایین را هر بار عوض می‌کند و فیلتر بی‌دلیل دوباره اجرا می‌شود.
  const list = error ? EMPTY : (data?.markets ?? null);
  const err = error
    ? `فهرست بازارهای ترید نیامد (${error}). پالی‌مارکت ممکن است در دسترس نباشد.`
    : null;

  const shown = useMemo(() => {
    const all = list ?? [];
    const hit = q.trim()
      ? all.filter((m) =>
          matchesQuery(
            q,
            m.question,
            m.questionFa ?? undefined,
            m.eventTitle,
            m.eventTitleFa ?? undefined
          )
        )
      : all;
    return hit.slice(0, SHOWN);
  }, [list, q]);

  // دو حالت، چون تلگرام اجازه نمی‌دهد هر دو را با هم داشت:
  //  • live    — دکمه‌های callback، رأی درجا و درصدهای خودکار. ربات باید در
  //              آن کانال ادمین باشد و کارت با فوروارد دکمه‌هایش را از دست
  //              می‌دهد.
  //  • forward — دکمه‌های لینک، در فوروارد باقی می‌مانند، ولی درصدها روی همان
  //              لحظه یخ می‌زنند و کارت هم همین را می‌نویسد.
  async function publish(id: string, mode: "live" | "forward") {
    const chatId = window.prompt(
      mode === "live"
        ? "شناسه‌ی کانال برای ارسال زنده (@username یا -100…).\nربات باید در آن کانال ادمین باشد."
        : "شناسه‌ی کانال یا چت برای کارت فوروارد (@username یا -100…)."
    );
    if (!chatId?.trim()) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin/trade-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: id, chatId: chatId.trim(), mode }),
      });
      const j = await r.json();
      window.alert(
        j.ok
          ? mode === "live"
            ? "ارسال شد. درصدها هر ۱۵ دقیقه خودکار به‌روز می‌شوند."
            : "ارسال شد. حالا می‌توانی فورواردش کنی."
          : j.error === "not_found"
            ? "این بازار دیگر در فهرست منتخب نیست."
            : `ارسال نشد: ${j.error}`
      );
    } catch {
      window.alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-4 rounded-xl border border-line bg-raised/40 px-4 py-3 text-[11px] leading-6 text-muted">
        کارت <b>فوروارد</b> دکمه‌هایش بعد از فوروارد هم کار می‌کنند ولی درصدهایش
        روی همان لحظه می‌ماند. کارت <b>زنده</b> درصدهایش هر ۱۵ دقیقه تازه می‌شود
        ولی تلگرام موقع فوروارد دکمه‌هایش را حذف می‌کند و ربات باید در آن کانال
        ادمین باشد. برای پخش دست‌به‌دست، فوروارد را انتخاب کن.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جست‌وجوی بازار…"
        className="mb-4 w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-cream outline-none focus:border-gold"
      />

      {err && (
        <p className="mb-4 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-[11.5px] text-loss">
          {err}
        </p>
      )}

      {list === null && <p className="text-sm text-muted">در حال بارگذاری…</p>}

      {/* فهرست خالی باید حرف بزند، وگرنه ادمین نمی‌فهمد چیزی نیامده یا چیزی
          پیدا نشده. */}
      {list !== null && !shown.length && !err && (
        <p className="rounded-xl border border-line bg-raised/40 px-4 py-6 text-center text-[12px] text-muted">
          {q.trim() ? "بازاری با این عبارت پیدا نشد." : "فهرست بازارها خالی است."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {shown.map((m) => (
          <div key={m.id} className="rounded-xl border border-line bg-raised/40 p-4">
            <p dir="auto" className="text-start text-[13px] font-bold leading-7 text-cream">
              {displayTitle(m.question, m.questionFa)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span className="rounded-full border border-line px-2 py-0.5">
                {m.categoryLabel}
              </span>
              {/* فقط عدد ltr است، نه برچسب: «بله» داخل اسپن ltr به شکل
                  «بله%42.9» رندر می‌شد. */}
              <span className="text-gain">
                بله{" "}
                <span dir="ltr" className="font-mono">
                  {m.yesPct}٪
                </span>
              </span>
              <span dir="ltr" className="font-mono">
                {usdShort(m.volume)}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy === m.id}
                onClick={() => publish(m.id, "forward")}
                className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-bold text-gold transition disabled:opacity-50"
              >
                کارت فوروارد
              </button>
              <button
                type="button"
                disabled={busy === m.id}
                onClick={() => publish(m.id, "live")}
                className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-muted transition hover:border-gold hover:text-gold disabled:opacity-50"
              >
                کارت زنده
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* فقط وقتی فهرست بریده شده، و فقط وقتی جست‌وجویی در کار نیست: گفتنِ
          «برای بقیه جست‌وجو کن» به کسی که همین حالا جست‌وجو کرده بی‌معنی است. */}
      {!q.trim() && list !== null && list.length > shown.length && (
        <p className="mt-4 text-center text-[10.5px] text-muted">
          {shown.length} بازار از {list.length} تا نشان داده شده — بقیه را
          جست‌وجو کن.
        </p>
      )}
    </div>
  );
}
