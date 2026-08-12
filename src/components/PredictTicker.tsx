import { db } from "@/lib/db";
import { ensureIrTables } from "@/lib/iran";

type Props = {
  /** volume = پرحجم‌ترین‌ها، ending = نزدیک‌ترین سررسیدها */
  variant?: "volume" | "ending";
  /** جهت حرکت نوار */
  reverse?: boolean;
};

export const dynamic = "force-dynamic";

function shorten(q: string): string {
  const clean = q.trim().replace(/\?$/, "");
  return clean.length > 58 ? `${clean.slice(0, 55)}…` : clean;
}

// نوار متحرک از بازارهای بازِ خودِ بازار ایران تغذیه می‌شود، نه پالی‌مارکت.
//
// دلیل: این نوار درست زیر هیرو می‌نشیند و اولین چیزی است که بازدیدکننده
// می‌بیند. نشان‌دادن بازارهای خارجی آنجا یعنی معرفی محصولی که مخاطب ایرانی
// کمتر با آن نسبت دارد، در حالی که بازار ایران قلب پلتفرم است و بازارهایش را
// خود کاربران ساخته‌اند.
export default async function PredictTicker({
  variant = "volume",
  reverse = false,
}: Props) {
  let items: { id: string; label: string; pct: number }[] = [];
  try {
    await ensureIrTables();
    const pool = await db();
    // پرحجم‌ترین‌ها یا نزدیک‌ترین سررسیدها؛ در هر دو حالت فقط بازار باز و
    // به‌موعدنرسیده، چون کلیک روی بازار بسته کاربر را به بن‌بست می‌برد.
    const order =
      variant === "ending"
        ? "m.closes_at ASC"
        : "(m.yes_total + m.no_total) DESC, m.closes_at ASC";
    const { rows } = await pool.query<{
      id: number;
      question: string;
      yes_total: string;
      no_total: string;
    }>(
      `SELECT id, question, yes_total, no_total
         FROM ir_markets m
        WHERE m.status = 'open' AND m.closes_at > now()
        ORDER BY ${order}
        LIMIT 18`
    );
    items = rows.map((r) => {
      const yes = Number(r.yes_total);
      const no = Number(r.no_total);
      const total = yes + no;
      return {
        id: String(r.id),
        label: shorten(r.question),
        // بازار بدون پیش‌بینی، ۵۰٪ است — نه صفر.
        pct: total > 0 ? Math.round((yes / total) * 100) : 50,
      };
    });
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
          href={`/iran/m/${m.id}`}
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
      className="narmoon-ticker relative overflow-hidden border-y border-line bg-surface/30 py-3"
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
        /* توقف روی هاور.
           !important اجباری است: انیمیشن با style درون‌خطی ست می‌شود و
           شورتهندِ animation، خودِ animation-play-state را هم به running
           برمی‌گرداند. استایل درون‌خطی بر قاعده‌ی این استایل‌شیت مقدم است،
           پس بدون !important این قاعده هرگز برنده نمی‌شد و نوار زیر موس
           هم به حرکت ادامه می‌داد. */
        .narmoon-ticker:hover .narmoon-track,
        .narmoon-ticker:focus-within .narmoon-track {
          animation-play-state: paused !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .narmoon-track { animation: none !important; }
        }
      `}</style>

      <div
        className="narmoon-track flex w-max"
        style={{ animation: `${anim} 150s linear infinite` }}
      >
        <Copy tag="a" />
        <Copy tag="b" />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-ink via-ink/70 to-transparent" />
    </div>
  );
}
