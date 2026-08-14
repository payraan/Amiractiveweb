import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { ensureTranslationTable, translatorReady } from "@/lib/translate";

export const dynamic = "force-dynamic";

// بازبینی و اصلاح ترجمه‌ی عنوان بازارهای خارجی.
//
// ترجمه‌ی ماشینی روی اسم‌های خاص و اصطلاحات تخصصی می‌لنگد، و مالک باید
// بتواند در ده ثانیه درستش کند. هر اصلاح دستی `edited` می‌شود و از آن پس
// هیچ اجرای خودکاری رویش نمی‌نویسد.

async function guard() {
  const jar = await cookies();
  return verifyAdmin(jar.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: Request) {
  if (!(await guard())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await ensureTranslationTable();
  const pool = await db();

  // پیش‌فرض روی ترجمه‌نشده‌هاست: آن‌ها همان‌هایی‌اند که کاربر انگلیسی می‌بیند.
  const filter = new URL(req.url).searchParams.get("filter") ?? "all";
  const where =
    filter === "pending"
      ? "WHERE fa IS NULL"
      : filter === "edited"
        ? "WHERE edited = true"
        : "";

  const rows = await pool.query(
    `SELECT hash, en, fa, edited, failures, updated_at
       FROM translations ${where}
      ORDER BY (fa IS NULL) DESC, updated_at DESC
      LIMIT 200`
  );
  const counts = await pool.query<{ total: string; pending: string; edited: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE fa IS NULL)::text AS pending,
            COUNT(*) FILTER (WHERE edited)::text AS edited
       FROM translations`
  );

  return NextResponse.json({
    ok: true,
    ready: translatorReady(),
    counts: counts.rows[0],
    rows: rows.rows,
  });
}

export async function POST(req: Request) {
  if (!(await guard())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { hash?: string; fa?: string; retry?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const hash = String(body.hash ?? "").trim();
  if (!hash) {
    return NextResponse.json({ ok: false, error: "bad_hash" }, { status: 400 });
  }

  await ensureTranslationTable();
  const pool = await db();

  // «تلاش دوباره» عنوان را به صف برمی‌گرداند: ترجمه پاک و شمارنده‌ی شکست
  // صفر می‌شود، و علامت دستی هم برداشته می‌شود تا اجرای خودکار اجازه داشته
  // باشد رویش بنویسد.
  if (body.retry) {
    await pool.query(
      "UPDATE translations SET fa=NULL, edited=false, failures=0, updated_at=now() WHERE hash=$1",
      [hash]
    );
    return NextResponse.json({ ok: true });
  }

  const fa = String(body.fa ?? "").trim();
  if (!fa) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }
  await pool.query(
    "UPDATE translations SET fa=$2, edited=true, failures=0, updated_at=now() WHERE hash=$1",
    [hash, fa]
  );
  return NextResponse.json({ ok: true });
}
