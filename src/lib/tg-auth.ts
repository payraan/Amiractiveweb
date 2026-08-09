import { createHmac, timingSafeEqual } from "crypto";

// ═══ احراز هویت مینی‌اپ تلگرام ═══════════════════════════════
//
// این فایل مرز اعتماد است: تنها جایی که یک رشته‌ی آمده از کلاینت به «هویت
// اثبات‌شده» تبدیل می‌شود. عمدا از telegram.ts جدا نگه داشته شده تا کد
// امنیتی در یک جای کوچک و قابل بازبینی بماند.
//
// ── چرا نشست جدا و نه همان کوکی سایت ──
// مینی‌اپ تلگرام روی دسکتاپ و وب داخل iframe شخص‌ثالث اجرا می‌شود و کوکی
// SameSite=Lax در آن زمینه فرستاده نمی‌شود. راه‌حل ساده این بود که کوکی
// نشست را SameSite=None کنیم — ولی آن یعنی کوکیِ کلِ سایت در هر زمینه‌ی
// cross-site فرستاده شود و سطح حمله‌ی CSRF روی همه‌ی روت‌های موجود باز شود،
// فقط برای حل یک مشکل مینی‌اپ. معامله‌ی بدی است.
//
// به‌جایش: initData خودش یک اعتبارنامه‌ی امضاشده با HMAC است. همان را مبنا
// می‌گیریم و یک توکن کوتاه‌عمر می‌دهیم که در هدر می‌آید، نه در کوکی. پس
// verifySession و کل مسیر وب دست‌نخورده می‌ماند.

const BOT_TOKEN = (process.env.TG_BOT_TOKEN ?? "").trim();
const SECRET = process.env.SESSION_SECRET ?? "";

/** پنجره‌ی پذیرش initData. کهنه‌تر از این، رد می‌شود. */
export const INIT_DATA_MAX_AGE_S = 24 * 3600;
/** عمر توکن نشست مینی‌اپ — کوتاه، چون در هدر جابه‌جا می‌شود. */
export const TG_SESSION_MAX_AGE_S = 3600;

export const TG_AUTH_HEADER = "x-tg-auth";

export type TgInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type InitDataResult =
  | { ok: true; user: TgInitUser; startParam: string | null; authDate: number }
  | {
      ok: false;
      error: "not_configured" | "malformed" | "bad_hash" | "expired" | "no_user";
      /** فقط *نام* فیلدهای دریافتی — برای عیب‌یابی. هیچ مقداری برنمی‌گردد. */
      fields?: string[];
    };

/**
 * اعتبارسنجی initData طبق الگوریتم رسمی تلگرام.
 *
 *   secret_key = HMAC_SHA256(key="WebAppData", data=<bot token>)
 *   hash       = HMAC_SHA256(key=secret_key,  data=<data_check_string>)
 *
 * data_check_string یعنی همه‌ی فیلدها به‌جز hash، مرتب‌شده بر اساس کلید، به
 * شکل `key=value` و جداشده با \n.
 *
 * ⚠️ این با الگوریتم Login Widget فرق دارد (آنجا کلید SHA256(token) است).
 * اشتباه‌گرفتنشان یعنی امضا هرگز نمی‌خواند.
 */
