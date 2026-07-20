import { NextResponse } from "next/server";
import { getMyfxData } from "@/lib/myfxbook";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMyfxData();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
