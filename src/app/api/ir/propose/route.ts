import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { isTgAdmin } from "@/lib/broadcast";
import { db, touchActivity } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import {
  ensureIrTables,
  moveFunds,
  recordRevenue,
  PROPOSE_FEE_USDT,
} from "@/lib/iran";
import { isIrCategory } from "@/lib/ir-categories";
import { requireLinkedTelegram } from "@/lib/money-guard";
import { notifyAdminsNewMarket } from "@/lib/ir-review-notify";

export const dynamic = "force-dynamic";

// هزینه‌ی پیشنهاد بازار (ضد اسپم) از کیف پول تتر کسر می‌شود — بازار ایران
// هیچ MOON ندارد؛ MOON فقط مال بازار خارجی است. اگر ادمین رد کند،
// همین مبلغ کامل برمی‌گردد (روت ادمین).

/** حداکثر بازار در انتظار تأیید برای هر کاربر */
const MAX_PENDING = 3;

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  const linked = await requireLinkedTelegram(playerId);
  if (!linked.ok) return linked.response;

  let body: {
    question?: string;
    category?: string;
    sourceNote?: string;
    closesAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const question = String(body.question ?? "").trim();
  const sourceNote = String(body.sourceNote ?? "").trim();
  const category = String(body.category ?? "other").trim();
  const closesAt = new Date(String(body.closesAt ?? ""));

  if (question.length < 15 || question.length > 200) {
    return NextResponse.json({ ok: false, error: "bad_question" }, { status: 400 });
  }
  // منبع تسویه اجباری است — بدون آن سر نتیجه دعوا می‌شود
  if (sourceNote.length < 10) {
    return NextResponse.json({ ok: false, error: "source_required" }, { status: 400 });
  }
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "bad_date" }, { status: 400 });
  }
  // بدون این چک، هر رشته‌ای در ستون category می‌نشست و فیلتر دسته‌ها
  // بازارهایی را نشان نمی‌داد که دسته‌ی نامعتبر داشتند.
  if (!isIrCategory(category)) {
    return NextResponse.json({ ok: false, error: "bad_category" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ⚠️ **مجموع واقعی و دمو**. کارمزد از `moveFunds` بدون `realOnly`
    // می‌گذرد، یعنی اول از دمو برداشته می‌شود. وقتی اینجا فقط
    // `usdt_balance` سنجیده می‌شد، کاربری که تنها بونوس داشت «موجودی کافی
    // نیست» می‌گرفت — در حالی که کارمزدش قابل پرداخت بود.
    const pl = await client.query(
      `SELECT usdt_balance + demo_balance AS spendable, tg_user_id
         FROM players WHERE id=$1 FOR UPDATE`,
      [playerId]
    );
    if (!pl.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
    }

    // ادمین پلتفرم رایگان بازار می‌سازد. کارمزد یک ابزار ضد اسپم برای
    // کاربر است؛ گرفتنش از خودِ گرداننده فقط پول را از یک جیب به جیب دیگر
    // می‌برد و دفترکل درآمد را با درآمد ساختگی آلوده می‌کند.
    const tgId = Number(pl.rows[0].tg_user_id ?? 0);
    const fee = tgId && isTgAdmin(tgId) ? 0 : PROPOSE_FEE_USDT;

    const pending = await client.query(
      "SELECT count(*)::int AS n FROM ir_markets WHERE creator_id=$1 AND status='pending'",
      [playerId]
    );
    if (pending.rows[0].n >= MAX_PENDING) {
      await client.query("ROLLBACK");
      log.info("ir.propose_rejected", { playerId, reason: "too_many_pending" });
      return NextResponse.json({ ok: false, error: "too_many_pending" }, { status: 429 });
    }

    if (fee > 0 && Number(pl.rows[0].spendable) < fee) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "insufficient_funds" },
        { status: 402 }
      );
    }

    const ins = await client.query(
      `INSERT INTO ir_markets (creator_id, question, category, source_note, closes_at, status, fee_usdt)
       VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id`,
      [playerId, question, category, sourceNote, closesAt.toISOString(), fee]
    );
    // سهم دمو از همین پرداخت را خودِ moveFunds برمی‌گرداند و به دفترکل
    // درآمد داده می‌شود؛ حدس‌زدنش از روی برچسبِ حساب همان اشتباهی بود که
    // کمیسیون بازارها را «واقعی» نشان می‌داد.
    if (fee > 0) {
      const paid = await moveFunds(
        client,
        playerId,
        -fee,
        "ir_propose_fee",
        `m${ins.rows[0].id}`
      );
      await recordRevenue(client, "ir_propose_fee", fee, {
        marketId: ins.rows[0].id,
        playerId,
        demoAmount: paid.demoPart,
      });
    }

    await touchActivity(client, playerId);

    await client.query("COMMIT");

    // اعلان به ادمین‌ها — **بیرون** از ترنزاکشن و best-effort. نرسیدن
    // اعلان نباید ساخت بازارِ کاربر را خراب کند؛ بازار در پنل ادمین هست.
    notifyAdminsNewMarket(ins.rows[0].id).catch(() => {});

    // لینک کاور را **سرور** می‌سازد چون نام ربات فقط اینجاست. اگر کلاینت
    // می‌ساختش، نام ربات باید NEXT_PUBLIC می‌شد و یک مقدار در دو جا.
    log.info("ir.proposed", {
      playerId,
      marketId: ins.rows[0].id,
      fee,
      category,
    });

    const bot = (process.env.TG_BOT_USERNAME ?? "").replace(/^@/, "");
    return NextResponse.json({
      ok: true,
      cost: fee,
      marketId: ins.rows[0].id,
      coverUrl: bot ? `https://t.me/${bot}?start=cover_${ins.rows[0].id}` : null,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log.error("ir.propose_failed", {
      playerId,
      err: err instanceof Error ? err.message : "error",
    });
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
