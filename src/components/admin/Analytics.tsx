"use client";

import { useState } from "react";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { IR_CATEGORIES } from "@/lib/ir-categories";

// تحلیل رفتار کاربر.
//
// همه‌ی نمودارها SVG دستی‌اند و هیچ کتابخانه‌ای اضافه نشده — همان تصمیم
// سند: باندل سنگین برای مخاطب ایران هزینه‌ی واقعی دارد، و این نمودارها
// آن‌قدر ساده‌اند که کتابخانه توجیه نکند.
//
// ⚠️ هر بخش **حالت خالی** دارد و حالت خالی، توضیح می‌دهد چه چیزی قرار است
// اینجا بیاید. تا وقتی کاربر واقعی نیامده، همین حالت خالی تنها چیزی است
// که دیده می‌شود؛ پنل خالیِ بی‌توضیح یعنی پنل نامرئی.

type Funnel = Record<string, { n: number; people: number }>;
type CatRow = {
  game: string;
  category: string;
  opens: number;
  predicts: number;
  people: number;
};
type MarketRow = {
  game: string;
  marketId: string;
  category: string | null;
  opens: number;
  predicts: number;
};
type DayRow = {
  day: string;
  views: number;
  opens: number;
  predicts: number;
  people: number;
};
type Res = {
  days: number;
  totals: { events: number; people: number; firstDay: string | null };
  funnel: Funnel;
  byCategory: CatRow[];
  topMarkets: MarketRow[];
  daily: DayRow[];
  hourly: { hour: number; n: number }[];
  surfaces: { surface: string; opens: number; predicts: number; people: number }[];
  retention: { day: string; cohort: number; d1: number; d7: number }[];
};

const RANGES = [7, 30, 90] as const;

const fa = (n: number) => n.toLocaleString("fa-IR");
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

const GAME_LABEL: Record<string, string> = {
  iran: "بازار ایران",
  trade: "ترید",
  pulse: "نبض بازار",
  combo: "کمبو",
};

const IR_LABEL = Object.fromEntries(IR_CATEGORIES.map((c) => [c.id, c.label]));
const catLabel = (id: string) => IR_LABEL[id] ?? (id === "all" ? "همه" : id);

const faDay = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
  });

export default function Analytics() {
  const [days, setDays] = useState<number>(30);
  const { data, error, reload } = useAdminResource<Res>(
    `/api/admin/analytics?days=${days}`
  );

  if (error) {
    return (
      <div className="rounded-xl border border-loss/40 bg-loss/10 p-4 text-xs text-loss">
        خطا در خواندن داده: {error}{" "}
        <button type="button" onClick={reload} className="underline">
          تلاش دوباره
        </button>
      </div>
    );
  }
  if (!data) {
    return <p className="py-8 text-center text-xs text-muted">در حال بارگذاری…</p>;
  }

  const noData = data.totals.events === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
                days === d
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-line text-muted hover:text-cream"
              }`}
            >
              {fa(d)} روز
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted">
          {data.totals.firstDay
            ? `ثبت رفتار از ${faDay(data.totals.firstDay)}`
            : "هنوز رویدادی ثبت نشده"}
        </div>
      </div>

      {noData ? (
        <EmptyIntro />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="کل رویداد" v={data.totals.events} />
            <Stat label="کاربر شناسایی‌شده" v={data.totals.people} tone="gain" />
            <Stat
              label="بازار باز شد"
              v={data.funnel.market_open?.n ?? 0}
              tone="gold"
            />
            <Stat label="پیش‌بینی ثبت شد" v={data.funnel.predict?.n ?? 0} tone="gain" />
          </div>

          <Section title="قیف تبدیل" hint="از دیدن فهرست تا ثبت پیش‌بینی">
            <FunnelChart f={data.funnel} />
          </Section>

          <Section
            title="تقاضای دسته‌ها"
            hint="نرخ تبدیل می‌گوید کدام موضوع واقعا مخاطب دارد — نه تعداد بازار"
          >
            <CategoryChart rows={data.byCategory} />
          </Section>

          <Section title="فعالیت روزانه" hint="سه پله‌ی قیف در زمان">
            <DailyChart rows={data.daily} />
          </Section>

          <Section
            title="ساعت اوج فعالیت"
            hint="به وقت تهران — می‌گوید بازار را کِی منتشر کنی"
          >
            <HourChart rows={data.hourly} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="سایت در برابر مینی‌اپ" hint="کدام سطح بهتر تبدیل می‌کند">
              <SurfaceTable rows={data.surfaces} />
            </Section>
            <Section title="ماندگاری" hint="از کاربران هر روز، چند نفر برگشتند">
              <RetentionTable rows={data.retention} />
            </Section>
          </div>

          <Section
            title="پرتقاضاترین بازارها"
            hint="بیشترین بازکردن — همان‌هایی که باید بیشتر ساخته شوند"
          >
            <MarketsTable rows={data.topMarkets} />
          </Section>
        </>
      )}
    </div>
  );
}

/* ────────────────────────── قطعه‌های مشترک ───────────────────────── */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-ink/30 p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="mt-0.5 text-[10.5px] text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Stat({
  label,
  v,
  tone,
}: {
  label: string;
  v: number | string;
  tone?: "gain" | "gold";
}) {
  const c = tone === "gain" ? "text-gain" : tone === "gold" ? "text-gold" : "text-cream";
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-4 py-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${c}`} dir="ltr">
        {typeof v === "number" ? v.toLocaleString("en-US") : v}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-[11px] text-muted">{text}</p>;
}

