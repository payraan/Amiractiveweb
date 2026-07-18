"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Asset } from "@/lib/game";

type Raw = { time: number; open: number; high: number; low: number; close: number };

export default function LiveChart({
  asset,
  interval,
}: {
  asset: Asset;
  interval: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

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
      crosshair: { horzLine: { color: "#e8c46a" }, vertLine: { color: "#e8c46a" } },
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

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

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

  return (
    <div className="relative w-full">
      <div ref={boxRef} className="h-[260px] w-full" />
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
