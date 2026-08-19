"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Asset } from "@/lib/game";
import {
  ChartOverlay,
  type ScoreBand,
  type SubmittedMark,
} from "@/components/predict/chart-overlay";

type Raw = { time: number; open: number; high: number; low: number; close: number };

export default function LiveChart({
  asset,
  interval,
  guess = null,
  onGuessChange,
  basePrice = null,
  bands,
  marks,
}: {
  asset: Asset;
  interval: string;
  /** حدس فعلی کاربر — خط نقطه‌چین کشیدنی. */
  guess?: number | null;
  /** با کشیدن خط صدا زده می‌شود. نبودنش یعنی خط ثابت و غیرقابل کشیدن. */
  onGuessChange?: (price: number) => void;
  /** قیمت مرجعِ نوارهای امتیاز. */
  basePrice?: number | null;
  bands?: ScoreBand[];
  /** پیش‌بینی‌های ثبت‌شده‌ی همین کاربر روی همین دارایی. */
  marks?: SubmittedMark[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlayRef = useRef<ChartOverlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  /** جای عمودی دستگیره، برای ناحیه‌ی لمس. */
  const [handleY, setHandleY] = useState<number | null>(null);

  // create chart once
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8f8c85",
        fontFamily: "var(--font-jbmono), monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(38,38,46,0.5)" },
        horzLines: { color: "rgba(38,38,46,0.5)" },
      },
      rightPriceScale: { borderColor: "#26262e" },
      timeScale: { borderColor: "#26262e", timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: { color: "#e8c46a", labelBackgroundColor: "#b9892f" },
        vertLine: { color: "#e8c46a", labelBackgroundColor: "#b9892f" },
      },
      height: 260,
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3ecf8e",
      downColor: "#e5484d",
      borderUpColor: "#3ecf8e",
      borderDownColor: "#e5484d",
      wickUpColor: "#3ecf8e",
      wickDownColor: "#e5484d",
    });

    const overlay = new ChartOverlay();
    series.attachPrimitive(overlay);

    chartRef.current = chart;
    seriesRef.current = series;
    overlayRef.current = overlay;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // ── هم‌رسانی وضعیت لایه ────────────────────────────────────
  useEffect(() => {
    overlayRef.current?.setState({
      guess,
      basePrice,
      bands: bands ?? [],
      marks: marks ?? [],
    });
  }, [guess, basePrice, bands, marks]);

  // ── جای دستگیره ───────────────────────────────────────────
  //
  // ⚠️ با حلقه‌ی رسم دنبال می‌شود و نه با یک رویداد، چون کتابخانه هیچ
  // رویدادی برای «مقیاس قیمت عوض شد» ندارد و آن مقیاس با هر داده‌ی تازه،
  // هر زوم و هر تغییر اندازه جابه‌جا می‌شود. فقط وقتی مقدار **واقعا** فرق
  // کند setState زده می‌شود، پس رندر اضافه‌ای نمی‌سازد.
  useEffect(() => {
    if (!onGuessChange) return;
    let raf = 0;
    let last: number | null = null;
    const tick = () => {
      const y = overlayRef.current?.guessY() ?? null;
      const rounded = y == null ? null : Math.round(y);
      if (rounded !== last) {
        last = rounded;
        setHandleY(rounded);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onGuessChange]);

  // load + refresh data
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/predict/candles?asset=${asset}&interval=${interval}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        const raw: Raw[] = j?.candles ?? [];
        if (!alive || !seriesRef.current) return;
        if (!raw.length) {
          setEmpty(true);
          setLoading(false);
          return;
        }
        const data: CandlestickData[] = raw.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
        setEmpty(false);
        setLoading(false);
      } catch {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15_000); // live-ish refresh
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [asset, interval]);

  // ── کشیدن خط ──────────────────────────────────────────────
  //
  // ⚠️ ناحیه‌ی لمس **فقط دور خودِ خط** است و نه کل نمودار. کتابخانه لمس را
  // برای جابه‌جایی و زوم می‌گیرد؛ یک لایه‌ی تمام‌صفحه آن را می‌کشت و کاربر
  // دیگر نمی‌توانست نمودار را حرکت بدهد.
  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onGuessChange || !boxRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = boxRef.current;
    const move = (ev: PointerEvent) => {
      const y = ev.clientY - box.getBoundingClientRect().top;
      const p = overlayRef.current?.priceAt(y);
      if (p != null && Number.isFinite(p) && p > 0) onGuessChange(p);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="relative w-full">
      <div ref={boxRef} className="h-[260px] w-full" />

      {/* نوار لمسِ خط حدس — ۴۰ پیکسل، مرکز روی خط. */}
      {onGuessChange && handleY != null && (
        <div
          onPointerDown={onDrag}
          style={{ top: handleY - 20 }}
          className="absolute inset-x-0 h-10 cursor-ns-resize touch-none"
          aria-label="جابه‌جایی خط پیش‌بینی"
        />
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
          در حال بارگذاری نمودار…
        </div>
      )}
      {empty && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
          داده‌ی نمودار در دسترس نیست.
        </div>
      )}
    </div>
  );
}