function EmptyIntro() {
  return (
    <div className="rounded-xl border border-line bg-ink/30 p-6 text-center">
      <p className="text-sm font-bold text-cream">هنوز رفتاری ثبت نشده</p>
      <p className="mx-auto mt-2 max-w-lg text-[11.5px] leading-6 text-muted">
        ثبت رفتار تازه راه افتاده و تا وقتی کسی فهرست بازارها را باز نکند،
        اینجا خالی می‌ماند. به‌محض اولین بازدید، این بخش‌ها پر می‌شوند:
      </p>
      <ul className="mx-auto mt-4 flex max-w-md flex-col gap-1.5 text-start text-[11px] text-muted">
        <li>• <b className="text-cream">قیف تبدیل</b> — از دیدن فهرست تا ثبت پیش‌بینی</li>
        <li>• <b className="text-cream">تقاضای دسته‌ها</b> — کدام موضوع واقعا مخاطب دارد</li>
        <li>• <b className="text-cream">ساعت اوج</b> — بازار را چه ساعتی منتشر کنی</li>
        <li>• <b className="text-cream">ماندگاری</b> — چند نفر فردا برمی‌گردند</li>
        <li>• <b className="text-cream">پرتقاضاترین بازارها</b> — چه چیزی بیشتر بسازی</li>
      </ul>
    </div>
  );
}

/* ────────────────────────── نمودارها ───────────────────────── */

