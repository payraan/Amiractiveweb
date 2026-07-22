import { NextResponse } from "next/server";
import { getMarketHistory } from "@/lib/poly";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const marketId = String(searchParams.get("market") ?? "").trim();
  if (!marketId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const points = await getMarketHistory(marketId);
  return NextResponse.json(
    { ok: true, points },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } }
  );
}
