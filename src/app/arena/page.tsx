import { redirect } from "next/navigation";

// ترید پیش‌بینی و کمبو در پنل ترید ادغام شدند: هر دو روی همان جدول و همان
// امتیازدهی کار می‌کنند و داشتن سه صفحه‌ی جدا برای کاربر گیج‌کننده بود.
// این مسیر برای لینک‌های قدیمی و بوکمارک‌ها نگه داشته شده.
export default function ArenaRedirect() {
  redirect("/trade");
}
