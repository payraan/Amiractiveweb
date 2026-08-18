// ═══ لاگ ساخت‌یافته ══════════════════════════════════════════
//
// ── چرا این فایل وجود دارد ──
// تا امروز کل پلتفرم ۱۳ فراخوان `console` داشت، آن هم پراکنده و با متن
// آزاد. یعنی وقتی روی پروداکشن چیزی خراب می‌شد، تنها راه فهمیدن، بازسازی
// دستی همان سناریو بود. برای پلتفرمی که پول واقعی جابه‌جا می‌کند، این
// یعنی کور بودن.
//
// ── چرا JSON و نه متن خوانا ──
// Railway هر خط stdout را می‌گیرد و در جست‌وجو نشان می‌دهد. با متن آزاد
// فقط می‌شود دنبال کلمه گشت؛ با JSON می‌شود دنبال **فیلد** گشت:
// «همه‌ی برداشت‌های بازیکن ۷»، «همه‌ی خطاهای درگاه»، «هر رویدادی که بیش
// از ۲ ثانیه طول کشیده». همان تفاوتِ «یادداشت» و «داده».
//
// ── چرا نام رویداد نقطه‌دار ──
// `deposit.credited` و `withdraw.failed` و `boost.purchased` سلسله‌مراتب
// می‌سازند: جست‌وجوی `evt:deposit.*` کل مسیر واریز را می‌دهد. متن آزاد
// این را نمی‌دهد.
//
// ⚠️ **هیچ‌وقت راز لاگ نکن.** پایین یک فهرست حذف هست که کلیدهای حساس را
// می‌گیرد، ولی آن تور آخر است نه مجوز. لاگی که توکن نشست یا کلید درگاه
// در آن باشد، همان لحظه به یک نشت تبدیل می‌شود — و لاگ‌ها معمولا جای
// امنی نگه داشته نمی‌شوند.

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * حداقل سطحی که چاپ می‌شود. پیش‌فرض `info` — `debug` فقط وقتی که عمدا
 * روشنش کنی، وگرنه لاگ پروداکشن با نویز پر می‌شود و همان چیزی که دنبالش
 * بودی گم می‌شود.
 */
const MIN = ORDER[(process.env.LOG_LEVEL as Level) ?? "info"] ?? ORDER.info;

/**
 * کلیدهایی که مقدارشان هرگز چاپ نمی‌شود.
 *
 * تطبیق روی **بخشی از نام** است، نه نام کامل: `apiKey`، `api_key`،
 * `ZOVIX_API_KEY` و `sessionToken` همه باید بیفتند. سخت‌گیری اینجا ارزان
 * است و اشتباهش گران.
 */
const SECRET_HINTS = [
  "token",
  "secret",
  "key",
  "password",
  "passwd",
  "auth",
  "cookie",
  "signature",
  "sign",
  "hash",
];

function isSecret(k: string): boolean {
  const low = k.toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

/**
 * آدرس کیف پول و شناسه‌ی تراکنش کوتاه می‌شوند، نه حذف.
 *
 * برای پیگیری یک برداشت باید بشود ردش را گرفت، ولی چاپ کاملِ آدرس در لاگ
 * یعنی هر کسی که به لاگ دسترسی دارد می‌تواند نقشه‌ی مالی کاربران را
 * دربیاورد. شش کاراکتر از هر طرف برای تطبیق کافی است.
 */
function shorten(v: string): string {
  return v.length > 20 ? `${v.slice(0, 6)}…${v.slice(-6)}` : v;
}

const LONG_ID_KEYS = ["txid", "address", "toAddress", "uuid", "gatewayUuid", "ref"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean(fields: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (isSecret(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && LONG_ID_KEYS.includes(k)) {
      out[k] = shorten(v);
      continue;
    }
    // خطا را به شکل قابل خواندن دربیاور — وگرنه `{}` چاپ می‌شود.
    if (v instanceof Error) {
      out[k] = v.message;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * خلاصه‌ی خوانا برای فیلد `message`.
 *
 * فقط مقدارهای ساده می‌آیند؛ شیء و آرایه در `message` نمی‌نشینند چون خط
 * را بلند و ناخوانا می‌کنند — آن‌ها به‌عنوان attribute می‌مانند و همان‌جا
 * قابل فیلترند.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(evt: string, fields: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || typeof v === "object") continue;
    parts.push(`${k}=${v}`);
  }
  return parts.length ? `${evt} ${parts.join(" ")}` : evt;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emit(lvl: Level, evt: string, fields: Record<string, any> = {}) {
  if (ORDER[lvl] < MIN) return;
  const safe = clean(fields);
  // ⚠️ **`message` و `level` نام‌های رزروِ Railway هستند.**
  //
  // نسخه‌ی اول `lvl` و بدون `message` می‌نوشت. نتیجه‌اش این شد که Railway
  // خط را پارس می‌کرد، متنی پیدا نمی‌کرد، و **یک خط کاملا خالی** نشان
  // می‌داد — سه روز، ۲۶۳ لاگ، همه خالی. لاگی که دیده نشود با نبودنش فرقی
  // ندارد.
  //
  // بقیه‌ی فیلدها attribute می‌شوند و در Railway با `@evt:deposit.credited`
  // یا `@playerId:7` قابل فیلترند — همان چیزی که از اول هدف بود.
  const line = JSON.stringify({
    message: summarize(evt, safe),
    level: lvl,
    evt,
    ...safe,
  });
  // خطا و هشدار به stderr، بقیه به stdout. Railway هر دو را می‌گیرد ولی
  // جدا بودنشان یعنی می‌شود فقط خطاها را دید.
  if (lvl === "error" || lvl === "warn") console.error(line);
  else console.log(line);
}

export const log = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (evt: string, f?: Record<string, any>) => emit("debug", evt, f),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (evt: string, f?: Record<string, any>) => emit("info", evt, f),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (evt: string, f?: Record<string, any>) => emit("warn", evt, f),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (evt: string, f?: Record<string, any>) => emit("error", evt, f),
};

/**
 * زمان‌سنجی یک عملیات — مدت و نتیجه را خودش لاگ می‌کند.
 *
 * چرا لازم است: «کند شد» رایج‌ترین گزارش خرابی است و بی‌فایده‌ترین. با
 * `ms` روی هر رویداد می‌شود گفت کدام قدم کند شده — درگاه، دیتابیس، یا
 * تلگرام.
 *
 * خطا را دوباره پرتاب می‌کند: این تابع ناظر است، نه گیرنده.
 */
export async function timed<T>(
  evt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    log.info(evt, { ...fields, ms: Date.now() - t0, ok: true });
    return r;
  } catch (err) {
    log.error(evt, {
      ...fields,
      ms: Date.now() - t0,
      ok: false,
      err: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
