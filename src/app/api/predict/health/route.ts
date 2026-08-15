import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── سلامت سرویس ─────────────────────────────────────────────
//
// ⚠️ این روت تا امروز **تعداد دقیق کاربران، راندها و پیش‌بینی‌های پلتفرم**
// را بدون هیچ احراز هویتی به هر کسی می‌داد. هیچ‌جای کد هم صدایش نمی‌زد —
// یک روت دیباگِ جامانده بود.
//
// تعداد کاربران عدد تجاری ماست: رقیب، سرمایه‌گذار و هر کاربری می‌توانست با
// یک درخواست ساده بفهمد پلتفرم چقدر کوچک است.
//
// حالا پاسخ عمومی فقط می‌گوید «سرویس زنده است و دیتابیس جواب می‌دهد» —
// همان چیزی که یک health check لازم دارد. اعداد پشت `x-settle-key` رفتند.

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY ?? "";
  const authed = Boolean(key) && req.headers.get("x-settle-key") === key;

  try {
    const pool = await db();

    if (!authed) {
      // فقط اثبات زنده‌بودن: یک کوئری بی‌ضرر که هیچ عددی از کسب‌وکار نمی‌گوید.
      await pool.query("SELECT 1");
      return NextResponse.json({ ok: true });
    }

    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM players)     AS players,
         (SELECT count(*) FROM rounds)      AS rounds,
         (SELECT count(*) FROM predictions) AS predictions`
    );
    return NextResponse.json({ ok: true, tables: rows[0] });
  } catch (err) {
    // متن خطا فقط برای فراخوانِ احرازشده — پیام خطای دیتابیس می‌تواند نام
    // جدول و ساختار را لو بدهد.
    return NextResponse.json(
      {
        ok: false,
        ...(authed
          ? { error: err instanceof Error ? err.message : "unknown" }
          : {}),
      },
      { status: 500 }
    );
  }
}
