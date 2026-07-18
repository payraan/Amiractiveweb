import { NextResponse } from "next/server";
import { settleDueRounds } from "@/lib/settle";

export const dynamic = "force-dynamic";

// Protected settlement trigger. Call with header  x-settle-key: <SETTLE_KEY>
// (set SETTLE_KEY in Railway variables). Also runnable from a cron service.
export async function POST(req: Request) {
  const key = process.env.SETTLE_KEY;
  const provided = req.headers.get("x-settle-key");
  if (!key || provided !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await settleDueRounds();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
