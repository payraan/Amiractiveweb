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
    items = picked.slice(0, 18).map((m) => ({
      id: m.id,
      label: shorten(m.question),
      pct: m.yesPct,
    }));
  } catch {
    items = [];
  }

  if (items.length === 0) return null;

  // هر نسخه باید از عرض هر صفحه‌نمایشی پهن‌تر باشد تا حلقه بی‌وقفه بماند.
  const copies = Math.max(2, Math.ceil(30 / items.length));
  const base = Array.from({ length: copies }, () => items).flat();
  const anim = reverse ? "narmoon-marquee-rev" : "narmoon-marquee";

  const Copy = ({ tag }: { tag: string }) => (
    <div className="flex shrink-0 items-center">
      {base.map((m, i) => (
        <a
          key={`${tag}-${m.id}-${i}`}
          href={`/trade?market=${m.id}`}
          className="group flex shrink-0 items-center gap-2.5 pe-8 font-mono text-[11px]"
        >
          <span className="text-muted transition group-hover:text-cream">
            {m.label}
          </span>
          <span className={`font-bold ${m.pct >= 50 ? "text-gain" : "text-loss"}`}>
            {m.pct}%
          </span>
          <span className="text-line">·</span>
        </a>
      ))}
    </div>
  );

  return (
    <div
      className="relative overflow-hidden border-y border-line bg-surface/30 py-3"
      dir="ltr"
    >
      <style>{`
        @keyframes narmoon-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes narmoon-marquee-rev {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .narmoon-track { animation: none !important; }
        }
      `}</style>

      <div
        className="narmoon-track flex w-max"
        style={{ animation: `${anim} 80s linear infinite` }}
      >
        <Copy tag="a" />
        <Copy tag="b" />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-ink via-ink/70 to-transparent" />
    </div>
  );
}
