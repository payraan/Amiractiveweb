import { createHash } from "crypto";
import { db } from "@/lib/db";

// ═══ فارسی‌سازی عنوان بازارهای خارجی ═════════════════════════
//
// بازارهای پالی‌مارکت انگلیسی‌اند و مخاطب ما فارسی‌زبان است.
//
// ── چرا ترجمه‌ی یک‌باره و ذخیره‌شده، نه ترجمه‌ی زنده ──
// عنوان‌ها مجموعه‌ای کوچک و کندتغییرند: چند ده عنوان تازه در روز. اگر هر
// بار نمایش، ترجمه صدا زده شود، هم سقف رایگان در چند دقیقه تمام می‌شود، هم
// هر بارگذاری صفحه منتظر یک درخواست شبکه می‌ماند، و هم یک عنوان ممکن است
// هر بار کمی متفاوت ترجمه شود. یک بار ترجمه و ذخیره، هر سه را حل می‌کند.
//
// ── چرا کلید، اثرانگشتِ متن است نه شناسه‌ی بازار ──
// پالی‌مارکت گاهی همان پرسش را با شناسه‌ی تازه برمی‌گرداند. با کلیدِ متنی،
// آن ترجمه دوباره خرج ندارد؛ با شناسه، هر بار از نو ترجمه می‌شد.
//
// ⚠️ **بدون کلید هیچ‌چیز نمی‌شکند.** ترجمه‌ی نداشته یعنی عنوان انگلیسی
// نمایش داده می‌شود — یک بازار بی‌عنوان از یک بازار انگلیسی بدتر است.

const KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

export function translatorReady(): boolean {
  return Boolean(KEY);
}

/** اثرانگشت متن مبدأ — کلید جدول. */
export function textKey(en: string): string {
  return createHash("sha256").update(en.trim()).digest("hex").slice(0, 32);
}

let ready: Promise<void> | null = null;

