import { redirect } from "next/navigation";

// معرفی بروکر همکار داخل صفحه‌ی ربات معامله‌گر ادغام شد — بروکر فقط در
// همان زمینه معنا دارد: جایی که ربات اجرا می‌شود و حساب جایزه‌ی چالش صادر
// می‌شود. این مسیر برای لینک‌های قدیمی و بوکمارک‌ها نگه داشته شده.
export default function BrokerRedirect() {
  redirect("/bot#broker");
}
