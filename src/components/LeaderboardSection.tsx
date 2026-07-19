import Link from "next/link";
import Leaderboard from "@/components/predict/Leaderboard";

export default function LeaderboardSection() {
  return (
    <section
      id="leaderboard"
      className="relative mx-auto max-w-3xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <span className="font-mono text-[11px] tracking-[0.4em] text-gold" dir="ltr">
        PREDICTION ARENA
      </span>
      <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">
        آرنای پیش‌بینی
      </h2>
      <p className="mt-4 max-w-xl leading-8 text-muted">
        قیمت فردای بیت‌کوین و طلا را حدس بزنید، بر اساس دقت امتیاز بگیرید و در
        لیدربورد بالا بروید. نفرات برتر ماهانه، اشتراک ربات و حساب معاملاتی
        جایزه می‌گیرند — رقابتی مهارتی و کاملاً رایگان.
      </p>

      <div className="mt-8">
        <Leaderboard defaultRange="monthly" limit={5} />
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/predict"
          className="rounded-xl bg-gold px-6 py-3 font-display font-extrabold text-ink transition hover:bg-gold-deep"
        >
          شروع پیش‌بینی
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-xl border border-line px-6 py-3 text-cream transition hover:border-gold hover:text-gold"
        >
          لیدربورد کامل
        </Link>
      </div>
    </section>
  );
}
