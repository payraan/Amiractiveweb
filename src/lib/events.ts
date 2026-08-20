import { db } from "@/lib/db";
import { log } from "@/lib/log";

// ثبت رفتار کاربر — پایه‌ی همه‌ی تحلیل‌های پنل مدیریت.
//
// ── چرا این جدول لازم است ──
// دیتابیس تا امروز فقط **نتیجه** را نگه می‌داشت: شرط، پیش‌بینی، تسویه. ولی
// «کدام بازار تقاضا دارد» از روی نتیجه قابل محاسبه نیست — دسته‌ای با ۲ بازار
// و ۱۰ پیش‌بینی بهتر است یا دسته‌ای با ۲۰ بازار و ۳۰ پیش‌بینی؟ بدون شمارِ
// دیده‌شدن، جواب ندارد.
//
// و رویدادی که ثبت نشود برای همیشه رفته؛ بازسازی‌اش ممکن نیست. پس این جدول
// باید **پیش از آمدن کاربر واقعی** سر جایش باشد.
//
// ── چه چیزی ثبت می‌شود و چه چیزی نه ──
// عمدا هیچ رویدادی به‌ازای «هر کارت بازار در فهرست» ثبت نمی‌شود. یک صفحه‌ی
// فهرست سی کارت دارد؛ در مقیاس ۵۰ هزار کاربر آن یعنی میلیون‌ها ردیف بی‌مصرف
// در روز. به‌جایش سه پله‌ی معنادار ثبت می‌شود:
//
//   list_view    → یک بار به‌ازای باز شدن فهرست (نه به‌ازای هر کارت)
//   market_open  → کاربر یک بازار مشخص را باز کرد  ← سیگنالِ تقاضا
//   predict      → پیش‌بینی ثبت شد                 ← سیگنالِ تبدیل
//
// نرخ تبدیل `predict / market_open` همان عددی است که می‌گوید کدام دسته
// واقعا تقاضا دارد، و `market_open` به‌ازای هر بازار می‌گوید کدام سؤال
// جذب می‌کند.
//
// ماندگاری (retention) از همین جدول درمی‌آید و ستون جدا نمی‌خواهد: هر
// رویدادِ دارای `player_id` یعنی آن کاربر آن روز فعال بوده.

export type EventKind =
  | "list_view"
  | "market_open"
  | "predict"
  | "share"
  | "result_view";

/** کدام سطح — برای اینکه بفهمیم مینی‌اپ می‌گیرد یا سایت. */
export type Surface = "site" | "app" | "bot";

/** کدام بازی — بازار ایران، ترید (پالی‌مارکت)، نبض بازار، کمبو. */
export type Game = "iran" | "trade" | "pulse" | "combo";

export type AppEvent = {
  playerId?: number | null;
  kind: EventKind;
  surface: Surface;
  game?: Game | null;
  /**
   * شناسه‌ی بازار — عمدا رشته است.
   *
   * بازار ایران شناسه‌ی عددی دارد و بازار ترید شناسه‌ی رشته‌ای پالی‌مارکت.
   * یک ستون برای هر دو، وگرنه هر تحلیلی باید دو بار نوشته شود.
   */
  marketId?: string | number | null;
  /**
   * دسته — عمدا اینجا کپی می‌شود و با join گرفته نمی‌شود.
   *
   * دو دلیل: بازارهای ترید اصلا در `ir_markets` نیستند پس join‌ای وجود
   * ندارد؛ و دسته‌ی یک بازار ممکن است بعدا عوض شود، در حالی که تحلیل باید
   * بگوید کاربر **در آن لحظه** چه دیده است.
   */
  category?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any> | null;
};

let ready: Promise<void> | null = null;

export async function ensureEventsTable(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS app_events (
           id         BIGSERIAL PRIMARY KEY,
           player_id  INTEGER REFERENCES players(id) ON DELETE SET NULL,
           kind       TEXT NOT NULL,
           surface    TEXT NOT NULL,
           game       TEXT,
           market_id  TEXT,
           category   TEXT,
           meta       JSONB,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      // ── ایندکس‌ها ──
      // عمدا کم: هر ایندکس، نوشتن را کند می‌کند و این جدول پرنوشته‌ترین
      // جدول پلتفرم خواهد بود. این سه، هر چهار تحلیل اصلی را پوشش می‌دهند.
      await pool.query(
        // سری زمانی و قیف
        `CREATE INDEX IF NOT EXISTS app_events_kind_time
           ON app_events (kind, created_at DESC)`
      );
      await pool.query(
        // تقاضای دسته‌ها و عملکرد تک‌تک بازارها
        `CREATE INDEX IF NOT EXISTS app_events_game_cat
           ON app_events (game, category, created_at DESC)`
      );
      await pool.query(
        // ماندگاری و کارنامه‌ی رفتاری یک کاربر
        `CREATE INDEX IF NOT EXISTS app_events_player_time
           ON app_events (player_id, created_at DESC)
         WHERE player_id IS NOT NULL`
      );
    });
  }
  return ready;
}

/**
 * ثبت یک رویداد — بی‌صدا، و **هرگز مسیر اصلی را نمی‌کشد**.
 *
 * ⚠️ عمدا `await` روی مسیر اصلی لازم ندارد و عمدا **داخل ترنزاکشن فراخوان
 * نمی‌رود**. اگر داخل ترنزاکشن می‌رفت، یک خطای ساده‌ی درج (مثلا جدولِ
 * هنوز ساخته‌نشده) کل ترنزاکشن را باطل می‌کرد و یک شرطِ پولِ واقعی به‌خاطر
 * یک ردیف آمار برمی‌گشت. `try/catch` هم اینجا کافی نبود — Postgres پس از
 * خطا کل ترنزاکشن را باطل می‌کند و فقط `SAVEPOINT` نجاتش می‌دهد. ساده‌ترین
 * راهِ درست: اصلا وارد آن ترنزاکشن نشو.
 *
 * خطا بلعیده می‌شود ولی **لاگ می‌شود** — شمارنده‌ی بی‌علت از خودِ مشکل
 * بدتر است.
 */
export function logEvent(e: AppEvent): void {
  void (async () => {
    try {
      await ensureEventsTable();
      const pool = await db();
      await pool.query(
        `INSERT INTO app_events (player_id, kind, surface, game, market_id, category, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          e.playerId ?? null,
          e.kind,
          e.surface,
          e.game ?? null,
          e.marketId === null || e.marketId === undefined
            ? null
            : String(e.marketId),
          e.category ?? null,
          e.meta ? JSON.stringify(e.meta) : null,
        ]
      );
    } catch (err) {
      log.warn("events.write_failed", {
        kind: e.kind,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

const KINDS: readonly EventKind[] = [
  "list_view",
  "market_open",
  "predict",
  "share",
  "result_view",
];
const SURFACES: readonly Surface[] = ["site", "app", "bot"];
const GAMES: readonly Game[] = ["iran", "trade", "pulse", "combo"];

export const isEventKind = (v: unknown): v is EventKind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);
export const isSurface = (v: unknown): v is Surface =>
  typeof v === "string" && (SURFACES as readonly string[]).includes(v);
export const isGame = (v: unknown): v is Game =>
  typeof v === "string" && (GAMES as readonly string[]).includes(v);