export async function ensureTranslationTable(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS translations (
           hash       TEXT PRIMARY KEY,
           en         TEXT NOT NULL,
           fa         TEXT,
           edited     BOOLEAN NOT NULL DEFAULT false,
           failures   INTEGER NOT NULL DEFAULT 0,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS translations_pending
           ON translations (created_at) WHERE fa IS NULL`
      );
    });
  }
  return ready;
}

/**
 * ترجمه‌های موجود برای این متن‌ها، و ثبت آن‌هایی که ندارند.
 *
 * ثبت‌کردنِ نداشته‌ها همین‌جا انجام می‌شود تا صف خودش از مسیر عادی نمایش
 * پر شود؛ هیچ‌جا لازم نیست کسی یادش باشد بازار تازه را برای ترجمه معرفی کند.
 */
export async function translationsFor(
  texts: string[]
): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
  if (!uniq.length) return new Map();

  await ensureTranslationTable();
  const pool = await db();
  const hashes = uniq.map(textKey);

  const r = await pool.query<{ en: string; fa: string | null }>(
    "SELECT en, fa FROM translations WHERE hash = ANY($1)",
    [hashes]
  );
  const out = new Map<string, string>();
  const known = new Set<string>();
  for (const row of r.rows) {
    known.add(row.en);
    if (row.fa) out.set(row.en, row.fa);
  }

  const missing = uniq.filter((t) => !known.has(t));
  if (missing.length) {
    // ثبت در صف — بدون ترجمه. خودِ ترجمه کار کرون است، تا این درخواست
    // منتظر شبکه نماند.
    await pool.query(
      `INSERT INTO translations (hash, en)
       SELECT * FROM UNNEST($1::text[], $2::text[])
       ON CONFLICT (hash) DO NOTHING`,
      [missing.map(textKey), missing]
    );
  }
  return out;
}

/**
 * دستور ترجمه.
 *
 * پرسش‌های بازار پیش‌بینی الگوی ثابتی دارند و همین‌جا گفته می‌شود، وگرنه
 * مدل جمله‌ی خبری تحویل می‌دهد. اسم‌های خاص عمدا لاتین می‌مانند: «جرج
 * راسل» برای کاربری که دنبال George Russell است بدتر از خودِ اسم است.
 */
const PROMPT = `تو یک مترجم حرفه‌ای فارسی هستی. عنوان بازارهای پیش‌بینی را از انگلیسی به فارسی روان و طبیعی ترجمه کن.

قواعد:
- ساختار پرسشی را حفظ کن؛ خروجی باید یک پرسش باشد، نه جمله‌ی خبری.
- اسم افراد، تیم‌ها، شرکت‌ها، ارزها و رویدادهای شناخته‌شده را به لاتین دست‌نخورده بگذار (مثل George Russell، Bitcoin، F1، NBA).
- عدد، تاریخ و واحد را دقیق نگه دار.
- کوتاه و بدون توضیح اضافه. لحن رسمی.
- هرگز کلمه‌های «شرط»، «شرط‌بندی» و «برد و باخت» را به کار نبر؛ به‌جایش «پیش‌بینی».

ورودی یک آرایه‌ی JSON از رشته‌هاست. خروجی **فقط** یک آرایه‌ی JSON از رشته‌های فارسی، دقیقا به همان تعداد و ترتیب. هیچ متن دیگری ننویس.`;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

/** یک دسته را به Gemini می‌دهد. `null` یعنی این دسته ترجمه نشد. */
async function callGemini(texts: string[]): Promise<string[] | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT }] },
          contents: [{ parts: [{ text: JSON.stringify(texts) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      }
    );
    const j = (await res.json()) as GeminiResponse;
    const raw = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== texts.length) return null;
    if (!parsed.every((x) => typeof x === "string" && x.trim())) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/**
 * چند عنوان در هر تماس.
 *
 * ⚠️ این عدد و تعداد دسته‌ها با هم، سرعت پرشدن صف را تعیین می‌کنند و
 * نسخه‌ی اول خیلی محتاط بود: ۲۰×۲ در هر ۱۵ دقیقه یعنی ۳۵۲ بازار (حدود
 * ۷۰۰ عنوان با احتساب نام رویداد) بیش از چهار ساعت طول می‌کشید.
 *
 * حسابش ساده است: کل عقب‌ماندگی حدود ۲۰ درخواست است، نه ۲۰ درخواست در
 * روز. سقف رایگان روزانه صدها درخواست است، پس محدودکننده هرگز سقف نبود —
 * فقط احتیاط بی‌جای من بود.
 */
const BATCH = 40;

export type TranslateResult = { translated: number; failed: number; pending: number };

/**
 * صف ترجمه را جلو می‌برد. از کرون صدا زده می‌شود.
 *
 * ⚠️ ردیف‌های ویرایش‌شده‌ی دستی هرگز دوباره ترجمه نمی‌شوند — کلید `edited`
 * برای همین است. بدون آن، اولین اجرای کرون اصلاح دستی مالک را پاک می‌کرد.
 */
export async function translatePending(maxBatches = 12): Promise<TranslateResult> {
  await ensureTranslationTable();
  const pool = await db();

  const pendingCount = async () => {
    const r = await pool.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM translations WHERE fa IS NULL AND failures < 3"
    );
    return Number(r.rows[0]?.n ?? 0);
  };

  if (!KEY) return { translated: 0, failed: 0, pending: await pendingCount() };

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < maxBatches; i++) {
    // failures < 3 یعنی عنوانی که مدل مدام رویش می‌شکند، صف را برای همیشه
    // اشغال نمی‌کند و بقیه پشتش نمی‌مانند.
    const batch = await pool.query<{ hash: string; en: string }>(
      `SELECT hash, en FROM translations
        WHERE fa IS NULL AND failures < 3
        ORDER BY created_at LIMIT $1`,
      [BATCH]
    );
    if (!batch.rowCount) break;

    const rows = batch.rows;
    const out = await callGemini(rows.map((r) => r.en));

    if (!out) {
      failed += rows.length;
      await pool.query(
        "UPDATE translations SET failures = failures + 1, updated_at = now() WHERE hash = ANY($1)",
        [rows.map((r) => r.hash)]
      );
      break; // دسته شکست خورد؛ دسته‌ی بعدی هم احتمالا می‌شکند.
    }

    await pool.query(
      `UPDATE translations AS t SET fa = v.fa, updated_at = now()
         FROM (SELECT * FROM UNNEST($1::text[], $2::text[]) AS x(hash, fa)) AS v
        WHERE t.hash = v.hash AND t.edited = false`,
      [rows.map((r) => r.hash), out.map((s) => s.trim())]
    );
    translated += rows.length;
  }

  return { translated, failed, pending: await pendingCount() };
}
