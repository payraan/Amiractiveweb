import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { normalizeUsername } from "@/lib/auth";
import { ensureIrTables } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * قطع اتصال تلگرام یک حساب.
 *
 * `tg_user_id` یکتاست، پس تا یک حساب رهایش نکند هیچ حساب دیگری نمی‌تواند به
 * همان تلگرام وصل شود. بدون این مسیر، اشتباهِ اتصال فقط با دست‌بردن مستقیم
 * در دیتابیس برمی‌گشت.
 *
 * عمدا فقط ادمین: اگر کاربر خودش می‌توانست قطع و وصل کند، «یک نفر = یک حساب»
 * فقط در یک لحظه برقرار می‌ماند — یک تلگرام می‌توانست پشت سر هم حساب بسازد،
 * پاداش هر کدام را بگیرد و برود. همان چیزی که کل ضدتقلب رویش ایستاده.
 *
 * پاداش عضویت گروه هم پاک می‌شود، وگرنه چرخه‌ی قطع/وصل آن را تکرارپذیر می‌کرد.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { id?: number; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || String(body.action) !== "unlink_telegram") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const pool = await db();
  const r = await pool.query<{ tg_user_id: string | null }>(
    `UPDATE players
        SET tg_user_id = NULL, tg_handle = NULL, tg_linked_at = NULL,
            group_bonus_at = NULL
      WHERE id = $1 AND tg_user_id IS NOT NULL
      RETURNING tg_user_id`,
    [id]
  );
  if (!r.rowCount) {
    return NextResponse.json({ ok: false, error: "not_linked" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const username = normalizeUsername(searchParams.get("username") ?? "");
  if (!username) return NextResponse.json({ ok: false, error: "bad_username" }, { status: 400 });

  await ensureIrTables(); // ستون usdt_balance اینجا ساخته می‌شود
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT tg_username, tg_handle, display_name, credits, total_points, streak, created_at,
            usdt_balance
       FROM players
      WHERE tg_username=$1 OR lower(tg_handle)=$1
      -- NULLS LAST اجباری است: در حساب تلگرام‌زاد tg_username خالی است، پس
      -- (tg_username=$1) نه false بلکه NULL می‌شود و در DESC پیش‌فرض اول
      -- می‌نشیند — یعنی تطابق دقیقِ یوزرنیم را کنار می‌زند.
      ORDER BY (tg_username=$1) DESC NULLS LAST
      LIMIT 1`,
    [username]
  );
  if (!rows.length) return NextResponse.json({ ok: false, error: "player_not_found" }, { status: 404 });

  const p = rows[0];
  return NextResponse.json({
    ok: true,
    player: {
      username: p.tg_username ?? p.tg_handle,
      displayName: p.display_name,
      credits: p.credits,
      usdtBalance: Number(p.usdt_balance ?? 0),
      totalPoints: p.total_points,
      streak: p.streak,
      createdAt: p.created_at,
    },
  });
}
