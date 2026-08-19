import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyAdmin, ADMIN_COOKIE } from "@/lib/admin";
import { approveMarket, rejectMarket } from "@/lib/ir-moderation";
import {
  ensureIrTables,
  oddsFor,
  impliedPct,
  settleIrMarket,
  wouldBeVoid,
  DISPUTE_HOURS,
} from "@/lib/iran";

export const dynamic = "force-dynamic";

/** فهرست بازارها برای مدیریت */
export async function GET(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await ensureIrTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const pool = await db();

  const { rows } = await pool.query(
    `SELECT m.*, p.display_name AS creator, p.tg_username AS creator_tg,
            (SELECT count(*)::int FROM ir_disputes d
              WHERE d.market_id = m.id AND d.status = 'open') AS open_disputes
       FROM ir_markets m
       LEFT JOIN players p ON p.id = m.creator_id
      WHERE ($1 = 'all' OR m.status = $1)
      ORDER BY m.created_at DESC LIMIT 200`,
    [status]
  );

  const disputes = await pool.query(
    `SELECT d.id, d.market_id, d.reason, d.status, d.admin_note, d.created_at,
            p.tg_username AS username, m.question, m.outcome
       FROM ir_disputes d
       JOIN players p ON p.id = d.player_id
       JOIN ir_markets m ON m.id = d.market_id
      ORDER BY (d.status = 'open') DESC, d.created_at DESC
      LIMIT 100`
  );

  return NextResponse.json({
    ok: true,
    disputes: disputes.rows,
    markets: rows.map((r) => {
      const yes = Number(r.yes_total);
      const no = Number(r.no_total);
      const settledAt = r.settled_at ? new Date(r.settled_at).getTime() : 0;
      return {
        id: r.id,
        question: r.question,
        category: r.category,
        sourceNote: r.source_note,
        closesAt: r.closes_at,
        status: r.status,
        outcome: r.outcome,
        creator: r.creator,
        creatorTg: r.creator_tg,
        yesTotal: yes,
        noTotal: no,
        volume: yes + no,
        bettors: r.bettors,
        yesPct: impliedPct(yes, no),
        yesOdds: Math.round(oddsFor(yes, no, "yes") * 100) / 100,
        noOdds: Math.round(oddsFor(yes, no, "no") * 100) / 100,
        // هشدار پیش از تأیید نتیجه: آیا این نتیجه بازار را باطل می‌کند؟
        wouldVoidYes: wouldBeVoid(yes, no, "yes"),
        wouldVoidNo: wouldBeVoid(yes, no, "no"),
        disputeEndsAt: settledAt
          ? new Date(settledAt + DISPUTE_HOURS * 3600_000).toISOString()
          : null,
        canFinalize:
          r.status === "settling" &&
          settledAt > 0 &&
          Date.now() - settledAt >= DISPUTE_HOURS * 3600_000,
        createdAt: r.created_at,
        openDisputes: Number(r.open_disputes ?? 0),
      };
    }),
  });
}

/** اقدام‌های مدیریتی روی یک بازار */
export async function POST(req: Request) {
  const jar = await cookies();
  if (!verifyAdmin(jar.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    id?: number;
    action?: string;
    outcome?: string;
    reason?: string;
    disputeId?: number;
    verdict?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  await ensureIrTables();
  const pool = await db();

  // ⚠️ **هر کنش ادمین روی بازار ثبت می‌شود، پیش از اجرا.**
  //
  // `resolve` تعیین می‌کند پول به کدام طرف برود و `finalize` پرداختش
  // می‌کند — یعنی این روت پرقدرت‌ترین نقطه‌ی پلتفرم است. اگر روزی نتیجه‌ای
  // مورد اعتراض قرار بگیرد، این خط تنها سند بی‌طرفِ «چه‌کسی، کِی، چه
  // تصمیمی گرفت» است.
  log.warn("admin.ir_action", { action, marketId: id });

  // تأیید و رد از `lib/ir-moderation.ts` می‌آیند چون ربات هم همان‌ها را
  // صدا می‌زند. رد کردن پول برمی‌گرداند؛ دو پیاده‌سازی موازی روی مسیر پول
  // یعنی روزی یکی‌شان یک بررسی کمتر دارد.
  if (action === "approve") {
    const r = await approveMarket(id);
    return r.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, error: r.error }, { status: 409 });
  }

  if (action === "reject") {
    const r = await rejectMarket(id, String(body.reason ?? "rejected"));
    return r.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          { ok: false, error: r.error },
          { status: r.error === "not_pending" ? 409 : 500 }
        );
  }

  // بستن دستی پیش از موعد
  if (action === "lock") {
    await pool.query(
      "UPDATE ir_markets SET status='locked' WHERE id=$1 AND status='open'",
      [id]
    );
    return NextResponse.json({ ok: true });
  }

  // ثبت نتیجه — شروع پنجره‌ی اعتراض ۲۴ ساعته
  if (action === "resolve") {
    const outcome = body.outcome;
    if (outcome !== "yes" && outcome !== "no" && outcome !== "void") {
      return NextResponse.json({ ok: false, error: "bad_outcome" }, { status: 400 });
    }
    await pool.query(
      `UPDATE ir_markets SET status='settling', outcome=$2, settled_at=now()
        WHERE id=$1 AND status IN ('open','locked')`,
      [id, outcome]
    );
    return NextResponse.json({ ok: true, disputeHours: DISPUTE_HOURS });
  }

  // رسیدگی به اعتراض: پذیرفتن یا رد کردن
  if (action === "dispute_resolve") {
    const disputeId = Number(body.disputeId);
    const verdict = String(body.verdict ?? "");
    if (!Number.isInteger(disputeId) || !["accept", "reject"].includes(verdict)) {
      return NextResponse.json({ ok: false, error: "bad_verdict" }, { status: 400 });
    }
    await pool.query(
      `UPDATE ir_disputes
          SET status=$2, admin_note=$3, resolved_at=now()
        WHERE id=$1 AND status='open'`,
      [disputeId, verdict === "accept" ? "accepted" : "rejected", String(body.reason ?? "").slice(0, 500) || null]
    );
    return NextResponse.json({ ok: true });
  }

  // اصلاح نتیجه در پنجره‌ی اعتراض — تنها راه برگرداندن اشتباه ادمین پیش از
  // پرداخت. پس از تسویه‌ی نهایی هیچ راه برگشتی وجود ندارد.
  if (action === "revise") {
    const outcome = body.outcome;
    if (outcome !== "yes" && outcome !== "no" && outcome !== "void") {
      return NextResponse.json({ ok: false, error: "bad_outcome" }, { status: 400 });
    }
    // ساعت پنجره از نو شروع می‌شود تا همه فرصت دیدن نتیجه‌ی اصلاح‌شده را داشته باشند
    await pool.query(
      `UPDATE ir_markets SET outcome=$2, settled_at=now()
        WHERE id=$1 AND status='settling'`,
      [id, outcome]
    );
    return NextResponse.json({ ok: true, disputeHours: DISPUTE_HOURS });
  }

  // تسویه‌ی نهایی و پرداخت
  if (action === "finalize") {
    const r = await settleIrMarket(id);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
