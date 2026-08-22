"use client";

import { usePathname } from "next/navigation";
import DemoBanner, { type DemoNotice } from "@/components/DemoBanner";

// بنر دمو برای **سایت** — در لایوت ریشه نشسته تا در همه‌ی صفحه‌ها بیاید.
//
// ── چرا در لایوت و نه کنار هر `<Nav />` ──
// `Nav` در حدود پانزده صفحه جداگانه صدا زده می‌شود. گذاشتن بنر کنار هر
// کدام یعنی پانزده جا که یکی‌شان روزی جا می‌ماند — و صفحه‌ای که بنر
// نداشته باشد، دقیقا همان صفحه‌ای است که کاربر فکر می‌کند پولش واقعی است.
//
// ── چرا این لایه‌ی کلاینت لازم است ──
// لایوت ریشه **همه‌چیز** را می‌پوشاند، از جمله مینی‌اپ و پنل ادمین:
//   • مینی‌اپ بنر خودش را دارد (داخل قاب تلگرام و فشرده‌تر) → دو بنر می‌شد
//   • ادمین خودش می‌داند در چه حالتی است → فضای عمودی هدر می‌رفت
// تشخیص مسیر فقط سمت کلاینت ممکن است، پس این پوسته‌ی نازک وجود دارد.
// متن و تصمیمِ «آیا اصلا دمو هستیم» همچنان از سرور می‌آید.

const HIDE_ON = ["/app", "/admin"];

export default function SiteDemoBanner({
  notice,
}: {
  notice: DemoNotice | null;
}) {
  const path = usePathname() ?? "";
  if (!notice) return null;
  if (HIDE_ON.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-24 md:px-6">
      <DemoBanner notice={notice} />
    </div>
  );
}
