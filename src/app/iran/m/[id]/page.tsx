import type { Metadata } from "next";
import Link from "next/link";
import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { db } from "@/lib/db";
import { ensureIrTables, impliedPct, oddsFor, COMMISSION } from "@/lib/iran";
import { IR_CATEGORIES } from "@/lib/ir-categories";
import { dualDateTime } from "@/lib/dates";
import ShareLink from "@/components/iran/ShareLink";
import DisputePanel from "@/components/iran/DisputePanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type Row = {
  id: number;
  question: string;
  category: string;
  source_note: string;
  closes_at: string;
  status: string;
  outcome: string | null;
  creator_id: number | null;
  creator_cut: string;
  yes_total: string;
  no_total: string;
  bettors: number;
  creator: string | null;
};

async function getMarket(id: string): Promise<Row | null> {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  await ensureIrTables();
  const pool = await db();
  const { rows } = await pool.query<Row>(
    `SELECT m.id, m.question, m.category, m.source_note, m.closes_at, m.status,
            m.outcome, m.yes_total, m.no_total, m.bettors, m.creator_id,
            m.creator_cut, p.display_name AS creator
       FROM ir_markets m
       LEFT JOIN players p ON p.id = m.creator_id
      WHERE m.id = $1 AND m.status <> 'pending'`,
    [n]
  );
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const m = await getMarket(id);
  if (!m) return { title: "بازار پیدا نشد | نارمون" };
  const yes = impliedPct(Number(m.yes_total), Number(m.no_total));
  const title = `${m.question} | بازار ایران نارمون`;
  const description = `اجماع بازار: بله ${yes}٪ با ${m.bettors} مشارکت‌کننده. نظر تو چیست؟`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const STATUS_FA: Record<string, string> = {
  open: "باز برای پیش‌بینی",
  locked: "بسته، منتظر نتیجه",
  settling: "در پنجره‌ی بازبینی",
  settled: "تسویه‌شده",
  void: "باطل‌شده",
};

export default async function IranMarketPage({ params }: Props) {
  const { id } = await params;
  const m = await getMarket(id);

  return (
    <>
      <CandleField />
      <Nav />
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-32 md:px-6">
        {!m ? (
          <div className="no-lift rounded-2xl border border-line bg-surface/50 p-10 text-center">
            <p className="text-sm font-bold">این بازار پیدا نشد</p>
            <p className="mt-2 text-xs text-muted">
              ممکن است هنوز تأیید نشده باشد یا حذف شده باشد.
            </p>
            <Link
              href="/iran"
              className="no-zoom mt-6 inline-block rounded-xl bg-gold px-6 py-2.5 font-display text-sm font-extrabold text-ink"
            >
              رفتن به بازار ایران
            </Link>
          </div>
        ) : (
          <Market m={m} />
        )}
      </main>
      <Footer />
    </>
  );
}

function Market({ m }: { m: Row }) {
  const cut = m.creator_id === null ? 0 : Number(m.creator_cut ?? 0);
  const yes = Number(m.yes_total);
  const no = Number(m.no_total);
  const yesPct = impliedPct(yes, no);
  const noPct = Math.round((100 - yesPct) * 10) / 10;
  const cat = IR_CATEGORIES.find((c) => c.id === m.category)?.label ?? m.category;

  return (
    <>
      <span className="font-mono text-[11px] tracking-[0.3em] text-gold-deep">
        IRAN MARKET
      </span>

      <div className="no-lift mt-5 rounded-2xl border border-line bg-surface/50 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted">
            {cat}
          </span>
          <span className="rounded-full border border-gold/40 px-2.5 py-1 text-[10px] text-gold">
            {STATUS_FA[m.status] ?? m.status}
          </span>
        </div>

        <h1 className="mt-4 font-display text-xl font-black leading-9 md:text-2xl">
          {m.question}
        </h1>

        {/* اجماع بازار */}
        <div className="mt-6 flex items-end justify-between font-mono text-xs">
          <span className="text-gain">
            بله <b className="text-lg">{yesPct}٪</b>
          </span>
          <span className="text-loss">
            <b className="text-lg">{noPct}٪</b> خیر
          </span>
        </div>
        <div className="mt-2 flex h-12 overflow-hidden rounded-lg border border-line">
          <div className="bg-gain/25" style={{ width: `${yesPct}%` }} />
          <div className="flex-1 bg-loss/25" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell k="حجم استخر" v={`$${(yes + no).toFixed(2)}`} />
          <Cell k="مشارکت‌کنندگان" v={String(m.bettors)} />
          <Cell k="ضریب بله" v={`×${Math.round(oddsFor(yes, no, "yes", cut) * 100) / 100 || "—"}`} />
          <Cell k="ضریب خیر" v={`×${Math.round(oddsFor(yes, no, "no", cut) * 100) / 100 || "—"}`} />
        </div>

        <div className="mt-5 rounded-xl border border-line bg-ink/30 p-4 text-[11px] leading-7 text-muted">
          <div>
            <b className="text-gold">بسته‌شدن:</b> {dualDateTime(m.closes_at)}
          </div>
          <div className="mt-1 break-all">
            <b className="text-gold">منبع تسویه:</b> {m.source_note}
          </div>
          {m.creator && (
            <div className="mt-1">
              <b className="text-gold">سازنده:</b> {m.creator}
            </div>
          )}
          {m.outcome && (
            <div className="mt-1">
              <b className="text-gold">نتیجه:</b>{" "}
              {m.outcome === "yes" ? "بله" : m.outcome === "no" ? "خیر" : "باطل"}
            </div>
          )}
        </div>

        <DisputePanel marketId={m.id} />

        <ShareLink id={m.id} question={m.question} yesPct={yesPct} />

        <Link
          href="/iran"
          className="no-zoom mt-3 block rounded-xl bg-gold py-3 text-center font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
        >
          {m.status === "open" ? "ثبت پیش‌بینی روی این بازار" : "دیدن بازارهای باز"}
        </Link>

        <p className="mt-4 text-[10px] leading-6 text-muted">
          همه‌ی شرط‌ها در یک استخر جمع می‌شوند و پس از کسر{" "}
          {Math.round(COMMISSION * 100)}٪ کارمزد، بین برنده‌ها به نسبت سهمشان
          تقسیم می‌شود.
        </p>
      </div>
    </>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised/40 px-3 py-2.5">
      <div className="text-[10px] text-muted">{k}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-cream" dir="ltr">
        {v}
      </div>
    </div>
  );
}
