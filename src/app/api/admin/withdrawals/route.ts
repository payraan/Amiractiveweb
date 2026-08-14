import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { refundWithdrawal } from "@/lib/withdrawal-sync";

export const dynamic = "force-dynamic";

// مدیریت برداشت‌ها.
//
// دلیل وجودش: کرون آشتی، ردیف‌هایی را که به نتیجه‌ی قطعی نرسیده‌اند علامت
// `stuck` می‌زند و عمدا خودش پول را برنمی‌گرداند — چون نمی‌داند درگاه
// درخواست را دیده یا نه. علامتی که راه اقدام نداشته باشد بی‌فایده است، پس
// اینجا همان تصمیم انسانی گرفته می‌شود.

/** جدول ممکن است هنوز ساخته نشده باشد — هیچ برداشتی رخ نداده. */
async function tableExists(): Promise<boolean> {
  const pool = await db();
  const r = await pool.query<{ ok: boolean }>(
    "SELECT to_regclass('public.withdrawals') IS NOT NULL AS ok"
  );
  return Boolean(r.rows[0]?.ok);
}

export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!(await tableExists())) {
    return NextResponse.json({ ok: true, rows: [], counts: {} });
  }

  const status = new URL(req.url).searchParams.get("status") ?? "stuck";
  const pool = await db();

  const { rows } = await pool.query(
    `SELECT w.id, w.player_id, w.amount, w.to_address, w.network,
            w.gateway_uuid, w.status, w.error, w.created_at,
            p.display_name, p.tg_username
       FROM withdrawals w
       LEFT JOIN players p ON p.id = w.player_id
      WHERE ($1 = 'all' OR w.status = $1)
      ORDER BY w.id DESC LIMIT 200`,
    [status]
  );

  // شمارش هر وضعیت، تا ادمین بدون عوض‌کردن فیلتر ببیند کجا کار هست.
  const c = await pool.query<{ status: string; n: string }>(
    "SELECT status, COUNT(*)::text AS n FROM withdrawals GROUP BY status"
  );
  const counts: Record<string, number> = {};
  for (const r of c.rows) counts[r.status] = Number(r.n);

  return NextResponse.json({ ok: true, rows, counts });
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { id?: number | string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id || body.action !== "refund") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // ⚠️ علت اجباری است و در ستون `error` ردیف می‌نشیند. برگرداندن پولِ یک
  // برداشت، حرکتی است که فقط با تکیه بر حرف درگاه درست است؛ اگر چرایی‌اش
  // ثبت نشود، شش ماه بعد هیچ‌کس نمی‌داند این پول چرا برگشت.
  const note = String(body.note ?? "").trim();
  if (note.length < 3) {
    return NextResponse.json({ ok: false, error: "note_required" }, { status: 400 });
  }

  // خودِ refundWithdrawal اتمیک است: وضعیت را با همان UPDATE ادعا می‌کند،
  // پس دو کلیک هم‌زمان ادمین هم دوبار پول برنمی‌گرداند.
  const ok = await refundWithdrawal(id, `admin: ${note.slice(0, 120)}`);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "not_refundable" }, { status: 409 });
}
