import { log } from "@/lib/log";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ═══ سقف نرخ روی مسیرهای حساس ════════════════════════════════
//
// این لایه قفل نیست، دست‌انداز است. قفل واقعیِ پول همان ترنزاکشن‌های
// دیتابیس با SELECT … FOR UPDATE است که سر جایشان‌اند. کاری که اینجا
// می‌کنیم دو چیز است:
//
//   ۱. سایت روی پا بماند. هر پیش‌بینی یک ترنزاکشن با قفل ردیف است و کل
//      پلتفرم از یک استخر اتصال Postgres استفاده می‌کند؛ سیل درخواست روی
//      یک روت، صفحه‌ی اصلی و مینی‌اپ را هم می‌خواباند.
//   ۲. زمان واکنش خریده شود. تنها هشدار روی برداشت، پیام تلگرام است؛ اگر
//      کسی سشن دزدیده بتواند بیست برداشت در سه ثانیه بزند، آن هشدار
//      بی‌فایده است.
//
// ── چرا شمارش بر اساس هویت، نه فقط آی‌پی ──
// مخاطب ما پشت VPN است و ده‌ها کاربر واقعی از یک آی‌پی خروجی می‌آیند. سقف
// آی‌پی‌محورِ تنگ، کاربران سالم را به هم قفل می‌کند. برای روت‌هایی که
// احراز هویت دارند، هر کاربر سطل خودش را می‌گیرد.
//
// ⚠️ کلید سطل از توکن ساخته می‌شود ولی فقط **شناسه‌ی بازیکن** از آن
// برداشته می‌شود. هر دو توکن شکل `<شناسه>.<انقضا>.<امضا>` دارند
// (`72.<exp>.<sig>` و `tg.72.<exp>.<sig>`)، پس دو بخش آخر دور ریخته
// می‌شود. دو نتیجه دارد:
//
//   • هیچ اعتبارنامه‌ی قابل‌استفاده‌ای در حافظه‌ی این ماژول نمی‌نشیند.
//   • انقضا هم بیرون می‌ماند، وگرنه هر بار ورود دوباره یک سطل نو می‌ساخت
//     و کاربر می‌توانست با logout/login سقف خودش را صفر کند.
//
// اینجا امضا **سنجیده نمی‌شود** و لازم هم نیست: کسی که توکن الکی بسازد
// سطل تازه می‌گیرد ولی خود روت ۴۰۱ می‌دهد، و آن ۴۰۱ بدون هیچ کوئری
// دیتابیسی صادر می‌شود (تشخیص هویت فقط HMAC است).

const WINDOW_MS = 10 * 60 * 1000; // ۱۰ دقیقه

/**
 * مسیرهایی که **هرگز** نباید محدود شوند.
 *
 * هر سه از یک منبع و با انفجار می‌آیند، و ۴۲۹ دادن به آن‌ها یعنی از دست
 * رفتن پول یا داده — نه کند شدن یک مهاجم:
 *
 *   • وبهوک درگاه   → تأیید واریز گم می‌شود و پول کاربر شارژ نمی‌شود.
 *   • وبهوک تلگرام  → پیام و کلیک کاربرها گم می‌شود (و با پخش سراسری،
 *                     انفجار ورودی طبیعی است).
 *   • تسویه‌ی کرون  → پول در وضعیت settling گیر می‌کند.
 *
 * این فهرست *قبل* از قواعد سنجیده می‌شود تا هیچ قاعده‌ی عمومی‌ای که بعدا
 * اضافه شود نتواند تصادفا این سه را بگیرد.
 */
const NEVER_LIMIT: RegExp[] = [
  /^\/api\/wallet\/webhook/,
  /^\/api\/tg\/webhook/,
  /^\/api\/predict\/settle/,
];

type By = "ip" | "identity";
type Rule = { id: string; pattern: RegExp; max: number; by: By };

