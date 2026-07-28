// نمایش تاریخ برای کاربر فارسی‌زبان.
//
// منطقه‌ی زمانی عمدا روی تهران قفل شده است. بدون آن، سرور (که روی UTC
// اجرا می‌شود) و مرورگر کاربر ممکن است مرز روز را متفاوت حساب کنند و
// همان تاریخ در رندر سرور و کلاینت یک روز اختلاف بگیرد (خطای هیدریشن).

const TZ = "Asia/Tehran";

/** تاریخ معتبر یا null. توجه: Date نامعتبر خطا پرتاب نمی‌کند و
    toLocaleDateString رویش رشته‌ی «Invalid Date» می‌دهد، پس باید صریح
    بررسی شود — مخصوصا چون endDate پالی‌مارکت گاهی خالی برمی‌گردد. */
function parse(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** تاریخ شمسی، مثل «۱۷ آبان ۱۴۰۷» */
export function faDate(iso: string): string {
  const d = parse(iso);
  if (!d) return "";
  try {
    return d.toLocaleDateString("fa-IR", {
      timeZone: TZ,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** تاریخ میلادی، مثل «8 Nov 2028» */
export function enDate(iso: string): string {
  const d = parse(iso);
  if (!d) return "";
  try {
    return d.toLocaleDateString("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** هر دو کنار هم: «۱۷ آبان ۱۴۰۷ · 8 Nov 2028» */
export function dualDate(iso: string): string {
  const fa = faDate(iso);
  const en = enDate(iso);
  if (!fa && !en) return "";
  if (!en) return fa;
  if (!fa) return en;
  return `${fa} · ${en}`;
}

/** تاریخ و ساعت شمسی + میلادی، برای جایی که ساعت هم مهم است */
export function dualDateTime(iso: string): string {
  const d = parse(iso);
  if (!d) return "";
  try {
    const fa = d.toLocaleString("fa-IR", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const en = d.toLocaleString("en-GB", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fa} · ${en}`;
  } catch {
    return "";
  }
}
