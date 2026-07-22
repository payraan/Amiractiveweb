import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// محدودیت نرخ ساده بر اساس IP برای مسیرهای حساس (ضد بروت‌فورس).
const WINDOW_MS = 10 * 60 * 1000; // ۱۰ دقیقه

const RULES: { id: string; pattern: RegExp; max: number }[] = [
  { id: "admin-login", pattern: /^\/api\/admin\/login/, max: 10 },
  { id: "auth", pattern: /^\/api\/predict\/auth/, max: 30 },
  { id: "admin", pattern: /^\/api\/admin\//, max: 120 },
];

const hits = new Map<string, { n: number; ts: number }>();

function cleanup(now: number) {
  if (hits.size < 5000) return;
  for (const [k, v] of hits) {
    if (now - v.ts > WINDOW_MS) hits.delete(k);
  }
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => r.pattern.test(path));
  if (!rule) return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${rule.id}:${ip}`;
  const now = Date.now();
  cleanup(now);

  const rec = hits.get(key);
  if (!rec || now - rec.ts > WINDOW_MS) {
    hits.set(key, { n: 1, ts: now });
    return NextResponse.next();
  }
  rec.n++;
  if (rec.n > rule.max) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
