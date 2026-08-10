import { NextResponse } from "next/server";
import { getCandles } from "@/lib/candles";
import { assetById } from "@/lib/assets";
import type { Asset } from "@/lib/game";

export const dynamic = "force-dynamic";

// دارایی از کاتالوگ اعتبارسنجی می‌شود، نه با فهرست هاردکد.
//
// اینجا قبلا نوشته بود:  assetParam === "XAU" ? "XAU" : "BTC"
// یعنی نمودار همه‌ی ۴۲ دارایی، بیت‌کوین را نشان می‌داد. کاربر روی ریپل بود و
// شمع‌های ۶۴ هزار دلاری می‌دید. candles.ts قبلا از همین هاردکد پاک شده بود ولی
// روت دست‌نخورده مانده بود، پس رفع آنجا هیچ اثری نداشت.
//
// asset در پاسخ برمی‌گردد تا اگر روزی دوباره چنین اتفاقی افتاد، از خود پاسخ
// معلوم باشد سرور کدام دارایی را فهمیده.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("asset") ?? "").trim().toUpperCase();
  const interval = searchParams.get("interval") ?? "4h";

  if (!assetById(raw)) {
    return NextResponse.json({ ok: false, error: "bad_asset" }, { status: 400 });
  }
  const asset = raw as Asset;

  const candles = await getCandles(asset, interval);
  return NextResponse.json(
    { ok: true, asset, interval, candles },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