// ترتیب مهم است: اولین تطابق برنده است، پس قواعد خاص باید بالاتر از
// قواعد عمومی بمانند (مثلا admin-login پیش از admin).
const RULES: Rule[] = [
  // ── مرزهای احراز هویت: آی‌پی‌محور، چون هنوز هویتی وجود ندارد ──
  { id: "admin-login", pattern: /^\/api\/admin\/login/, max: 10, by: "ip" },
  { id: "auth", pattern: /^\/api\/predict\/auth/, max: 30, by: "ip" },
  { id: "tg-auth", pattern: /^\/api\/tg\/auth/, max: 60, by: "ip" },
  { id: "tg-setup", pattern: /^\/api\/tg\/setup/, max: 30, by: "ip" },
  { id: "admin", pattern: /^\/api\/admin\//, max: 120, by: "ip" },

  // ── پول واقعی: تنگ‌ترین سقف‌ها ──
  { id: "withdraw", pattern: /^\/api\/wallet\/withdraw/, max: 5, by: "identity" },
  { id: "buy-credits", pattern: /^\/api\/wallet\/buy-credits/, max: 20, by: "identity" },
  { id: "ir-bet", pattern: /^\/api\/ir\/bet/, max: 60, by: "identity" },
  { id: "ir-propose", pattern: /^\/api\/ir\/propose/, max: 10, by: "identity" },
  { id: "ir-dispute", pattern: /^\/api\/ir\/dispute/, max: 10, by: "identity" },
  { id: "challenge", pattern: /^\/api\/predict\/challenge/, max: 10, by: "identity" },

  // ── امتیازی: سقف‌ها فقط برای پایداری، خیلی بالاتر از بازی طبیعی ──
  { id: "predict-submit", pattern: /^\/api\/predict\/submit/, max: 60, by: "identity" },
  { id: "poly-submit", pattern: /^\/api\/predict\/poly-submit/, max: 60, by: "identity" },
  { id: "combo-submit", pattern: /^\/api\/predict\/combo-submit/, max: 30, by: "identity" },
  { id: "ir-poll-me", pattern: /^\/api\/ir\/poll-me/, max: 120, by: "identity" },
  { id: "trade-poll-me", pattern: /^\/api\/trade\/poll-me/, max: 120, by: "identity" },
  { id: "tg-link", pattern: /^\/api\/predict\/tg-link/, max: 20, by: "identity" },
  { id: "showcase", pattern: /^\/api\/profile\/showcase/, max: 20, by: "identity" },
];

const hits = new Map<string, { n: number; ts: number }>();

// جاروی حافظه.
//
// نسخه‌ی قبلی هر بار که اندازه از ۵۰۰۰ می‌گذشت کل نقشه را می‌پیمود — یعنی
// از آن نقطه به بعد، *هر درخواست* یک پیمایش کامل. با ده‌ها هزار کاربر
// همین محافظ خودش کندی می‌ساخت. حالا حداکثر یک بار در دقیقه جارو می‌شود.
const SWEEP_EVERY_MS = 60 * 1000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [k, v] of hits) {
    if (now - v.ts > WINDOW_MS) hits.delete(k);
  }
}

/**
 * کلید سطل: هویت کاربر بدون بخش امضا، و اگر هویتی نبود آی‌پی.
 *
 * مینی‌اپ اول سنجیده می‌شود، هم‌راستا با currentPlayerId: درخواستی که
 * صریحا توکن مینی‌اپ آورده، همان هویت مقصودش است.
 */
function identityKey(req: NextRequest, ip: string): string {
  const tg = req.headers.get("x-tg-auth");
  if (tg) return `p:${playerPart(tg)}`;
  const cookie = req.cookies.get("amir_session")?.value;
  if (cookie) return `p:${playerPart(cookie)}`;
  return `ip:${ip}`;
}

/**
 * شناسه‌ی بازیکن از داخل توکن — یعنی همه‌چیز جز دو قطعه‌ی آخر (انقضا و
 * امضا)، و بدون پیشوند `tg.` مینی‌اپ:
 *
 *   `72.<exp>.<sig>`     → `72`
 *   `tg.72.<exp>.<sig>`  → `72`
 *
 * پیشوند عمدا حذف می‌شود تا یک کاربر با باز کردن همزمان سایت و مینی‌اپ دو
 * سهمیه نگیرد — همان اصل «یک حساب» که currentPlayerId رویش ایستاده.
 *
 * توکن بدشکل همان‌طور که هست برمی‌گردد؛ اینجا اعتبارسنجی نمی‌کنیم، فقط
 * سطل می‌سازیم و خودِ روت جلوی توکن نامعتبر را می‌گیرد.
 */
