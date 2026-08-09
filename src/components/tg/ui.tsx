"use client";

// اجزای مشترک مینی‌اپ. عمدا کوچک و بدون وابستگی — همان رنگ و فونت سایت.

export function Skeleton({ className = "" }: { className?: string }) {
  // اسکلتون به‌جای صفحه‌ی سفید یا اسپینر: کاربر شکل نهایی را از همان لحظه‌ی
  // اول می‌بیند و پرش چیدمان (layout shift) موقع رسیدن داده ندارد.
  return (
    <div
      className={`animate-pulse rounded-xl border border-line bg-surface/40 ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/40 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "gain" | "loss";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "gain"
        ? "text-gain"
        : tone === "loss"
          ? "text-loss"
          : "text-cream";
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-3 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div dir="ltr" className={`mt-1 font-mono text-sm ${color}`}>
        {value}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/30 px-5 py-10 text-center">
      <p className="text-sm font-bold text-cream">{title}</p>
      {hint && <p className="mt-2 text-[11px] leading-6 text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-loss/40 bg-loss/5 p-5 text-center">
      <p className="text-sm font-bold text-loss">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-[11px] text-muted transition hover:text-cream"
        >
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

/** عنوان هر صفحه — یک‌دست در همه‌ی تب‌ها. */
export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-black text-cream">{title}</h2>
      {subtitle && <p className="mt-1 text-[11px] text-muted">{subtitle}</p>}
    </div>
  );
}
