import { redirect } from "next/navigation";

// کارنامه‌ی زنده داخل صفحه‌ی ربات معامله‌گر ادغام شد: هر دو یک محصول را
// توصیف می‌کنند و داشتن دو صفحه‌ی جدا یعنی کاربر برای فهمیدن یک چیز دو جا
// می‌رفت. این مسیر برای لینک‌های قدیمی و بوکمارک‌ها نگه داشته شده.
export default function ResultsRedirect() {
  redirect("/bot#results");
}
