import { createHmac, timingSafeEqual } from "crypto";

// ═══ درگاه کریپتویی Zovix ═══════════════════════════════════
//
// احراز هویت: هر درخواست بیرونی دو هدر می‌خواهد.
//   X-API-KEY   کلید پروژه
//   X-API-SIGN  HMAC-SHA256 روی همان رشته‌ای که می‌فرستیم، با کلید مخفی،
//               سپس Base64.
//
// نکته‌ی حیاتی درباره‌ی امضا: رشته‌ی امضاشده باید *دقیقا* همان چیزی باشد
// که ارسال می‌شود. پس بدنه‌ی POST را به‌صورت form-urlencoded می‌فرستیم و
// همان رشته را امضا می‌کنیم — نه JSON. اگر JSON بفرستیم و query string
// امضا کنیم، امضا با بدنه نمی‌خواند و رد می‌شود.
//
// ابهامی که باید با ارائه‌دهنده روشن شود: در مستندات، address/get و
// withdrawal/create با برچسب «Session API» آمده‌اند (نشست داشبورد)، ولی
// ما سرور به سرور کار می‌کنیم. اینجا فرض بر مسیر External با پیشوند
// /my-blockchain و هدرهای کلید است. اگر ارائه‌دهنده مسیر دیگری بدهد،
// فقط ثابت BASE و PATHS عوض می‌شود.

const BASE = process.env.ZOVIX_BASE_URL ?? "https://api.zovix.io";
const KEY = process.env.ZOVIX_API_KEY ?? "";
const SECRET = process.env.ZOVIX_API_SECRET ?? "";

/** شبکه‌ی پیش‌فرض برای تتر. TRON چون کارمزدش برای کاربر ایرانی کمترین است. */
export const USDT_NETWORK = process.env.ZOVIX_USDT_NETWORK ?? "TRON";
export const USDT_CURRENCY = "USDT";

export function gatewayReady(): boolean {
  return Boolean(KEY && SECRET);
}

/** رشته‌ی form-urlencoded با ترتیب پایدار کلیدها */
function encodeBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64");
}

type ZovixRes<T> = {
  success: boolean;
  code: number;
  message?: string;
  data?: T;
};

async function call<T>(
  path: string,
  method: "GET" | "POST",
  params: Record<string, string> = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: number }> {
  if (!gatewayReady()) return { ok: false, error: "gateway_not_configured" };

  const body = encodeBody(params);
  const url =
    method === "GET" && body
      ? `${BASE}${path}?${body}`
      : `${BASE}${path}`;

  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        "X-API-KEY": KEY,
        "X-API-SIGN": sign(body),
        ...(method === "POST"
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
        Accept: "application/json",
      },
      ...(method === "POST" ? { body } : {}),
    });

    const json = (await res.json()) as ZovixRes<T>;
    if (!res.ok || !json.success) {
      return {
        ok: false,
        error: json.message ?? `http_${res.status}`,
        code: json.code ?? res.status,
      };
    }
    return { ok: true, data: json.data as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}

// ── آدرس واریز ────────────────────────────────────────────────
//
// client_id را برابر شناسه‌ی بازیکن می‌گذاریم تا وبهوک بتواند واریز را
// به حساب درست نسبت دهد. درگاه برای همان client_id همیشه همان آدرس را
// برمی‌گرداند، پس فراخوانی دوباره آدرس تازه نمی‌سازد.
export type DepositAddress = {
  address: string;
  client_id: string;
  network: string;
};

export async function getDepositAddress(playerId: number, network = USDT_NETWORK) {
  return call<DepositAddress>("/my-blockchain/address/get", "POST", {
    network,
    client_id: `player-${playerId}`,
  });
}

// ── برداشت ────────────────────────────────────────────────────
//
// unique_param اجباری است و نقش کلید یکتاسازی را دارد: اگر همان مقدار
// دوباره بیاید، درگاه درخواست تکراری نمی‌سازد. ما شناسه‌ی برداشت خودمان
// را می‌فرستیم تا حتی اگر درخواست ما دوبار برود، دو برداشت ساخته نشود.
export type WithdrawalCreated = { message: string; uuid: string };

