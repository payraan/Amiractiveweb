import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── probe موقت اوراکل ایرانی ─────────────────────────────────
//
// سرور روی Railway خارج از ایران است و منابع قیمت ایرانی برای مصرف داخل
// ایران ساخته شده‌اند. ممکن است از خارج کند، محدود یا مسدود باشند — پس
// قبل از نوشتن هر کدی برای «بازار ایران» باید این را عملا سنجید.
//
// این probe سه چیز را گزارش می‌کند، نه فقط تاخیر:
//   ۱. آیا اصلا در دسترس است (وضعیت، تاخیر، خطا)
//   ۲. چند دارایی در یک درخواست برمی‌گردد
//   ۳. کدام دارایی‌های موردنیاز ما پوشش داده می‌شوند
//
// نکته‌ی حیاتی درباره‌ی سقف درخواست: اگر منبع یک endpoint تجمیعی بدهد،
// یک بار در دقیقه یعنی ۱۴۴۰ درخواست در روز. اگر هر دارایی endpoint جدا
// بخواهد، ۱۵ دارایی می‌شود ۲۱٬۶۰۰ در روز و هیچ پلن رایگانی کفاف نمی‌دهد.
// پس «تعداد دارایی در هر پاسخ» مهم‌ترین عددِ این گزارش است.
//
// بعد از تصمیم‌گیری این فایل حذف می‌شود.
//
// اجرا:
//   curl -s -H "x-settle-key: $SETTLE_KEY" \
//     https://<host>/api/predict/ir-probe | jq

type Source = {
  id: string;
  url: string;
  note: string;
  /** کلیدهایی که در پاسخ دنبالشان می‌گردیم تا پوشش را بسنجیم */
  look: string[];
};

const SOURCES: Source[] = [
  {
    id: "nerkh",
    url: "https://api.nerkh.io/v1/currencies",
    note: "رایگان، بدون کلید. ارز و طلا و سکه.",
    look: ["usd", "eur", "gbp", "aed", "try", "gold", "coin", "sekke", "طلا", "دلار"],
  },
  {
    id: "nerkh_alt",
    url: "https://nerkh.io/api/v1/currencies",
    note: "مسیر جایگزین همان سرویس.",
    look: ["usd", "eur", "gold", "coin"],
  },
  {
    id: "brsapi_gold",
    url: "https://BrsApi.ir/Api/Market/Gold_Currency.php?key=FreeTest",
    note: "پلن رایگان با کلید تست. طلا، سکه، ارز.",
    look: ["gold", "coin", "sekee", "usd", "eur", "طلا", "سکه", "دلار"],
  },
  {
    id: "tgju",
    url: "https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl",
    note: "TGJU — پرمخاطب‌ترین منبع داخلی.",
    look: ["price", "close", "high", "low", "data"],
  },
  {
    id: "navasan_ping",
    url: "https://api.navasan.tech/latest/?api_key=demo",
    note: "اشتراکی. فقط برای سنجش دسترسی.",
    look: ["usd", "eur", "gold", "sekee"],
  },
];

/** چند شیء/کلید در پاسخ هست — تقریبی برای «چند دارایی در یک درخواست» */
function countItems(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>);
    // اگر یک کلید حاوی آرایه بود، طول همان مهم‌تر است
    for (const k of keys) {
      const inner = (v as Record<string, unknown>)[k];
      if (Array.isArray(inner) && inner.length > keys.length) return inner.length;
    }
    return keys.length;
  }
  return 0;
}

async function probe(src: Source) {
  const t0 = Date.now();
  try {
    const res = await fetch(src.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    const ms = Date.now() - t0;
    const raw = await res.text();
    const ct = res.headers.get("content-type") ?? "";

    let parsed: unknown = null;
    let parseOk = false;
    try {
      parsed = JSON.parse(raw);
      parseOk = true;
    } catch {
      /* پاسخ JSON نبود */
    }

    const lower = raw.toLowerCase();
    const found = src.look.filter((k) => lower.includes(k.toLowerCase()));

    return {
      id: src.id,
      note: src.note,
      ok: res.ok && parseOk,
      status: res.status,
      ms,
      contentType: ct.split(";")[0],
      bytes: raw.length,
      isJson: parseOk,
      itemsInOneRequest: parseOk ? countItems(parsed) : 0,
      keysFound: found,
      coverage: `${found.length}/${src.look.length}`,
      // نمونه‌ی کوتاه برای اینکه ساختار را با چشم ببینیم
      sample: raw.slice(0, 400),
    };
  } catch (err) {
    return {
      id: src.id,
      note: src.note,
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const results = await Promise.all(SOURCES.map(probe));
  const working = results.filter((r) => r.ok);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    serverTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    summary: {
      total: results.length,
      reachable: working.length,
      best: working.sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))[0]?.id ?? null,
      note:
        "itemsInOneRequest مهم‌ترین عدد است: اگر بالای ۱۵ باشد یعنی یک " +
        "درخواست کل دارایی‌ها را می‌دهد و پلن رایگان کافی است.",
    },
    results,
  });
}
