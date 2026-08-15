// انواع درآمد پلتفرم و برچسب فارسی‌شان — یک منبع برای سرور و پنل ادمین.
//
// چرا فایل جدا: این فهرست در `iran.ts` بود و پنل ادمین (یک کامپوننت
// "use client") نمی‌توانست از آنجا بخواند، چون `iran.ts` به `@/lib/db`
// وابسته است و ایمپورتش درایور pg را به باندل مرورگر می‌کشد. نتیجه‌اش یک
// کپی دستی در کامپوننت بود — و کپی یعنی روزی که نوع تازه‌ای اضافه شود،
// پنل ادمین کلید خام انگلیسی نشان می‌دهد.
//
// عمدا **هیچ ایمپورتی ندارد** — همان قراری که wallet-rules.ts و
// ledger-labels.ts و poly-scoring.ts دارند.

export type RevenueKind =
  | "ir_propose_fee" // کارمزد ایجاد بازار
  | "ir_propose_refund" // برگشت هزینه‌ی ساخت (بازار رد شد) — منفی
  | "ir_commission" // کمیسیون تسویه‌ی عادی
  | "ir_commission_void" // کمیسیون بازار بدون برنده
  | "ir_boost" // بوست بازار — تنها درآمدِ همیشه‌واقعی
  | "credit_sale"; // فروش MOON از موجودی کیف پول

export const REVENUE_LABEL: Record<RevenueKind, string> = {
  ir_propose_fee: "کارمزد ایجاد بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت",
  ir_commission: "کمیسیون تسویه",
  ir_commission_void: "کمیسیون بازار بدون برنده",
  ir_boost: "بوست بازار",
  credit_sale: "فروش MOON",
};
