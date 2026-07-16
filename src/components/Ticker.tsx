const quotes = [
  { sym: "XAUUSD", price: "3,412.40", chg: "+0.84%", up: true },
  { sym: "EURUSD", price: "1.0862", chg: "-0.12%", up: false },
  { sym: "GBPUSD", price: "1.2748", chg: "+0.21%", up: true },
  { sym: "USDJPY", price: "156.32", chg: "-0.34%", up: false },
  { sym: "DXY", price: "104.21", chg: "+0.05%", up: true },
  { sym: "BTCUSD", price: "118,450", chg: "+2.31%", up: true },
  { sym: "ETHUSD", price: "4,120", chg: "+1.12%", up: true },
  { sym: "US30", price: "44,890", chg: "+0.42%", up: true },
];

export default function Ticker() {
  const row = [...quotes, ...quotes];
  return (
    <div dir="ltr" className="ticker fade-x overflow-hidden border-y border-line bg-surface/50">
      <div className="marquee flex w-max items-center px-6 py-3 font-mono text-xs">
        {row.map((q, i) => (
          <span key={i} className="me-10 flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted">{q.sym}</span>
            <span className="text-cream">{q.price}</span>
            <span className={q.up ? "text-gain" : "text-loss"}>{q.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
