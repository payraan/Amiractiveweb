"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Market = {
  id: string;
  question: string;
  eventTitle: string;
  endDate: string;
  yesPct: number;
  category: string;
  categoryLabel: string;
};

type PricePoint = { t: number; p: number };

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function BigSpark({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-muted">
        داده‌ی نمودار در دسترس نیست.
      </div>
    );
  }
  const W = 640;
  const H = 180;
  const ps = points.map((x) => x.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = max - min || 0.01;
  const coords = points.map((pt, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - 12 - ((pt.p - min) / span) * (H - 30);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${coords[0]} L ${coords.slice(1).join(" L ")}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const last = points[points.length - 1].p;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" preserveAspectRatio="none">
        <path d={area} fill="rgba(232,196,106,0.08)" />
        <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted" dir="ltr">
        <span>
          Yes {Math.round(min * 100)}%–{Math.round(max * 100)}% (7d)
        </span>
        <span className="text-gold">now {Math.round(last * 100)}%</span>
      </div>
    </div>
  );
}

export default function MarketView({ id }: { id: string }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/predict/poly-markets", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/predict/poly-history?market=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }).then((r) => r.json()),
    ])
      .then(([mj, hj]) => {
        if (!alive) return;
        const m = (mj.markets ?? []).find((x: Market) => x.id === id) ?? null;
        setMarket(m);
        setPoints(hj.points ?? []);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  function copyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  if (loading) {
    return <div className="py-20 text-center text-xs text-muted">در حال بارگذاری بازار…</div>;
  }

  if (!market) {
    return (
      <div className="rounded-2xl border border-line bg-surface/40 p-8 text-center">
        <p className="text-sm text-muted">
          این بازار در حال حاضر در فهرست فعال آرنا نیست.
        </p>
        <Link
          href="/arena"
          className="mt-5 inline-block rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
        >
          مشاهده‌ی بازارهای فعال
        </Link>
      </div>
    );
  }

  const tweetText = `${market.question} — Yes ${market.yesPct}% | پیش‌بینی کن و امتیاز بگیر:`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText
  )}&url=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.href : ""
  )}`;

  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-6 transition-all duration-300 hover:border-gold/50">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">
          {market.categoryLabel}
        </span>
        <span className="font-mono text-[10px] text-muted" dir="ltr">
          {market.eventTitle}
        </span>
      </div>

      <h1 className="mt-4 text-lg font-black leading-9" dir="ltr">
        {market.question}
      </h1>

      <div className="mt-4">
        <div className="flex justify-between font-mono text-sm" dir="ltr">
          <span className="text-gain">Yes {market.yesPct}%</span>
          <span className="text-loss">No {Math.round((100 - market.yesPct) * 10) / 10}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-loss/25">
          <div
            className="h-full rounded-full bg-gain"
            style={{ width: `${market.yesPct}%` }}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-ink/40 p-4">
        <BigSpark points={points} />
      </div>

      <div className="mt-3 text-[11px] text-muted">
        بسته‌شدن بازار: {faDate(market.endDate)}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/arena"
          className="rounded-xl bg-gold px-6 py-3 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
        >
          ثبت پیش‌بینی در آرنا
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="no-zoom rounded-xl border border-line px-6 py-3 text-sm text-cream transition hover:border-gold hover:text-gold"
        >
          {copied ? "کپی شد ✓" : "کپی لینک"}
        </button>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-line px-6 py-3 text-sm text-cream transition hover:border-gold hover:text-gold"
          dir="ltr"
        >
          اشتراک در X
        </a>
      </div>
    </div>
  );
}
