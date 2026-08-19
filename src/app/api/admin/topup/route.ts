import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { payReferralCommission } from "@/lib/referral";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE, ensureTopupTable } from "@/lib/admin";
import { normalizeUsername } from "@/lib/auth";
import { ensureIrTables, moveFunds } from "@/lib/iran";

export const dynamic = "force-dynamic";

/**
 * قفل‌کردن ردیف بازیکن از روی یوزرنیم ورود یا هندل تلگرام.
 *
 * یوزرنیم ورود یکتاست ولی هندل تلگرام نیست — کاربر می‌تواند هندلش را عوض
 * کند و همان رشته روی حساب دیگری بنشیند. پس اگر تطابق دقیقِ یوزرنیم نبود و
 * چند حساب با همان هندل خوردند، عمدا شکست می‌خوریم: شارژ اشتباه یعنی پول
 * واقعی روی حساب اشتباه.
 */
async function lockPlayerByName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  name: string
): Promise<
  | { ok: true; id: number; credits: number }
  | { ok: false; error: "player_not_found" | "ambiguous_username" }
> {
  const r = await client.query(
    `SELECT id, credits, COALESCE(tg_username=$1, false) AS exact FROM players
      WHERE tg_username=$1 OR lower(tg_handle)=$1
      -- NULLS LAST اجباری است: در حساب تلگرام‌زاد tg_username خالی است، پس
      -- (tg_username=$1) نه false بلکه NULL می‌شود و در DESC پیش‌فرض اول
      -- می‌نشیند — یعنی تطابق دقیقِ یوزرنیم را کنار می‌زند.
      ORDER BY (tg_username=$1) DESC NULLS LAST
      FOR UPDATE`,
    [name]
  );
  if (!r.rowCount) return { ok: false, error: "player_not_found" };
  if (!r.rows[0].exact && r.rowCount > 1) {
    return { ok: false, error: "ambiguous_username" };
  }
  return { ok: true, id: r.rows[0].id, credits: r.rows[0].credits };
}

export async function POST(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    username?: string;
    amount?: number | string;
    note?: string;
    currency?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? "");
  const note = (body.note ?? "").slice(0, 200);
  // تتر اعشار دارد، MOON ندارد — پس گرد کردن فقط برای MOON است.
  const isUsdt = body.currency === "usdt";
  const raw = Number(body.amount);
  const amount = isUsdt ? Math.round(raw * 1e6) / 1e6 : Math.trunc(raw);

  if (!username) {
    return NextResponse.json({ ok: false, error: "bad_username" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ ok: false, error: "bad_amount" }, { status: 400 });
  }

  // ── مسیر تتر ──
  // دستی در دیتابیس دست‌کاری نکن: این مسیر موجودی را از راه moveFunds
  // عوض می‌کند تا دفترکل و موجودی همیشه با هم بخوانند (مبنای حسابرسی).
  if (isUsdt) {
    await ensureIrTables();
    const pool = await db();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const pl = await lockPlayerByName(client, username);
      if (!pl.ok) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: pl.error },
          { status: pl.error === "player_not_found" ? 404 : 409 }
        );
      }
      // شارژ دستی = پول دمو. پول واقعی فقط از وبهوک درگاه می‌آید.
      //
      // `is_demo` هنوز روی حساب علامت می‌خورد چون گزارش‌های قدیمی ادمین به آن
      // تکیه دارند، ولی دیگر مبنای حسابداری نیست: مبنا خودِ ستون
      // `demo_balance` است. برچسبِ حساب نمی‌توانست بگوید «این *پول* دمو
      // است»، فقط می‌گفت «این *آدم* یک بار شارژ دستی گرفته».
      if (amount > 0) {
        await client.query("UPDATE players SET is_demo = true WHERE id=$1", [pl.id]);
      }
      // کل مبلغِ شارژ دستی دمو است — چه مثبت و چه منفی. برای مبلغ منفی،
      // moveFunds خودش اول از دمو کم می‌کند، که همان رفتار درست است.
      const after = await moveFunds(
        client,
        pl.id,
        amount,
        "admin_adjust",
        note || "manual",
        { creditDemo: amount > 0 ? amount : 0 }
      );
      await client.query("COMMIT");
      // ⚠️ **هر دست‌کاری دستی موجودی باید رد داشته باشد.** این تنها راهی
      // است که پول بدون واریز درگاه وارد سیستم می‌شود؛ اگر روزی موجودی
      // کل با دفترکل درگاه نخواند، اولین جایی که باید نگاه کرد همین است.
      log.warn("admin.topup", {
        playerId: pl.id,
        username,
        currency: "usdt",
        amount,
        newUsdt: after.real,
        newDemo: after.demo,
      });
      return NextResponse.json({
        ok: true,
        username,
        newUsdt: after.real,
        newDemo: after.demo,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      const msg = err instanceof Error ? err.message : "server_error";
      log.error("admin.topup_failed", { username, currency: "usdt", amount, err: msg });
      // moveFunds اگر موجودی منفی شود خطا می‌دهد
      return NextResponse.json(
        { ok: false, error: msg === "insufficient_funds" ? msg : "server_error" },
        { status: msg === "insufficient_funds" ? 400 : 500 }
      );
    } finally {
      client.release();
    }
  }

  await ensureTopupTable();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pl = await lockPlayerByName(client, username);
    if (!pl.ok) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: pl.error },
        { status: pl.error === "player_not_found" ? 404 : 409 }
      );
    }
    const playerId = pl.id;
    const upd = await client.query(
      "UPDATE players SET credits = GREATEST(0, credits + $1) WHERE id=$2 RETURNING credits",
      [amount, playerId]
    );
    await client.query(
      "INSERT INTO credit_topups (player_id, amount, note) VALUES ($1, $2, $3)",
      [playerId, amount, note || null]
    );
    await client.query("COMMIT");

    // پورسانت دعوت‌کننده (فقط برای شارژ مثبت؛ خطایش نباید شارژ را خراب کند)
    let commission = 0;
    if (amount > 0) {
      try {
        const r = await payReferralCommission(playerId, amount);
        commission = r.paid;
      } catch {
        commission = 0;
      }
    }

    log.warn("admin.topup", {
      playerId,
      username,
      currency: "moon",
      amount,
      newCredits: upd.rows[0].credits,
      referralCommission: commission,
    });

    return NextResponse.json({
      ok: true,
      username,
      newCredits: upd.rows[0].credits,
      referralCommission: commission,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "server_error";
    log.error("admin.topup_failed", { username, currency: "moon", amount, err: msg });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