export function verifyTelegramInitData(initData: string): InitDataResult {
  if (!BOT_TOKEN) return { ok: false, error: "not_configured" };
  if (!initData || initData.length > 4096) return { ok: false, error: "malformed" };

  // ⚠️ عمدا از URLSearchParams استفاده نمی‌شود.
  //
  // تلگرام مقادیر را با encodeURIComponent کد می‌کند، ولی URLSearchParams
  // طبق قواعد فرم HTML تجزیه می‌کند و `+` را به فاصله تبدیل می‌کند.
  // encodeURIComponent هرگز `+` را کد نمی‌کند، پس هر مقداری که یک `+`
  // واقعی داشته باشد (مثلا داخل photo_url) خراب می‌شد و هش هرگز نمی‌خواند.
  // معکوس درستِ encodeURIComponent، خودِ decodeURIComponent است.
  const fields: { key: string; value: string }[] = [];
  let hash = "";
  try {
    for (const part of initData.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      if (eq < 0) return { ok: false, error: "malformed" };
      const key = decodeURIComponent(part.slice(0, eq));
      const value = decodeURIComponent(part.slice(eq + 1));
      if (key === "hash") hash = value;
      else fields.push({ key, value });
    }
  } catch {
    return { ok: false, error: "malformed" };
  }

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { ok: false, error: "malformed" };
  }

  // مرتب‌سازی بر اساس *کلید*، نه بر اساس رشته‌ی `key=value`. در عمل برای
  // کلیدهای فعلی تلگرام یکی درمی‌آید، ولی اگر روزی کلیدی پیشوند کلید دیگری
  // باشد و کاراکتر بعدی‌اش از `=` کوچک‌تر (مثلا رقم)، ترتیب برعکس می‌شد.
  const byKey = (a: { key: string }, b: { key: string }) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hmacOf = (list: { key: string; value: string }[]) =>
    createHmac("sha256", secretKey)
      .update(
        [...list]
          .sort(byKey)
          .map((f) => `${f.key}=${f.value}`)
          .join("\n")
      )
      .digest("hex");

  // مستندات تلگرام می‌گوید «همه‌ی فیلدهای دریافتی به‌جز hash»، ولی درباره‌ی
  // فیلد نسبتا تازه‌ی `signature` صریح نیست و کلاینت‌های مختلف فرق دارند.
  // هر دو حالت سنجیده می‌شود. این امنیت را کم نمی‌کند: هر دو حالت نیازمند
  // امضای معتبر با توکن ربات‌اند و `signature` را خودمان هیچ‌جا استفاده
  // نمی‌کنیم، پس تفاوتشان فقط در سخت‌گیری روی یک فیلدِ بلااستفاده است.
  const expected = hash.toLowerCase();
  const withSignature = hmacOf(fields);
  const withoutSignature =
    fields.some((f) => f.key === "signature")
      ? hmacOf(fields.filter((f) => f.key !== "signature"))
      : withSignature;

  const matches = (computed: string) => {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  };

  if (!matches(withSignature) && !matches(withoutSignature)) {
    return { ok: false, error: "bad_hash", fields: fields.map((f) => f.key) };
  }

  const params = new Map(fields.map((f) => [f.key, f.value] as const));

  // امضای درست ولی کهنه هنوز خطرناک است: هرکسی که یک‌بار initData کسی را
  // ببیند (لاگ، اسکرین‌شات، پروکسی) می‌تواند تا ابد با آن وارد شود. پنجره‌ی
  // زمانی همان چیزی است که این تکرار را می‌بندد.
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: "malformed" };
  }
  const ageS = Math.floor(Date.now() / 1000) - authDate;
  if (ageS > INIT_DATA_MAX_AGE_S) return { ok: false, error: "expired" };

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, error: "no_user" };
  let user: TgInitUser;
  try {
    user = JSON.parse(rawUser);
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!Number.isInteger(user?.id) || user.id <= 0) {
    return { ok: false, error: "no_user" };
  }

  return {
    ok: true,
    user,
    startParam: params.get("start_param") ?? null,
    authDate,
  };
}

// ── نشست مینی‌اپ ─────────────────────────────────────────────
//
// شکل توکن: tg.<playerId>.<expiry>.<sig>
// پیشوند tg عمدی است تا هرگز با کوکی نشست سایت اشتباه گرفته نشود؛ اگر یکی
// جای دیگری پاس داده شود، همان‌جا رد می‌شود نه اینکه تصادفا کار کند.

export function signTgSession(playerId: number): string {
  if (!SECRET) throw new Error("SESSION_SECRET is not configured");
  const exp = Math.floor(Date.now() / 1000) + TG_SESSION_MAX_AGE_S;
  const body = `tg.${playerId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifyTgSession(token: string | undefined | null): number | null {
  if (!SECRET) return null; // fail closed، مثل نشست سایت
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "tg") return null;
  const [, idStr, expStr, sig] = parts;
  const body = `tg.${idStr}.${expStr}`;
  const expected = createHmac("sha256", SECRET).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expStr) * 1000 < Date.now()) return null;
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}
