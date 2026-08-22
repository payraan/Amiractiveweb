import { db } from "@/lib/db";
import { findMarket, getCuratedMarkets, type PolyMarket } from "@/lib/poly";
import { displayTitle } from "@/lib/search";
import { translationsFor } from "@/lib/translate";
import {
  DEAD_POST_RE,
  editMarketPoll,
  sendMarketPoll,
  type MarketPollInput,
  type PollMode,
} from "@/lib/telegram";

// کارت‌های منتشرشده‌ی بازارهای ترید (پالی‌مارکت) در کانال‌ها.
//
// ── چرا جدول جدا از ir_market_posts ──
// آن جدول `market_id INTEGER REFERENCES ir_markets(id) ON DELETE CASCADE`
// دارد. شناسه‌ی پالی‌مارکت رشته است، پس جا دادنش یعنی برداشتن آن کلید خارجی
// — و با رفتنِ کلید، پاک‌سازی خودکار کارت‌های بازار حذف‌شده‌ی ایران هم می‌رود.
// یک ستون `kind` هزینه‌اش بیشتر از یک جدول دوم بود.
//
// ── چرا حلقه‌ی به‌روزرسانی هم جداست ──
// بازار ایران از دیتابیس خودمان می‌آید و با JOIN تازه می‌شود؛ ترید از کش
// پالی‌مارکت. حالت «بازار دیگر وجود ندارد» هم در دو طرف معنی متفاوتی دارد
// (پایین را ببین).

let ready: Promise<void> | null = null;

