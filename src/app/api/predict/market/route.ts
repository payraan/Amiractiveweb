import { NextResponse } from "next/server";
import { getMarket, getMarkets } from "@/lib/market";
import { assetsByCategory, type AssetCategory } from "@/lib/assets";

export const dynamic = "force-dynamic";

const VALID: AssetCategory[] = ["crypto", "forex", "metal", "stock"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get("asset");
  const category = searchParams.get("category");

  if (asset) {
    const data = await getMarket(asset);
    return NextResponse.json({ ok: true, market: data });
  }

  const cat = (VALID as string[]).includes(String(category))
    ? (category as AssetCategory)
    : "crypto";
  const defs = assetsByCategory(cat);
  const markets = await getMarkets(defs.map((d) => d.id));

  return NextResponse.json({ ok: true, category: cat, markets });
}
