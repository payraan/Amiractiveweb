"use client";

// اجزای مشترک مینی‌اپ. عمدا کوچک و بدون وابستگی — همان رنگ و فونت سایت.

export function Skeleton({ className = "" }: { className?: string }) {
  // اسکلتون به‌جای صفحه‌ی سفید یا اسپینر: کاربر شکل نهایی را از همان لحظه‌ی
  // اول می‌بیند و پرش چیدمان (layout shift) موقع رسیدن داده ندارد.
  //
  // ⚠️ گردی پایه فقط وقتی اعمال می‌شود که فراخوان خودش گردی نداده باشد.
  // گذاشتن `rounded-full` در className کافی نبود: هر دو کلاس ویژگی یکسان
  // دارند و برنده را ترتیب فایل CSS تعیین می‌کند نه ترتیب رشته — و آنجا
  // `rounded-xl` برنده می‌شد. نتیجه: اسکلتِ دکمه‌های گردِ کیف پول مربع
  // درمی‌آمد و شکلِ چیزی را که می‌آمد نمی‌گرفت.
  const radius = /(^|\s)rounded(-|\s|$)/.test(className) ? "" : "rounded-xl ";
  return (
    <div
      className={`animate-pulse ${radius}border border-line bg-surface/40 ${className}`}
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
/**
 * راه بازگشتِ **دیدنی** از یک زیرصفحه.
 *
 * ── چرا لازم است، در حالی که دکمه‌ی بومی تلگرام هم هست ──
 * هر زیرصفحه `showBackButton` را صدا می‌زند و دکمه‌ی بازگشتِ خودِ تلگرام
 * بالای پنجره روشن می‌شود. ولی آن دکمه بخشی از **پوسته‌ی تلگرام** است، نه
 * اپ ما: روی کلاینت‌های مختلف جای متفاوتی می‌نشیند، گاهی کنار دکمه‌ی بستن
 * گم می‌شود، و کاربری که برای اولین بار مینی‌اپ باز کرده اصلا دنبالش
 * نمی‌گردد. نتیجه‌اش این بود که کاربر یا اپ را می‌بست یا از نوار تب پایین
 * برمی‌گشت — یعنی از اول شروع می‌کرد.
 *
 * پس هر دو با هم: دکمه‌ی بومی برای کسی که می‌شناسدش، و این برای بقیه.
 *
 * ⚠️ یک تعریف برای همه‌ی زیرصفحه‌ها. اگر هر صفحه نسخه‌ی خودش را داشته
 * باشد، دیر یا زود جای دکمه و لحن متنش از هم جدا می‌شوند — همان الگویی
 * که در این پروژه بارها تکرار شده.
 */
export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // هدف لمس کامل‌عرض نیست ولی ارتفاعش کافی است؛ گوشه‌ی بالا-راست در
      // RTL همان جایی است که انگشت شست به آن می‌رسد.
      className="-mr-1 mb-2 flex items-center gap-1 px-1 py-1.5 text-[11.5px] text-muted transition active:text-cream"
    >
      <span aria-hidden>‹</span>
      {label}
    </button>
  );
}

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

/**
 * فیلد جست‌وجوی فهرست‌ها.
 *
 * با ده بازار فیلتر دسته کافی است؛ با صد بازار نیست، و کاربر باید بتواند
 * «دلار» یا «استقلال» را تایپ کند. به همین دلیل خودِ فراخوان تصمیم می‌گیرد
 * کِی نشانش بدهد (معمولا از یک آستانه‌ی تعداد به بعد) — یک فیلد جست‌وجو
 * روی فهرست پنج‌تایی فقط فضای عمودی می‌خورد.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "جست‌وجو…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mb-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="no-zoom w-full rounded-xl border border-line bg-surface/40 py-2 pe-9 ps-3 text-[12px] text-cream outline-none transition placeholder:text-muted focus:border-gold/50"
      />
      {/* ذره‌بین و ضربدر جای هم می‌نشینند، هر دو در سمت end.
          ⚠️ ضربدر نباید سمت start باشد: در چیدمان راست‌به‌چپ، start همان
          لبه‌ای است که متن از آن شروع می‌شود و دکمه روی حرف اول می‌افتد. */}
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="پاک کردن جست‌وجو"
          className="absolute inset-y-0 end-1 flex items-center px-2 text-[12px] text-muted transition active:text-cream"
        >
          ✕
        </button>
      ) : (
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[13px] text-muted">
          ⌕
        </span>
      )}
    </div>
  );
}
