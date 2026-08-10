import { NextResponse } from "next/server";
import { settleDueRounds } from "@/lib/settle";
import { settlePolyDue } from "@/lib/poly";
import { settleCombosDue } from "@/lib/combos";
import { refreshMarketPosts } from "@/lib/ir-posts";

export const dynamic = "force-dynamic";

// Protected settlement trigger. Call with header  x-settle-key: <SETTLE_KEY>
// (set SETTLE_KEY in Railway variables). Also runnable from a cron service.
export async function POST(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // هر سه بازی تسویه می‌شوند. قبلا فقط نبض بازار اینجا بود، پس آرنا و کمبو
  // حتی با کرون هم تسویه نمی‌شدند و فقط به بازدید صفحه وابسته بودند.
  // هر بخش جدا هندل می‌شود تا خطای یکی بقیه را متوقف نکند.
  const out: Record<string, unknown> = {};
  try {
    out.pulse = await settleDueRounds();
  } catch (err) {
    out.pulseError = err instanceof Error ? err.message : "error";
  }
  try {
    out.arena = await settlePolyDue();
  } catch (err) {
    out.arenaError = err instanceof Error ? err.message : "error";
  }
  try {
    out.combos = await settleCombosDue();
  } catch (err) {
    out.combosError = err instanceof Error ? err.message : "error";
  }

  // کارت‌های منتشرشده در کانال هم روی همین کرون تازه می‌شوند — یک زمان‌بند
  // کمتر برای نگهداری، و همان بازه‌ای که تسویه دارد برای درصدها هم کافی است.
  try {
    out.posts = await refreshMarketPosts();
  } catch (err) {
    out.postsError = err instanceof Error ? err.message : "error";
  }

  try {
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
