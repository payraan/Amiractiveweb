import { NextResponse } from "next/server";
import { getCuratedMarkets } from "@/lib/poly";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await getCuratedMarkets();
  return NextResponse.json(
    { ok: true, markets },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