export async function createWithdrawal(opts: {
  amount: string;
  toAddress: string;
  uniqueParam: string;
  network?: string;
}) {
  return call<WithdrawalCreated>("/my-blockchain/withdrawal/create", "POST", {
    currency: USDT_CURRENCY,
    network: opts.network ?? USDT_NETWORK,
    amount: opts.amount,
    to_address: opts.toAddress,
    unique_param: opts.uniqueParam,
  });
}

/** وضعیت یک برداشت — برای تأیید متقابل و همگام‌سازی */
export type WithdrawalRow = {
  id: string;
  txid: string | null;
  amount: string;
  status: string;
  to_address: string;
};

export async function getWithdrawal(uuid: string) {
  return call<WithdrawalRow[]>("/my-blockchain/withdrawal/index", "GET", { uuid });
}

// ── تأیید متقابل واریز ────────────────────────────────────────
//
// این مهم‌ترین لایه‌ی امنیتی است.
//
// مستندات درگاه هیچ روش امضایی برای وبهوک تعریف نکرده. یعنی اگر فقط به
// محتوای وبهوک اعتماد کنیم، هرکسی که آدرس وبهوک را بداند می‌تواند واریز
// جعلی بفرستد و کیف پول خودش را شارژ کند.
//
// پس وبهوک را فقط به‌عنوان «اعلان» می‌گیریم و پیش از هر واریزی، خودمان
// از درگاه می‌پرسیم که آیا این txid واقعا وجود دارد و SUCCESS است.
export type DepositRow = {
  id: string;
  txid: string;
  amount: string;
  status: string;
  /** برای انتقال داخلی درگاه، null است */
  from_address: string | null;
  /** معنایش از سمت درگاه روشن نیست: واریز تاییدشده‌ی on-chain هم false بود */
  is_verified?: boolean;
  to_address: { address: string; client_id: string };
  currency: { symbol: string };
  network?: { symbol: string };
  created_at?: string;
};

export async function verifyDeposit(txid: string) {
  return call<DepositRow[]>("/my-blockchain/deposit/index", "GET", { txid });
}

/**
 * فهرست واریزها، تازه‌ترین اول.
 *
 * ── چرا این وجود دارد ──
 * وبهوک درگاه در پلن رایگان قفل است، پس هیچ واریزی خودش خبر نمی‌دهد. تنها
 * راه باخبر شدن، خواندن دوره‌ای همین فهرست است.
 *
 * این از وبهوک **مطمئن‌تر** هم هست: وبهوکی که یک بار گم شود، آن واریز را
 * برای همیشه می‌برد، ولی خواندن دوره‌ای خودش را جبران می‌کند — واریزی که
 * این دور جا بماند، دور بعد دیده می‌شود.
 *
 * ⚠️ سقف نرخ درگاه تنگ است (حدود ۵ درخواست پشت‌سرهم، بعدش ۴۲۹ و سپس چالش
 * Cloudflare که دیگر JSON نمی‌دهد). هر فراخوانی از این تابع یک درخواست
 * است — تعدادشان را در هر دور کم نگه دار.
 */
export async function listDeposits(page = 1) {
  return call<DepositRow[]>("/my-blockchain/deposit/index", "GET", {
    page: String(page),
  });
}

/** مقایسه‌ی امن توکن وبهوک — در برابر حمله‌ی زمانی */
export function webhookTokenValid(provided: string | null): boolean {
  const expected = process.env.ZOVIX_WEBHOOK_TOKEN ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** شناسه‌ی بازیکن از client_id */
export function playerIdFromClientId(clientId: string): number | null {
  const m = /^player-(\d+)$/.exec(clientId ?? "");
  return m ? Number(m[1]) : null;
}
