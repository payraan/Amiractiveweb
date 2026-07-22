import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// تست موقت: ۱) فیلد کتگوری/تگ رویدادها ۲) تاریخچه‌ی قیمت برای نمودار بازار
// GET /api/predict/poly-probe2  با هدر x-settle-key

const UA = { "User-Agent": "Mozilla/5.0" };

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = { ok: true };

  try {
    const evRes = await fetch(
      "https://gamma-api.polymarket.com/events?limit=2&active=true&closed=false&order=volume&ascending=false",
      { headers: UA, cache: "no-store" }
    );
    const events = await evRes.json();
    const ev = Array.isArray(events) ? events[0] : null;
    const m = ev && Array.isArray(ev.markets) ? ev.markets[0] : null;

    out.eventKeys = ev ? Object.keys(ev) : null;
    out.eventTags = ev?.tags ?? null;
    out.eventCategory = ev?.category ?? null;
    out.marketKeys = m ? Object.keys(m).slice(0, 40) : null;
    out.clobTokenIdsRaw = m?.clobTokenIds ?? null;

    // price history for the YES token
    if (m?.clobTokenIds) {
      try {
        const ids: string[] = JSON.parse(m.clobTokenIds);
        const token = ids[0];
        out.yesToken = token?.slice(0, 20) + "…";
        const phRes = await fetch(
          `https://clob.polymarket.com/prices-history?market=${token}&interval=1w&fidelity=120`,
          { headers: UA, cache: "no-store" }
        );
        out.historyStatus = phRes.status;
        const ph = await phRes.json();
        const hist = ph?.history ?? ph;
        out.historyCount = Array.isArray(hist) ? hist.length : "non-array";
        out.historySample = Array.isArray(hist) ? hist.slice(0, 3) : ph;
      } catch (e) {
        out.historyError = e instanceof Error ? e.message : "failed";
      }
    }
  } catch (err) {
    out.error = err instanceof Error ? err.message : "fetch_failed";
  }

  return NextResponse.json(out);
}
