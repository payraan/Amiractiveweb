const tape = [
  { sym: "XAUUSD", price: "3,412.40", change: "+0.84%", up: true },
  { sym: "EURUSD", price: "1.0862", change: "-0.12%", up: false },
  { sym: "DXY", price: "104.21", change: "+0.05%", up: true },
  { sym: "BTCUSD", price: "118,450", change: "+2.31%", up: true },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <span className="font-mono text-xs uppercase tracking-[0.5em] text-gold">
        Amiractive
      </span>

      <h1 className="max-w-3xl text-center font-display text-5xl font-black leading-[1.3] md:text-7xl">
        اثبات زنده، <span className="text-gold">نه وعده</span>
      </h1>

      <p className="max-w-xl text-center leading-8 text-muted">
        این یک صفحه‌ی تست هویته — فونت تیتر (استعداد)، فونت متن (وزیرمتن)،
        فونت اعداد (مونو) و پالت طلایی/دارک باید همین‌جا درست دیده بشن.
      </p>

      <div
        dir="ltr"
        className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm"
      >
        {tape.map((t) => (
          <div
            key={t.sym}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2"
          >
            <span className="text-muted">{t.sym}</span>
            <span>{t.price}</span>
            <span className={t.up ? "text-gain" : "text-loss"}>{t.change}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="#"
          className="rounded-xl bg-gold px-7 py-3 font-display font-extrabold text-ink transition hover:bg-gold-deep"
        >
          ورود به کانال تلگرام
        </a>
        <a
          href="#"
          className="rounded-xl border border-line px-7 py-3 text-cream transition hover:border-gold hover:text-gold"
        >
          نتایج زنده‌ی ربات
        </a>
      </div>
    </main>
  );
}
