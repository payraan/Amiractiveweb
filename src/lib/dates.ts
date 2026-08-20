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

/**
 * زمان باقی‌مانده تا یک لحظه، مثل «۳ ساعت مانده».
 *
 * اینجاست و نه داخل صفحه‌ها، چون هم بازار ایران و هم ترید همین را
 * می‌خواهند — و دو نسخه یعنی روزی یکی «۱ روز» بگوید و دیگری «۲۴ ساعت».
 */
export function remaining(iso: string | undefined): string {
  const d = parse(iso ?? "");
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "پایان‌یافته";
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return "کمتر از یک ساعت";
  if (h < 24) return `${h} ساعت مانده`;
  return `${Math.floor(h / 24)} روز مانده`;
}

/** آیا تا ۲۴ ساعت آینده تعیین تکلیف می‌شود؟ */
export function closingSoon(iso: string | undefined): boolean {
  const d = parse(iso ?? "");
  if (!d) return false;
  const left = d.getTime() - Date.now();
  return left > 0 && left <= 24 * 3600_000;
}

/* ─────────── ساختِ زمانِ بسته‌شدن بر پایه‌ی ساعتِ دیوارِ تهران ─────────── */

/** ساعت دیوارِ تهرانِ یک لحظه، به‌صورت میلی‌ثانیه‌ی UTC تفسیرشده. */
function tehranWallAsUtc(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  // ⚠️ `% 24` لازم است: بعضی محیط‌ها نیمه‌شب را «24» می‌دهند نه «00».
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
}

/**
 * لحظه‌ای که ساعتِ دیوارِ تهران در آن `hour:minute` روزِ «امروز + offsetDays»
 * است.
 *
 * ⚠️ چرا این‌قدر پیچیده و چرا +۳:۳۰ سخت‌کد نشده: سرور در استانبول اجرا
 * می‌شود، پس «امشب ساعت ۲۳:۵۹» با ساعت سرور یعنی یک ساعت زودتر از آنچه
 * کاربر ایرانی می‌فهمد. و آفست ثابت هم جواب نیست — امروز درست است، ولی
 * اولین باری که قانون ساعت عوض شود، هر بازار روزانه یک ساعت جابه‌جا
 * می‌شود و هیچ‌کس تا بعدِ تسویه نمی‌فهمد. این نسخه آفست را از خود Intl
 * می‌گیرد، پس هر تغییری را خودکار دنبال می‌کند.
 */
export function tehranAt(offsetDays: number, hour: number, minute = 0): Date {
  const now = new Date();
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  );
  const targetWall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day) + offsetDays,
    hour,
    minute,
    0
  );
  const offset = tehranWallAsUtc(now) - now.getTime();
  return new Date(targetWall - offset);
}
