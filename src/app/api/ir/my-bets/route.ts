import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayerId } from "@/lib/current-player";
import { ensureIrTables } from "@/lib/iran";

export const dynamic = "force-dynamic";

// ── کارنامه‌ی پیش‌بینی‌های بازار ایران ────────────────────────
//
// چرا وجود دارد: تا امروز کاربر هیچ‌جا نمی‌دید در کدام بازار چقدر گذاشته و
// چه شده. در بازی امتیازی می‌شود از آن گذشت، ولی اینجا پول واقعی است —
// کاربری که نتواند حساب خودش را ببیند، به پلتفرم اعتماد نمی‌کند و حق دارد.
//
// هر سه سطح (سایت، مینی‌اپ، ربات) از همین یک روت می‌خوانند؛ `currentPlayerId`
// هر سه را به یک شناسه می‌رساند.

type Row = {
  market_id: number;
  question: string;
  category: string;
  market_status: string;
  outcome: string | null;
  void_reason: string | null;
  closes_at: string;
  settled_at: string | null;
  side: string;
  stake: string;
  demo_stake: string;
  payout: string | null;
  status: string;
  created_at: string;
};

export async function GET(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "not_authed" }, { status: 401 });
  }

  await ensureIrTables();
  const pool = await db();

  // فیلتر «باز / تمام‌شده». پیش‌فرض همه، چون کاربر معمولا اول کل کارنامه را
  // می‌خواهد ببیند.
  const filter = new URL(req.url).searchParams.get("filter") ?? "all";

  const { rows } = await pool.query<Row>(
    `SELECT b.market_id, m.question, m.category,
            m.status AS market_status, m.outcome, m.void_reason,
            m.closes_at, m.settled_at,
            b.side, b.stake, b.demo_stake, b.payout, b.status, b.created_at
       FROM ir_bets b
       JOIN ir_markets m ON m.id = b.market_id
      WHERE b.player_id = $1
        AND ($2 = 'all'
             OR ($2 = 'open'   AND b.status = 'open')
             OR ($2 = 'closed' AND b.status <> 'open'))
      ORDER BY b.id DESC
      LIMIT 200`,
    [playerId, filter]
  );

  const bets = rows.map((r) => {
    const stake = Number(r.stake);
    const payout = r.payout === null ? null : Number(r.payout);
    return {
      marketId: r.market_id,
      question: r.question,
      category: r.category,
      marketStatus: r.market_status,
      outcome: r.outcome,
      voidReason: r.void_reason,
      closesAt: r.closes_at,
      settledAt: r.settled_at,
      side: r.side,
      stake,
      // سهم بونوس از همین شرط — کاربر باید بداند کدام بخشش هدیه بوده،
      // چون اصلِ بونوس قابل برداشت نیست و فقط سودش واقعی می‌شود.
      demoStake: Number(r.demo_stake),
      status: r.status,
      payout,
      /** سود یا زیان خالص. برای شرط باز هنوز معلوم نیست، پس null. */
      net: payout === null ? null : Math.round((payout - stake) * 1e6) / 1e6,
      createdAt: r.created_at,
    };
  });

  // جمع‌بندی از روی همان ردیف‌ها ساخته می‌شود، نه یک کوئری جدا: دو منبع
  // برای یک عدد یعنی روزی که با هم نمی‌خوانند.
  const settled = bets.filter((b) => b.net !== null);
  const sum = (ns: number[]) =>
    Math.round(ns.reduce((a, b) => a + b, 0) * 1e6) / 1e6;

  return NextResponse.json({
    ok: true,
    bets,
    summary: {
      total: bets.length,
      open: bets.filter((b) => b.status === "open").length,
      won: bets.filter((b) => b.status === "won").length,
      lost: bets.filter((b) => b.status === "lost").length,
      refunded: bets.filter((b) => b.status === "refunded").length,
      /** مجموع مبلغی که در شرط‌های باز قفل است */
      lockedStake: sum(
        bets.filter((b) => b.status === "open").map((b) => b.stake)
      ),
      settledStake: sum(settled.map((b) => b.stake)),
      settledReturn: sum(settled.map((b) => b.payout ?? 0)),
      net: sum(settled.map((b) => b.net ?? 0)),
    },
  });
}