/** قیف: سه پله‌ی افقی با نرخ تبدیل بین هر دو پله. */
function FunnelChart({ f }: { f: Funnel }) {
  const steps = [
    { id: "list_view", label: "فهرست دیده شد" },
    { id: "market_open", label: "بازار باز شد" },
    { id: "predict", label: "پیش‌بینی ثبت شد" },
  ];
  const max = Math.max(1, ...steps.map((s) => f[s.id]?.n ?? 0));
  if (max <= 1 && steps.every((s) => !f[s.id]?.n)) {
    return <Empty text="هنوز رویدادی در این بازه نیست." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const n = f[s.id]?.n ?? 0;
        const prev = i > 0 ? (f[steps[i - 1].id]?.n ?? 0) : null;
        const conv = prev !== null ? pct(n, prev) : null;
        const w = Math.max(2, (n / max) * 100);
        return (
          <div key={s.id}>
            {conv !== null && (
              <div className="mb-1 flex items-center gap-1.5 ps-1 text-[10px] text-muted">
                <span aria-hidden>↓</span>
                <span className={conv >= 25 ? "text-gain" : "text-loss"}>
                  {fa(conv)}٪ ادامه دادند
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-28 shrink-0 text-[11px] text-muted">{s.label}</div>
              <div className="h-7 flex-1 overflow-hidden rounded-md bg-surface/40">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-gold/35 px-2"
                  style={{ width: `${w}%` }}
                >
                  <span className="font-mono text-[11px] font-bold text-cream" dir="ltr">
                    {n.toLocaleString("en-US")}
                  </span>
                </div>
              </div>
              <div className="w-16 shrink-0 text-end text-[10px] text-muted">
                {fa(f[s.id]?.people ?? 0)} نفر
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** تقاضای دسته‌ها: میله‌ی بازکردن + نرخ تبدیل کنارش. */
function CategoryChart({ rows }: { rows: CatRow[] }) {
  if (rows.length === 0) {
    return <Empty text="هنوز هیچ بازاری باز نشده تا تقاضایش سنجیده شود." />;
  }
  const max = Math.max(1, ...rows.map((r) => r.opens));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const conv = pct(r.predicts, r.opens);
        return (
          <div key={`${r.game}-${r.category}`} className="flex items-center gap-2">
            <div className="w-32 shrink-0 truncate text-[11px]">
              <span className="text-cream">{catLabel(r.category)}</span>{" "}
              <span className="text-[9px] text-muted">
                {GAME_LABEL[r.game] ?? r.game}
              </span>
            </div>
            <div className="h-5 flex-1 overflow-hidden rounded bg-surface/40">
              <div
                className="h-full rounded bg-gold/35"
                style={{ width: `${Math.max(2, (r.opens / max) * 100)}%` }}
              />
            </div>
            <div className="w-12 shrink-0 text-end font-mono text-[10.5px] text-muted" dir="ltr">
              {r.opens}
            </div>
            <div
              className={`w-14 shrink-0 text-end font-mono text-[10.5px] ${
                conv === null ? "text-muted" : conv >= 25 ? "text-gain" : "text-loss"
              }`}
              dir="ltr"
            >
              {conv === null ? "—" : `${conv}%`}
            </div>
          </div>
        );
      })}
      <p className="mt-1 text-[10px] text-muted">
        ستون آخر: نرخ تبدیلِ بازکردن به پیش‌بینی.
      </p>
    </div>
  );
}

/** فعالیت روزانه: سه خط روی یک محور. */
function DailyChart({ rows }: { rows: DayRow[] }) {
  if (rows.length < 2) {
    return <Empty text="برای رسم نمودار حداقل دو روز داده لازم است." />;
  }
  const W = 720;
  const H = 160;
  const pad = 12;
  const max = Math.max(
    1,
    ...rows.map((r) => Math.max(r.views, r.opens, r.predicts))
  );
  const path = (key: "views" | "opens" | "predicts") =>
    rows
      .map((r, i) => {
        const x = ((i + 0.5) / rows.length) * W;
        const y = pad + (1 - r[key] / max) * (H - pad * 2);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const lines = [
    { key: "views" as const, color: "var(--color-muted)", label: "فهرست" },
    { key: "opens" as const, color: "var(--color-gold)", label: "بازکردن" },
    { key: "predicts" as const, color: "var(--color-gain)", label: "پیش‌بینی" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[160px] w-full" preserveAspectRatio="none">
        {lines.map((l) => (
          <path key={l.key} d={path(l.key)} fill="none" stroke={l.color} strokeWidth="1.8" />
        ))}
      </svg>
      {/* ⚠️ dir="ltr" عمدی: محور SVG همیشه چپ‌به‌راست است (x=0 یعنی
          قدیمی‌ترین روز)، ولی این ردیف در RTL برعکس می‌چید و برچسبِ سمت
          چپ، جدیدترین روز را نشان می‌داد — یعنی خواننده نمودار را وارونه
          می‌فهمید. در مرورگر دیده شد، نه در کد. */}
      <div
        dir="ltr"
        className="mt-1 flex items-center justify-between text-[9px] text-muted"
      >
        <span>{faDay(rows[0].day)}</span>
        <span className="flex gap-3">
          {lines.map((l) => (
            <span key={l.key} style={{ color: l.color }}>
              ▬ {l.label}
            </span>
          ))}
        </span>
        <span>{faDay(rows[rows.length - 1].day)}</span>
      </div>
    </div>
  );
}

/** ساعت اوج: ۲۴ میله به وقت تهران. */
function HourChart({ rows }: { rows: { hour: number; n: number }[] }) {
  const byHour = new Array(24).fill(0);
  for (const r of rows) byHour[r.hour] = r.n;
  const max = Math.max(1, ...byHour);
  if (rows.length === 0) return <Empty text="هنوز رویدادی برای ساعت‌بندی نیست." />;
  const peak = byHour.indexOf(max);

  return (
    <div>
      {/* ⚠️ همان دلیل: بدون dir="ltr" میله‌ها از راست می‌چیدند (ساعت ۰ سمت
          راست) در حالی که محور زیرش ۰۰ را سمت چپ می‌نوشت. */}
      <div dir="ltr" className="flex h-24 items-end gap-[3px]">
        {byHour.map((n, h) => (
          <div key={h} className="group relative flex-1" title={`ساعت ${h}: ${n}`}>
            <div
              className={`w-full rounded-t ${h === peak ? "bg-gold/70" : "bg-gold/25"}`}
              style={{ height: `${Math.max(2, (n / max) * 90)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted" dir="ltr">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <p className="mt-1.5 text-[10px] text-gold">
        شلوغ‌ترین ساعت: {fa(peak)} تا {fa((peak + 1) % 24)} به وقت تهران
      </p>
    </div>
  );
}

function SurfaceTable({
  rows,
}: {
  rows: { surface: string; opens: number; predicts: number; people: number }[];
}) {
  if (rows.length === 0) return <Empty text="هنوز داده‌ای نیست." />;
  const label: Record<string, string> = { site: "سایت", app: "مینی‌اپ", bot: "ربات" };
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const conv = pct(r.predicts, r.opens);
        return (
          <div
            key={r.surface}
            className="flex items-center justify-between rounded-lg border border-line bg-surface/30 px-3 py-2.5"
          >
            <span className="text-[11.5px] font-bold text-cream">
              {label[r.surface] ?? r.surface}
            </span>
            <span className="flex items-center gap-4 font-mono text-[10.5px]" dir="ltr">
              <span className="text-muted">{r.people} ppl</span>
              <span className="text-gold">{r.opens} open</span>
              <span className={conv !== null && conv >= 25 ? "text-gain" : "text-muted"}>
                {conv === null ? "—" : `${conv}%`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RetentionTable({
  rows,
}: {
  rows: { day: string; cohort: number; d1: number; d7: number }[];
}) {
  if (rows.length === 0) {
    return <Empty text="ماندگاری وقتی معنا دارد که کاربر شناسایی‌شده داشته باشیم." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10.5px]">
        <thead className="text-muted">
          <tr>
            <th className="px-2 py-1.5 text-start font-bold">روز اول</th>
            <th className="px-2 py-1.5 text-end font-bold">نفر</th>
            <th className="px-2 py-1.5 text-end font-bold">روز بعد</th>
            <th className="px-2 py-1.5 text-end font-bold">هفته بعد</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(-10).map((r) => (
            <tr key={r.day} className="border-t border-line">
              <td className="px-2 py-1.5">{faDay(r.day)}</td>
              <td className="px-2 py-1.5 text-end font-mono" dir="ltr">
                {r.cohort}
              </td>
              <td className="px-2 py-1.5 text-end font-mono text-gain" dir="ltr">
                {pct(r.d1, r.cohort) ?? 0}%
              </td>
              <td className="px-2 py-1.5 text-end font-mono text-gold" dir="ltr">
                {pct(r.d7, r.cohort) ?? 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketsTable({ rows }: { rows: MarketRow[] }) {
  if (rows.length === 0) return <Empty text="هنوز هیچ بازاری باز نشده." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10.5px]">
        <thead className="text-muted">
          <tr>
            <th className="px-2 py-1.5 text-start font-bold">بازار</th>
            <th className="px-2 py-1.5 text-start font-bold">دسته</th>
            <th className="px-2 py-1.5 text-end font-bold">باز شد</th>
            <th className="px-2 py-1.5 text-end font-bold">پیش‌بینی</th>
            <th className="px-2 py-1.5 text-end font-bold">تبدیل</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = pct(r.predicts, r.opens);
            return (
              <tr key={`${r.game}-${r.marketId}`} className="border-t border-line">
                <td className="px-2 py-1.5 font-mono" dir="ltr">
                  {r.marketId}
                </td>
                <td className="px-2 py-1.5">
                  {r.category ? catLabel(r.category) : "—"}{" "}
                  <span className="text-[9px] text-muted">
                    {GAME_LABEL[r.game] ?? r.game}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-end font-mono text-gold" dir="ltr">
                  {r.opens}
                </td>
                <td className="px-2 py-1.5 text-end font-mono" dir="ltr">
                  {r.predicts}
                </td>
                <td
                  className={`px-2 py-1.5 text-end font-mono ${
                    conv !== null && conv >= 25 ? "text-gain" : "text-muted"
                  }`}
                  dir="ltr"
                >
                  {conv === null ? "—" : `${conv}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
