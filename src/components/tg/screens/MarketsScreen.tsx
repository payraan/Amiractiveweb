"use client";

import { useState } from "react";
import { useResource } from "@/components/tg/useResource";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import { Card, ErrorState, EmptyState, ScreenTitle, Skeleton } from "@/components/tg/ui";
import { haptic } from "@/components/tg/telegram";

// فهرست بازارهای ایران — از همان /api/ir/markets که سایت استفاده می‌کند.

type Market = {
  id: number;
  question: string;
  category: string;
  closesAt: string;
  status: string;
  yesPct: number;
  yesOdds: number;
  noOdds: number;
  volume: number;
  bettors: number;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "باز", cls: "text-gain" },
  locked: { label: "بسته", cls: "text-muted" },
  settling: { label: "در انتظار نتیجه", cls: "text-gold" },
};

function remaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "پایان‌یافته";
  const h = Math.floor(ms / 3600000);
  if (h < 24) return h < 1 ? "کمتر از یک ساعت" : `${h} ساعت`;
  return `${Math.floor(h / 24)} روز`;
}

export default function MarketsScreen() {
  const [cat, setCat] = useState("all");
  const { data, error, reload } = useResource<{ markets: Market[] }>(
    `/api/ir/markets?category=${encodeURIComponent(cat)}`
  );
  const markets = data?.markets ?? null;

  return (
    <div>
      <ScreenTitle title="بازار ایران" subtitle="پیش‌بینی با تتر واقعی" />

      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {[{ id: "all", label: "همه" }, ...IR_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              haptic.tap();
              setCat(c.id);
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              cat === c.id
                ? "border-gold bg-gold/10 text-gold"
                : "border-line text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message="فهرست بازارها نیامد." onRetry={reload} />}

      {!error && markets === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}

      {!error && markets?.length === 0 && (
        <EmptyState
          title="بازاری در این دسته نیست"
          hint="دسته‌ی دیگری را امتحان کن یا بعدا سر بزن."
        />
      )}

      {!error && markets && markets.length > 0 && (
        <div className="flex flex-col gap-3">
          {markets.map((m) => {
            const st = STATUS[m.status] ?? { label: m.status, cls: "text-muted" };
            return (
              <Card key={m.id}>
                <p className="text-[13px] font-bold leading-6 text-cream">
                  {m.question}
                </p>

                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted">
                  <span className={st.cls}>{st.label}</span>
                  <span>·</span>
                  <span>{remaining(m.closesAt)}</span>
                  <span>·</span>
                  <span dir="ltr">{m.bettors} نفر</span>
                  <span>·</span>
                  <span dir="ltr">${m.volume.toFixed(0)}</span>
                </div>

                {/* نوار اجماع: سهم بله در یک نگاه */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full bg-gain"
                    style={{ width: `${Math.max(2, Math.min(98, m.yesPct))}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-gain">
                    بله {m.yesPct}٪
                    {m.yesOdds > 0 && (
                      <span dir="ltr" className="ms-1 font-mono text-muted">
                        ×{m.yesOdds}
                      </span>
                    )}
                  </span>
                  <span className="text-loss">
                    خیر {Math.round((100 - m.yesPct) * 10) / 10}٪
                    {m.noOdds > 0 && (
                      <span dir="ltr" className="ms-1 font-mono text-muted">
                        ×{m.noOdds}
                      </span>
                    )}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
