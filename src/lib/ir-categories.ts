// دسته‌بندی بازارهای ایران.
// این فایل عمدا هیچ وابستگی سمت‌سروری ندارد تا هم در روت‌های API و هم در
// کامپوننت‌های کلاینت import شود و فهرست دسته‌ها در یک جا بماند.
// شناسه‌ها در دیتابیس ذخیره می‌شوند — هرگز تغییرشان نده، فقط اضافه کن.

export const IR_CATEGORIES: { id: string; label: string }[] = [
  { id: "economy", label: "اقتصاد" },
  { id: "sports", label: "ورزش" },
  { id: "crypto", label: "کریپتو" },
  { id: "social", label: "اجتماعی" },
  { id: "other", label: "سایر" },
];

export function isIrCategory(id: string): boolean {
  return IR_CATEGORIES.some((c) => c.id === id);
}
