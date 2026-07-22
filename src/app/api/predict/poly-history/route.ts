import { NextResponse } from "next/server";
import { getMarketHistory, type HistoryInterval } from "@/lib/poly";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const marketId = String(searchParams.get("market") ?? "").trim();
  if (!marketId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const raw = String(searchParams.get("interval") ?? "1w");
  const interval: HistoryInterval = ["1d", "1w", "1m", "max"].includes(raw)
    ? (raw as HistoryInterval)
    : "1w";
  const points = await getMarketHistory(marketId, interval);
  return NextResponse.json(
    { ok: true, points },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } }
  );
}
