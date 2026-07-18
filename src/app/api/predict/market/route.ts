import { NextResponse } from "next/server";
import { getAllMarket } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAllMarket();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
