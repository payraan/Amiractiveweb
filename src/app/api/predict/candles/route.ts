import { NextResponse } from "next/server";
import { getCandles } from "@/lib/candles";
import type { Asset } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetParam = searchParams.get("asset");
  const interval = searchParams.get("interval") ?? "4h";
  const asset: Asset = assetParam === "XAU" ? "XAU" : "BTC";

  const candles = await getCandles(asset, interval);
  return NextResponse.json(
    { asset, interval, candles },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
