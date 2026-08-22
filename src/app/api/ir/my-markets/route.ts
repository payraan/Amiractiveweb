import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables, CREATOR_SHARE_REFERRED, CREATOR_SHARE_OTHER } from "@/lib/iran";
import { isDemo } from "@/lib/platform-mode";

export const dynamic = "force-dynamic";

// درآمد بازارساز — به تفکیک هر بازار.
//
// ── چرا لازم بود ──
// سهم سازنده از فاز ۶ ساخته شده بود و در تسویه پرداخت می‌شد، ولی **هیچ‌جا
// دیده نمی‌شد**: نه در سایت، نه مینی‌اپ، نه ربات. سازنده‌ای که نمی‌داند
// چقدر درآورده، انگیزه‌ای برای ساختن بازار بعدی ندارد — و کل اقتصاد
// سازنده روی همین انگیزه ایستاده است.
//
// ── تفکیکی که نباید پنهان شود ──
// `creator_cut` با **هر شرط** بالا می‌رود ولی فقط **سر تسویه** پرداخت
// می‌شود. اگر این دو یکی نشان داده شوند، سازنده عددی می‌بیند که در کیف
// پولش نیست و فکر می‌کند پولش را خورده‌ایم. پس:
//   accrued → تا اینجا جمع شده (شامل بازارهای باز)
//   paid    → واقعا به کیف پول رفته (از خودِ دفترکل، نه محاسبه‌ی موازی)

export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }
  await ensureIrTables();
  const pool = await db();

  const [rows, paid] = await Promise.all([
    pool.query(
      `SELECT m.id, m.question, m.category, m.status, m.outcome,
              m.closes_at, m.settled_at, m.bettors,
              (m.yes_total + m.no_total)::float      AS pool,
              m.creator_cut::float                   AS cut,
              m.creator_cut_demo::float              AS cut_demo,
              m.early_cut::float                     AS early_cut
         FROM ir_markets m
        WHERE m.creator_id = $1
        ORDER BY m.created_at DESC
        LIMIT 100`,
      [playerId]
    ),
    // ⚠️ پرداختی از **خودِ دفترکل** خوانده می‌شود، نه از جمع `creator_cut`
    // بازارهای تسویه‌شده. دو محاسبه‌ی موازی برای یک عدد یعنی روزی که با هم
    // نمی‌خوانند — و آن روز، سازنده فکر می‌کند طلبکار است.
    pool.query(
      `SELECT COALESCE(SUM(amount),0)::float AS total,
              COALESCE(SUM(demo),0)::float   AS total_demo,
              COUNT(*)::int                  AS payouts
         FROM wallet_ledger
        WHERE player_id=$1 AND kind='ir_creator_share'`,
      [playerId]
    ),
  ]);

  const markets = rows.rows.map((r) => {
    const cut = Number(r.cut ?? 0);
    const settled = r.status === "settled" || r.status === "void";
    return {
      id: r.id,
      question: r.question,
      category: r.category,
      status: r.status,
      outcome: r.outcome,
      closesAt: r.closes_at,
      settledAt: r.settled_at,
      bettors: Number(r.bettors ?? 0),
      pool: Number(r.pool ?? 0),
      /** سهم انباشته تا این لحظه — با هر شرط تازه بالا می‌رود. */
      accrued: Math.round(cut * 1e6) / 1e6,
      accruedDemo: Math.round(Number(r.cut_demo ?? 0) * 1e6) / 1e6,
      /** آیا این عدد دیگر تغییر نمی‌کند و پرداخت شده؟ */
      settled,
      earlyCut: Math.round(Number(r.early_cut ?? 0) * 1e6) / 1e6,
    };
  });

  const accrued = markets.reduce((s, m) => s + m.accrued, 0);
  const pending = markets
    .filter((m) => !m.settled)
    .reduce((s, m) => s + m.accrued, 0);

  return NextResponse.json({
    ok: true,
    demo: isDemo(),
    markets,
    summary: {
      count: markets.length,
      open: markets.filter((m) => m.status === "open").length,
      totalBettors: markets.reduce((s, m) => s + m.bettors, 0),
      totalVolume: Math.round(markets.reduce((s, m) => s + m.pool, 0) * 1e6) / 1e6,
      /** جمع سهم روی همه‌ی بازارها، چه پرداخت‌شده چه نه. */
      accrued: Math.round(accrued * 1e6) / 1e6,
      /** آنچه هنوز روی بازارهای بازِ تسویه‌نشده منتظر است. */
      pending: Math.round(pending * 1e6) / 1e6,
      /** آنچه واقعا به کیف پول رفته — از دفترکل. */
      paid: Math.round(Number(paid.rows[0]?.total ?? 0) * 1e6) / 1e6,
      payouts: Number(paid.rows[0]?.payouts ?? 0),
    },
    rates: {
      referred: CREATOR_SHARE_REFERRED,
      other: CREATOR_SHARE_OTHER,
    },
  });
}
