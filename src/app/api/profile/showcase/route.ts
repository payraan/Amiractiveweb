import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables } from "@/lib/iran";
import { MAX_SHOWCASE, badgeById } from "@/lib/badges";

export const dynamic = "force-dynamic";

/**
 * انتخاب نشان‌هایی که روی پروفایل نمایش داده می‌شوند.
 *
 * سرور فقط شناسه‌های معتبر و حداکثر MAX_SHOWCASE تا را قبول می‌کند. بررسی
 * «آیا واقعا کسب شده؟» موقع نمایش انجام می‌شود، چون معیارها زنده‌اند و اگر
 * نشانی از دست برود باید خودبه‌خود از پروفایل محو شود، نه اینکه بماند.
 */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids: string[] = [];
  for (const v of raw) {
    const id = String(v);
    if (badgeById(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_SHOWCASE) break;
  }

  await ensureIrTables();
  const pool = await db();
  await pool.query("UPDATE players SET showcase=$2 WHERE id=$1", [
    playerId,
    ids.join(","),
  ]);

  return NextResponse.json({ ok: true, showcase: ids });
}