export async function ensureTradePostTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS tg_trade_posts (
           id BIGSERIAL PRIMARY KEY,
           market_id TEXT NOT NULL,
           chat_id TEXT NOT NULL,
           message_id BIGINT NOT NULL,
           last_yes_pct NUMERIC(5,1),
           misses INTEGER NOT NULL DEFAULT 0,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           UNIQUE (chat_id, message_id)
         )`
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ttp_market_idx ON tg_trade_posts(market_id)"
      );
    });
  }
  return ready;
}

/**
 * شکل مجاز شناسه برای لینک عمیق.
 *
 * تلگرام در `startapp` فقط A-Z a-z 0-9 و _ و - را می‌پذیرد، و خودِ گرامر ما
 * (`trade_<id>_yes`) روی `_` تکیه دارد، پس `_` هم بیرون است. شناسه‌های
 * پالی‌مارکت امروز عددی‌اند و همه از این چک رد می‌شوند؛ این چک برای روزی است
 * که نباشند — آن روز باید صریح خطا بدهیم، نه اینکه کارتی با دکمه‌ی خرابِ
 * بی‌صدا منتشر شود.
 */
const SAFE_ID = /^[A-Za-z0-9-]{1,48}$/;

export function tradeIdSafe(id: string): boolean {
  return SAFE_ID.test(id);
}

/**
 * تبدیل بازارهای پالی‌مارکت به ورودی کارت، با عنوان فارسی.
 *
 * دسته‌ای است نه تکی، چون حلقه‌ی به‌روزرسانی ممکن است ده‌ها کارت داشته باشد و
 * یک کوئری ترجمه بهتر از ده‌ها کوئری است.
 *
 * ⚠️ اگر ترجمه نبود، `displayTitle` عنوان انگلیسی را برمی‌گرداند. کارت
 * انگلیسی از کارتِ بی‌عنوان بهتر است.
 */
export async function tradePollInputs(
  markets: PolyMarket[]
): Promise<Map<string, MarketPollInput>> {
  let fa = new Map<string, string>();
  try {
    const hints = new Map<string, string>();
    for (const m of markets) {
      if (m.eventTitle && m.eventTitle !== m.question) {
        hints.set(m.question, m.eventTitle);
      }
    }
    fa = await translationsFor(
      markets.map((m) => m.question),
      hints
    );
  } catch {
    /* بدون ترجمه ادامه می‌دهیم — همان تصمیمی که poly-markets می‌گیرد */
  }

  const out = new Map<string, MarketPollInput>();
  for (const m of markets) {
    out.set(m.id, {
      kind: "trade",
      id: m.id,
      question: displayTitle(m.question, fa.get(m.question.trim())),
      category: m.category,
      yesPct: m.yesPct,
      volume: m.volume,
      closesAt: m.endDate,
    });
  }
  return out;
}

/** ورودی کارت برای یک بازار ترید. `null` یعنی بازار در فهرست نیست. */
export async function tradePollInput(
  marketId: string
): Promise<MarketPollInput | null> {
  const m = findMarket(await getCuratedMarkets(), marketId);
  if (!m) return null;
  return (await tradePollInputs([m])).get(m.id) ?? null;
}

export async function recordTradePost(
  marketId: string,
  chatId: string,
  messageId: number,
  yesPct: number
): Promise<void> {
  await ensureTradePostTables();
  const pool = await db();
  await pool.query(
    `INSERT INTO tg_trade_posts (market_id, chat_id, message_id, last_yes_pct)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (chat_id, message_id) DO NOTHING`,
    [marketId, chatId, messageId, yesPct]
  );
}

/** انتشار یک بازار ترید در کانال و ثبتش برای به‌روزرسانی بعدی. */
export async function postTradeMarket(
  marketId: string,
  chatId: string,
  mode: PollMode
): Promise<{ ok: boolean; error?: string }> {
  if (!tradeIdSafe(marketId)) return { ok: false, error: "bad_market_id" };

  const input = await tradePollInput(marketId);
  if (!input) return { ok: false, error: "not_found" };

  const sent = await sendMarketPoll(chatId, input, mode);
  if (!sent.ok || !sent.messageId) {
    return { ok: false, error: sent.error ?? "send_failed" };
  }

  // فقط کارت زنده ثبت می‌شود — نسخه‌ی فوروارد‌شده قابل ویرایش نیست.
  if (mode === "live") {
    await recordTradePost(marketId, chatId, sent.messageId, input.yesPct);
  }
  return { ok: true };
}

/**
 * چند بار پشت سر هم «بازار پیدا نشد» تا ردیف پاک شود.
 *
 * فهرست منتخب سقف ۴۰۰ تایی دارد و بر اساس حجم مرتب است، پس یک بازارِ کاملا
 * زنده هم می‌تواند یک دور از فهرست بیفتد و دور بعد برگردد. پاک‌کردن در همان
 * اولین غیبت یعنی کارتی که هنوز باز است دیگر هرگز به‌روز نمی‌شود. از طرف
 * دیگر ردیفی که هرگز پاک نشود، هر ۱۵ دقیقه تا ابد تلاش بیهوده می‌سازد.
 * شمارنده هر دو را حل می‌کند: ۱۰ غیبت پشت‌سرهم ≈ ۲.۵ ساعت.
 */
const MAX_MISSES = 10;

/**
 * به‌روزرسانی کارت‌های زنده‌ی ترید.
 *
 * مثل بازار ایران فقط وقتی ویرایش می‌شود که درصد عوض شده باشد؛ تلگرام
 * ویرایشِ بی‌تغییر را با خطا رد می‌کند و سقف نرخ هم دارد.
 */
export async function refreshTradePosts(): Promise<{
  checked: number;
  edited: number;
}> {
  await ensureTradePostTables();
  const pool = await db();

  const { rows } = await pool.query<{
    id: string;
    market_id: string;
    chat_id: string;
    message_id: string;
    last_yes_pct: string | null;
  }>(
    `SELECT id, market_id, chat_id, message_id, last_yes_pct
       FROM tg_trade_posts ORDER BY id DESC LIMIT 200`
  );
  if (!rows.length) return { checked: 0, edited: 0 };

  // یک بار برای همه: هم واکشی بازارها، هم ترجمه‌ها.
  const wanted = new Set(rows.map((r) => r.market_id));
  const all = await getCuratedMarkets();
  const inputs = await tradePollInputs(all.filter((m) => wanted.has(m.id)));

  let edited = 0;
  for (const r of rows) {
    const input = inputs.get(r.market_id);
    if (!input) {
      const miss = await pool.query<{ misses: number }>(
        "UPDATE tg_trade_posts SET misses = misses + 1 WHERE id=$1 RETURNING misses",
        [r.id]
      );
      if ((miss.rows[0]?.misses ?? 0) >= MAX_MISSES) {
        await pool.query("DELETE FROM tg_trade_posts WHERE id=$1", [r.id]);
      }
      continue;
    }

    if (r.last_yes_pct !== null && Number(r.last_yes_pct) === input.yesPct) {
      // بازار هست ولی عددش عوض نشده — غیبت‌های قبلی بی‌اثر می‌شوند، وگرنه
      // یک بازار کم‌نوسان به‌مرور شمارنده‌اش پر می‌شد و پاک می‌شد.
      await pool.query("UPDATE tg_trade_posts SET misses=0 WHERE id=$1", [r.id]);
      continue;
    }

    const res = await editMarketPoll(r.chat_id, Number(r.message_id), input, "live");
    if (res.ok) {
      await pool.query(
        "UPDATE tg_trade_posts SET last_yes_pct=$2, misses=0 WHERE id=$1",
        [r.id, input.yesPct]
      );
      edited++;
    } else if (DEAD_POST_RE.test(res.error ?? "")) {
      await pool.query("DELETE FROM tg_trade_posts WHERE id=$1", [r.id]);
    }
  }

  return { checked: rows.length, edited };
}
