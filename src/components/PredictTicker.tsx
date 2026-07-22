import { getCuratedMarkets } from "@/lib/poly";

type Props = {
  /** volume = پرحجم‌ترین‌ها، ending = نزدیک‌ترین سررسیدها */
  variant?: "volume" | "ending";
  /** جهت حرکت نوار */
  reverse?: boolean;
};

export const dynamic = "force-dynamic";

function shorten(q: string): string {
  const clean = q.replace(/^Will\s+(the\s+price\s+of\s+)?/i, "").replace(/\?$/, "");
  return clean.length > 58 ? `${clean.slice(0, 55)}…` : clean;
}

export default async function PredictTicker({
  variant = "volume",
  reverse = false,
}: Props) {
  let items: { id: string; label: string; pct: number }[] = [];
  try {
    const all = await getCuratedMarkets();
    const picked =
      variant === "ending"
        ? [...all].sort(
            (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
          )
        : all;
    items = picked.slice(0, 16).map((m) => ({
      id: m.id,
      label: shorten(m.question),
      pct: m.yesPct,
    }));
  } catch {
    items = [];
  }

  if (items.length === 0) return null;

  // یک «نسخه» باید از عرض صفحه پهن‌تر باشد تا حلقه بی‌وقفه بچرخد؛
  // در غیر این صورت بین پایان یک دور و شروع دور بعد، فاصله‌ی خالی دیده می‌شود.
  const MIN_COPIES = Math.max(2, Math.ceil(24 / items.length));
  const base = Array.from({ length: MIN_COPIES }, () => items).flat();
  const anim = reverse ? "narmoon-marquee-rev" : "narmoon-marquee";
  const row = [...base, ...base];

  return (
    <div className="relative overflow-hidden border-y border-line bg-surface/30 py-3">
      <style>{`
        @keyframes narmoon-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes narmoon-marquee-rev {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .narmoon-track { animation: none !important; }
        }
      `}</style>

      <div
        className="narmoon-track flex w-max items-center"
        style={{ animation: `${anim} 70s linear infinite` }}
        dir="ltr"
      >
        {row.map((m, i) => (
          <a
            key={`${m.id}-${i}`}
            href={`/trade?market=${m.id}`}
            className="group flex shrink-0 items-center gap-2.5 pe-8 font-mono text-[11px] transition"
          >
            <span className="text-muted transition group-hover:text-cream">
              {m.label}
            </span>
            <span
              className={`font-bold ${m.pct >= 50 ? "text-gain" : "text-loss"}`}
            >
              {m.pct}%
            </span>
            <span className="text-line">·</span>
          </a>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 start-0 w-20 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 end-0 w-20 bg-gradient-to-l from-ink via-ink/70 to-transparent" />
    </div>
  );
}
