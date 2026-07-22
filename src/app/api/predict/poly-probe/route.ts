import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// تست موقت Gamma API پالی‌مارکت از سرور Railway.
// GET /api/predict/poly-probe  با هدر x-settle-key

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const UA = { "User-Agent": "Mozilla/5.0" };
  const out: Record<string, unknown> = { ok: true };

  try {
    const evRes = await fetch(
      "https://gamma-api.polymarket.com/events?limit=2&active=true&closed=false&order=volume&ascending=false",
      { headers: UA, cache: "no-store" }
    );
    out.eventsStatus = evRes.status;
    const evText = await evRes.text();
    try {
      const ev = JSON.parse(evText);
      out.eventsCount = Array.isArray(ev) ? ev.length : "non-array";
      out.eventsSample = Array.isArray(ev)
        ? ev.map((e: Record<string, unknown>) => ({
            id: e.id,
            title: e.title,
            slug: e.slug,
            category: e.category,
            endDate: e.endDate,
            volume: e.volume,
            marketCount: Array.isArray(e.markets) ? (e.markets as unknown[]).length : 0,
            firstMarket: Array.isArray(e.markets) && e.markets.length
              ? (() => {
                  const m = (e.markets as Record<string, unknown>[])[0];
                  return {
                    id: m.id,
                    question: m.question,
                    outcomes: m.outcomes,
                    outcomePrices: m.outcomePrices,
                    closed: m.closed,
                    endDate: m.endDate,
                  };
                })()
              : null,
          }))
        : evText.slice(0, 300);
    } catch {
      out.eventsRaw = evText.slice(0, 300);
    }
  } catch (err) {
    out.eventsError = err instanceof Error ? err.message : "fetch_failed";
  }

  return NextResponse.json(out);
}