function playerPart(token: string): string {
  const parts = token.split(".");
  const body = parts.length >= 3 ? parts.slice(0, -2).join(".") : token;
  return body.startsWith("tg.") ? body.slice(3) : body;
}

/**
 * لاگ دسترسی — تنها جایی که **هر** درخواست API از آن رد می‌شود.
 *
 * ── چرا اینجا و نه در تک‌تک روت‌ها ──
 * پلتفرم ۵۲ روت دارد و بیشترشان فقط می‌خوانند. ابزارگذاری دستی در همه، هم
 * پرهزینه است و هم دیر یا زود یکی جا می‌افتد — و همان یکی می‌شود جایی که
 * سوءاستفاده اتفاق می‌افتد و دیده نمی‌شود. یک نقطه یعنی پوشش بدون استثنا.
 *
 * ── چرا نوشتن `info` و خواندن `debug` ──
 * مینی‌اپ فهرست بازارها را مرتب می‌خواند؛ اگر آن هم `info` بود، لاگ
 * پروداکشن پر می‌شد از GET و همان چیزی که دنبالش بودیم گم می‌شد — همان
 * درسی که «لاگی که دیده نشود» می‌گوید. پس هر درخواستِ **تغییردهنده**
 * همیشه ثبت می‌شود و خواندن‌ها با `LOG_LEVEL=debug` روشن می‌شوند.
 *
 * ⚠️ بدنه‌ی درخواست هرگز خوانده نمی‌شود: هم مبلغ و آدرس کیف پول آنجاست، و
 * هم خواندنش در میدل‌ور استریم را مصرف می‌کند و روت چیزی دریافت نمی‌کند.
 */
function accessLog(req: NextRequest, path: string, who: string) {
  const fields = {
    method: req.method,
    path,
    who,
    // مخاطب ما پشت VPN است، پس آی‌پی مدرک هویت نیست — ولی برای دیدن
    // الگوی «صد درخواست از یک نقطه» تنها چیزی است که داریم.
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    ua: req.headers.get("user-agent")?.slice(0, 80),
  };
  if (req.method === "GET" || req.method === "HEAD") log.debug("api.read", fields);
  else log.info("api.write", fields);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ⚠️ لاگ دسترسی **پیش از** هر شرطی زده می‌شود، حتی برای مسیرهای معافِ
  // سقف نرخ. آن سه مسیر (وبهوک درگاه، وبهوک تلگرام، کرون) دقیقا همان‌هایی
  // هستند که پول و پیام از آن‌ها می‌گذرد؛ معاف‌بودن از سقف نرخ دلیلی برای
  // نامرئی‌بودن نیست.
  const who = identityKey(
    req,
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
  accessLog(req, path, who);

  if (req.method !== "POST") return NextResponse.next();

  if (NEVER_LIMIT.some((p) => p.test(path))) return NextResponse.next();

  const rule = RULES.find((r) => r.pattern.test(path));
  if (!rule) return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${rule.id}:${rule.by === "identity" ? who : `ip:${ip}`}`;
  const now = Date.now();
  sweep(now);

  const rec = hits.get(key);
  if (!rec || now - rec.ts > WINDOW_MS) {
    hits.set(key, { n: 1, ts: now });
    return NextResponse.next();
  }
  rec.n++;
  if (rec.n > rule.max) {
    const retryAfter = Math.ceil((rec.ts + WINDOW_MS - now) / 1000);
    // ⚠️ سقف خوردن دو معنی دارد و هر دو باید دیده شوند: یا کسی دارد
    // سوءاستفاده می‌کند، یا سقف برای استفاده‌ی عادی تنگ است و کاربر سالم
    // را بیرون می‌اندازد. بدون لاگ، هیچ‌کدام معلوم نمی‌شود.
    log.warn("ratelimit.blocked", {
      rule: rule.id,
      path,
      hits: rec.n,
      max: rule.max,
      retryAfter,
    });
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
