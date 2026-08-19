import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesApi,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

// ── لایه‌ی ترسیم روی نمودار نبض بازار ────────────────────────
//
// ── چرا primitive و نه چند `<div>` روی نمودار ──
// راه ساده‌تر این بود که چند div با `position:absolute` روی نمودار بگذاریم
// و جایشان را از `priceToCoordinate` حساب کنیم. ولی مقیاس عمودی نمودار با
// هر داده‌ی تازه، هر زوم و هر تغییر اندازه جابه‌جا می‌شود و کتابخانه هیچ
// رویدادی برای «مقیاس قیمت عوض شد» نمی‌دهد. نتیجه‌اش divهایی می‌شد که یک
// فریم عقب‌اند و موقع اسکرول روی نمودار می‌لغزند.
//
// primitive در همان چرخه‌ی رسمِ خودِ کتابخانه اجرا می‌شود، پس هرگز از
// کندل‌ها عقب نمی‌ماند.
//
// ── چه چیزی رسم می‌شود ──
//   ۱. نوارهای امتیاز (پس‌زمینه) — آستانه‌های `thresholdsFor` دور قیمت
//      فعلی. تا امروز این اعداد کاملا نامرئی بودند: کاربر عددی تایپ
//      می‌کرد و هیچ حسی نداشت که «دقیق» یعنی چقدر.
//   ۲. خط حدس (نقطه‌چین) — همانی که کاربر می‌کشد.
//   ۳. پیش‌بینی‌های ثبت‌شده‌ی خودش روی همان دارایی.

export type ScoreBand = {
  /** بالاترین خطای مجاز این نوار، درصد. */
  maxErr: number;
  points: number;
};

export type SubmittedMark = { price: number; label: string };

export type OverlayState = {
  /** قیمت مرجع — مرکز نوارها. `null` یعنی نوار رسم نشود. */
  basePrice: number | null;
  bands: ScoreBand[];
  /** حدس فعلی کاربر؛ `null` یعنی هنوز چیزی نگذاشته. */
  guess: number | null;
  marks: SubmittedMark[];
};

/**
 * رنگ هر نوار بر اساس امتیازش.
 *
 * ⚠️ عمدا از خودِ **امتیاز** ساخته می‌شود، نه از ترتیب نوارها: اگر روزی
 * جدول امتیاز عوض شود، رنگ‌ها خودشان درست می‌مانند. با ترتیب، یک ردیف
 * تازه همه‌ی رنگ‌ها را جابه‌جا می‌کرد.
 */
function bandColor(points: number, maxPoints: number): string {
  if (points <= 0) return "rgba(229,72,77,0.07)"; // منفی — قرمز کم‌رنگ
  const t = maxPoints > 0 ? points / maxPoints : 0;
  // هرچه امتیاز بالاتر، سبزِ پررنگ‌تر. سقف شفافیت پایین نگه داشته شده تا
  // کندل‌ها خوانا بمانند — این لایه پس‌زمینه است، نه محتوا.
  return `rgba(62,207,142,${(0.05 + t * 0.13).toFixed(3)})`;
}

class OverlayRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly series: ISeriesApi<"Candlestick">,
    private readonly state: OverlayState,
    private readonly layer: "bg" | "fg"
  ) {}

  /** نوارها پشت کندل‌ها. */
  drawBackground(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (this.layer !== "bg") return;
    const s = this.state;
    if (s.basePrice == null || !s.bands.length) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const w = scope.bitmapSize.width;
      const r = scope.verticalPixelRatio;
      const maxPoints = Math.max(...s.bands.map((b) => b.points));

      // از پهن به تنگ رسم می‌شود تا نوار تنگ‌ترِ پرامتیازتر رویش بنشیند.
      const sorted = [...s.bands].sort((a, b) => b.maxErr - a.maxErr);
      for (const band of sorted) {
        if (!Number.isFinite(band.maxErr)) continue;
        const delta = (s.basePrice! * band.maxErr) / 100;
        const top = this.series.priceToCoordinate(s.basePrice! + delta);
        const bot = this.series.priceToCoordinate(s.basePrice! - delta);
        if (top == null || bot == null) continue;
        ctx.fillStyle = bandColor(band.points, maxPoints);
        ctx.fillRect(0, top * r, w, (bot - top) * r);
      }
    });
  }

  /** خط حدس و پیش‌بینی‌های ثبت‌شده، روی کندل‌ها. */
  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (this.layer !== "fg") return;
    const s = this.state;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const w = scope.bitmapSize.width;
      const r = scope.verticalPixelRatio;
      const hr = scope.horizontalPixelRatio;

      // پیش‌بینی‌های ثبت‌شده — طلایی و ممتد، تا با خطِ در حال کشیدن
      // اشتباه گرفته نشوند.
      for (const m of s.marks) {
        const y = this.series.priceToCoordinate(m.price);
        if (y == null) continue;
        ctx.save();
        ctx.strokeStyle = "rgba(232,196,106,0.85)";
        ctx.lineWidth = 1 * r;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, y * r);
        ctx.lineTo(w, y * r);
        ctx.stroke();
        ctx.restore();
      }

      // خط حدس — نقطه‌چین و ضخیم‌تر، چون کنش فعال کاربر است.
      if (s.guess != null) {
        const y = this.series.priceToCoordinate(s.guess);
        if (y != null) {
          // بالای قیمت مرجع سبز، پایینش قرمز — همان قراردادی که کل محصول
          // برای بالا/پایین دارد.
          const up = s.basePrice != null && s.guess >= s.basePrice;
          ctx.save();
          ctx.strokeStyle = up ? "#3ecf8e" : "#e5484d";
          ctx.lineWidth = 2 * r;
          ctx.setLineDash([6 * hr, 5 * hr]);
          ctx.beginPath();
          ctx.moveTo(0, y * r);
          ctx.lineTo(w, y * r);
          ctx.stroke();

          // دستگیره‌ی لبه‌ی راست — تنها نشانه‌ی دیداریِ «این را می‌شود کشید».
          ctx.setLineDash([]);
          ctx.fillStyle = up ? "#3ecf8e" : "#e5484d";
          const cx = w - 9 * hr;
          ctx.beginPath();
          ctx.arc(cx, y * r, 5 * hr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    });
  }
}

class OverlayPaneView implements IPrimitivePaneView {
  constructor(
    private readonly series: ISeriesApi<"Candlestick">,
    private readonly state: OverlayState,
    private readonly layer: "bg" | "fg"
  ) {}
  zOrder() {
    return this.layer === "bg" ? ("bottom" as const) : ("top" as const);
  }
  renderer() {
    return new OverlayRenderer(this.series, this.state, this.layer);
  }
}

/**
 * لایه‌ی ترسیم، به‌شکل یک primitive قابل اتصال به سری کندل.
 *
 * ⚠️ `state` **جهش‌پذیر** است و عمدا: فراخوان با `setState` مقدارش را عوض
 * می‌کند و `requestUpdate` رسم دوباره می‌خواهد. ساختن primitive تازه در هر
 * تغییر، هر بار سری را detach/attach می‌کرد و نمودار پرش می‌زد.
 */
export class ChartOverlay implements ISeriesPrimitive<Time> {
  private state: OverlayState = {
    basePrice: null,
    bands: [],
    guess: null,
    marks: [],
  };
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: (() => void) | null = null;
  private views: IPrimitivePaneView[] = [];

  attached(p: SeriesAttachedParameter<Time>): void {
    this.series = p.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = p.requestUpdate;
    this.views = [
      new OverlayPaneView(this.series, this.state, "bg"),
      new OverlayPaneView(this.series, this.state, "fg"),
    ];
  }

  detached(): void {
    this.series = null;
    this.requestUpdate = null;
    this.views = [];
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  setState(next: Partial<OverlayState>): void {
    Object.assign(this.state, next);
    this.requestUpdate?.();
  }

  /** مختصات عمودی خط حدس — برای جای‌دادن ناحیه‌ی لمس. */
  guessY(): number | null {
    if (!this.series || this.state.guess == null) return null;
    return this.series.priceToCoordinate(this.state.guess);
  }

  /** قیمت متناظر یک مختصات عمودی — برای کشیدن. */
  priceAt(y: number): number | null {
    if (!this.series) return null;
    const p = this.series.coordinateToPrice(y);
    return p == null ? null : Number(p);
  }
}
