import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

// ── probe موقت درگاه ─────────────────────────────────────────
//
// ⚠️ این فایل موقت است و بعد از گرفتن جواب حذف می‌شود.
//
// چرا از سرور می‌پرسیم و نه از ماشین محلی: درگاه پشت Cloudflare است و
// چند درخواست پشت‌سرهم از یک IP باعث می‌شود آن IP چالش بگیرد و دیگر
// پاسخ JSON ندهد. IP سرور تمیز است.
//
// چه چیزی را می‌سنجد: آیا یک واریز واقعی on-chain در deposit/index ثبت
// می‌شود؟ اگر بله، نیازی به وبهوک (که در پلن رایگان قفل است) نداریم و
// می‌شود با خواندن دوره‌ای روی کرون، واریزها را شارژ کرد.
//
// امضای درخواست عمدا اینجا تکرار شده و از zovix.ts وارد نشده: آن فایل
// فقط تماس‌های تعریف‌شده‌ی محصول را صادر می‌کند و نباید برای یک probe
// موقت سطح تازه باز کند.
//
// اجرا:
//   curl -s -H "x-settle-key: $SETTLE_KEY" \
//     https://<host>/api/wallet/zovix-probe | jq

const BASE = process.env.ZOVIX_BASE_URL ?? "https://api.zovix.io";
const KEY = process.env.ZOVIX_API_KEY ?? "";
const SECRET = process.env.ZOVIX_API_SECRET ?? "";

function encodeBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function probe(path: string, params: Record<string, string> = {}) {
  const body = encodeBody(params);
  const url = body ? `${BASE}${path}?${body}` : `${BASE}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        "X-API-KEY": KEY,
        "X-API-SIGN": createHmac("sha256", SECRET).update(body).digest("base64"),
        Accept: "application/json",
      },
    });
    const text = await res.text();
    return {
      call: `${path}${body ? "?" + body : ""}`,
      status: res.status,
      ms: Date.now() - t0,
      // اگر Cloudflare چالش بدهد پاسخ HTML است نه JSON — پس متن خام را
      // برمی‌گردانیم تا بشود تشخیص داد کدام حالت رخ داده.
      body: text.slice(0, 2000),
    };
  } catch (err) {
    return {
      call: `${path}${body ? "?" + body : ""}`,
      status: 0,
      ms: Date.now() - t0,
      body: err instanceof Error ? err.message : "network_error",
    };
  }
}

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY ?? "";
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const txid = new URL(req.url).searchParams.get("txid") ?? "";

  // حداکثر سه تماس، با فاصله — سقف نرخ درگاه حدود ۵ تماس پشت‌سرهم است.
  const results = [];
  results.push(await probe("/my-blockchain/deposit/index"));
  await new Promise((r) => setTimeout(r, 2500));
  if (txid) {
    results.push(await probe("/my-blockchain/deposit/index", { txid }));
    await new Promise((r) => setTimeout(r, 2500));
  }
  results.push(await probe("/my-blockchain/withdrawal/index"));

  return NextResponse.json({
    ok: true,
    gatewayConfigured: Boolean(KEY && SECRET),
    base: BASE,
    results,
  });
}
