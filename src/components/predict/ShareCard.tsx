"use client";

import { useRef, useState } from "react";
import type { GameResult } from "@/components/predict/usePlayer";

// Story format 1080x1920. Drawn on canvas so it can be downloaded as PNG
// and shared to Instagram stories — every card is free advertising.

const SITE = "amiractive.com";

function drawCard(
  canvas: HTMLCanvasElement,
  opts: { name: string; result: GameResult }
) {
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { name, result } = opts;
  const win = (result.points ?? 0) >= 0;
  const gold = "#e8c46a";
  const goldDeep = "#b9892f";
  const gain = "#3ecf8e";
  const loss = "#e5484d";

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0a0c");
  bg.addColorStop(1, "#131318");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ambient gold glow
  const glow = ctx.createRadialGradient(W * 0.7, H * 0.25, 0, W * 0.7, H * 0.25, 700);
  glow.addColorStop(0, "rgba(232,196,106,0.10)");
  glow.addColorStop(1, "rgba(232,196,106,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // border frame
  ctx.strokeStyle = "rgba(232,196,106,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  ctx.textAlign = "center";

  // brand wordmark
  ctx.fillStyle = gold;
  ctx.font = "700 46px monospace";
  ctx.fillText("A M I R A C T I V E", W / 2, 200);

  ctx.fillStyle = "#8f8c85";
  ctx.font = "400 30px sans-serif";
  ctx.fillText("PREDICTION ARENA", W / 2, 250);

  // asset + timeframe
  const assetLabel = result.asset === "BTC" ? "BITCOIN" : "GOLD";
  ctx.fillStyle = "#f4f1e8";
  ctx.font = "700 64px sans-serif";
  ctx.fillText(`${assetLabel} · ${result.timeframe}`, W / 2, 520);

  // big points
  ctx.fillStyle = win ? gain : loss;
  ctx.font = "800 300px monospace";
  const pts = result.points ?? 0;
  ctx.fillText(`${pts >= 0 ? "+" : ""}${pts}`, W / 2, 900);

  ctx.fillStyle = "#8f8c85";
  ctx.font = "400 40px sans-serif";
  ctx.fillText("امتیاز این پیش‌بینی", W / 2, 990);

  // accuracy pill
  if (result.errorPct != null) {
    ctx.fillStyle = "rgba(232,196,106,0.12)";
    const pillW = 520;
    const pillX = (W - pillW) / 2;
    roundRect(ctx, pillX, 1080, pillW, 90, 45);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.font = "700 44px monospace";
    ctx.fillText(`دقت: خطای ${result.errorPct.toFixed(2)}٪`, W / 2, 1140);
  }

  // guess vs actual
  ctx.fillStyle = "#8f8c85";
  ctx.font = "400 38px monospace";
  ctx.fillText(
    `حدس: $${fmt(result.guess)}   واقعی: $${result.settlePrice != null ? fmt(result.settlePrice) : "—"}`,
    W / 2,
    1300
  );

  // player name
  ctx.fillStyle = "#f4f1e8";
  ctx.font = "700 56px sans-serif";
  ctx.fillText(name, W / 2, 1560);

  // CTA
  ctx.fillStyle = goldDeep;
  ctx.font = "400 40px sans-serif";
  ctx.fillText("تو هم پیش‌بینی کن و امتیاز بگیر", W / 2, 1700);
  ctx.fillStyle = gold;
  ctx.font = "700 48px monospace";
  ctx.fillText(SITE, W / 2, 1770);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function ShareCard({
  name,
  result,
  onClose,
}: {
  name: string;
  result: GameResult;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  // draw on mount
  const setCanvas = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) {
      drawCard(el, { name, result });
      setReady(true);
    }
  };

  function download() {
    const c = canvasRef.current;
    if (!c) return;
    const link = document.createElement("a");
    link.download = `amiractive-${result.asset}-${result.timeframe}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <canvas
          ref={setCanvas}
          className="w-full max-w-[280px] rounded-2xl border border-line"
          style={{ aspectRatio: "9 / 16" }}
        />
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={download}
            disabled={!ready}
            className="no-zoom flex-1 rounded-xl bg-gold py-3 font-display font-extrabold text-ink transition hover:bg-gold-deep disabled:opacity-50"
          >
            دانلود کارت
          </button>
          <button
            type="button"
            onClick={onClose}
            className="no-zoom rounded-xl border border-line px-5 text-sm text-muted transition hover:text-cream"
          >
            بستن
          </button>
        </div>
        <p className="text-center text-[11px] leading-6 text-muted">
          کارت را ذخیره کن و در استوری اینستاگرام به اشتراک بگذار.
        </p>
      </div>
    </div>
  );
}
