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

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, error: "malformed" };
  }

  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { ok: false, error: "malformed" };
  }

  // hash خودش در محاسبه نمی‌آید. signature هم کنار گذاشته می‌شود: فیلد
  // تازه‌ی تلگرام برای تأیید شخص‌ثالث است و در data_check_string نمی‌نشیند.
  const pairs: string[] = [];
  for (const [k, v] of params) {
    if (k === "hash" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash.toLowerCase(), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "bad_hash" };
  }

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
    startParam: params.get("start_param"),
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
