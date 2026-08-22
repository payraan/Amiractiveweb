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
      // زمینه‌ی عنوان (معمولا عنوان رویداد پالی‌مارکت). بدون آن، پرسشی
      // مثل «Game 3: Ends in a day?» حتی به انگلیسی هم مبهم است و مدل
      // ناچار تحت‌اللفظی ترجمه می‌کند.
      await pool.query(
        "ALTER TABLE translations ADD COLUMN IF NOT EXISTS context TEXT"
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
  texts: string[],
  /**
   * زمینه‌ی هر عنوان — معمولا عنوان رویداد پالی‌مارکت.
   *
   * ⚠️ فقط به **مدل** داده می‌شود تا موضوع را بفهمد، و عمدا وارد کلید کش
   * نمی‌شود. اگر وارد کلید می‌شد، هر بار که همان پرسش در رویداد دیگری
   * تکرار شود دوباره ترجمه می‌شد — و مهم‌تر، پرامپت صریحا می‌گوید نام
   * رویداد را در خروجی نیاورد، پس ترجمه بین رویدادها قابل استفاده است.
   */
  hints?: Map<string, string>
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
      `INSERT INTO translations (hash, en, context)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
       ON CONFLICT (hash) DO NOTHING`,
      [
        missing.map(textKey),
        missing,
        missing.map((t) => hints?.get(t) ?? null),
      ]
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
- **تحت‌اللفظی ترجمه نکن.** معنا را برسان، نه کلمه را. خروجی باید برای کسی که اصل انگلیسی را ندیده کاملا روشن باشد.
  ✗ "Ends in a day?" → «آیا در روز به پایان می‌رسد؟»  (بی‌معنا)
  ✓ "Ends in a day?" → «آیا ظرف یک روز تمام می‌شود؟»
  ✗ "Any player Quadra Kill?" → «آیا هیچ بازیکنی رمپیج کسب می‌کند؟» (اصطلاح عوض شده)
  ✓ "Any player Quadra Kill?" → «آیا بازیکنی Quadra Kill می‌زند؟»
- اگر پرسش کوتاه و مبهم است (مثل "Game 3: Ends in a day?")، آن را به یک جمله‌ی **خودبسنده‌ی فارسی** تبدیل کن که بدون دانستن بستر هم فهمیده شود — ولی **نام تیم یا رویداد اضافه نکن**.
- اسم افراد، تیم‌ها، شرکت‌ها، ارزها، رویدادها و اصطلاح‌های تخصصی بازی را به لاتین دست‌نخورده بگذار (مثل George Russell، Bitcoin، F1، NBA، Quadra Kill).
- عدد، تاریخ و واحد را دقیق نگه دار. شماره‌ی بازی/راند را با حرف فارسی بنویس («بازی سوم» نه «بازی ۳»).
- کوتاه و بدون توضیح اضافه. لحن رسمی.
- هرگز کلمه‌های «شرط»، «شرط‌بندی» و «برد و باخت» را به کار نبر؛ به‌جایش «پیش‌بینی».

اگر برای یک عنوان، زمینه‌ای داخل [] داده شد، فقط برای **فهمیدن** موضوع از آن استفاده کن و **هرگز** آن را در خروجی نیاور.

ورودی یک آرایه‌ی JSON از رشته‌هاست. خروجی **فقط** یک آرایه‌ی JSON از رشته‌های فارسی، دقیقا به همان تعداد و ترتیب. هیچ متن دیگری ننویس.`;

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    /** مثلا MAX_TOKENS یا SAFETY — دلیل خالی‌بودن پاسخ. */
    finishReason?: string;
  }[];
  error?: { message?: string };
};

/**
 * آخرین خطای واقعی — برای نمایش در پنل ادمین.
 *
 * ⚠️ نسخه‌ی اول همه‌ی خطاها را می‌بلعید و فقط `null` می‌داد. نتیجه‌اش این
 * شد که «۴۰ ناموفق» دیده می‌شد و هیچ‌کس نمی‌دانست چرا: کلید غلط؟ مدل
 * ناموجود؟ سهمیه تمام؟ خطای شبکه؟ یک شمارنده‌ی بی‌توضیح، عیب‌یابی را
 * غیرممکن می‌کند.
 */
let lastError: string | null = null;
export function lastTranslateError(): string | null {
  return lastError;
}

/** مدلی که واقعا کار کرد — تا هر بار دوباره کشف نشود. */
let workingModel: string | null = null;

type ModelList = { models?: { name?: string; supportedGenerationMethods?: string[] }[] };

/**
 * وقتی مدلِ پیکربندی‌شده وجود ندارد، از خود گوگل می‌پرسیم چه چیزی هست.
 *
 * نام مدل‌های Gemini مرتبا عوض و بازنشسته می‌شوند، و یک نام کهنه در کد
 * یعنی قابلیتی که یک روز بی‌صدا می‌میرد. این کار یک بار انجام و کش می‌شود.
 */
async function discoverModel(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      { headers: { "x-goog-api-key": KEY }, cache: "no-store", signal: AbortSignal.timeout(20_000) }
    );
    const j = (await res.json()) as ModelList;
    const usable = (j.models ?? []).filter((m) =>
      m.supportedGenerationMethods?.includes("generateContent")
    );
    // سریع‌ترین و ارزان‌ترین خانواده اول؛ اگر نبود، هر چه هست.
    const pick =
      usable.find((m) => m.name?.includes("flash-lite")) ??
      usable.find((m) => m.name?.includes("flash")) ??
      usable[0];
    return pick?.name?.replace(/^models\//, "") ?? null;
  } catch {
    return null;
  }
}

async function rawCall(model: string, texts: string[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(texts) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    }
  );
  const j = (await res.json()) as GeminiResponse;
  return { status: res.status, body: j };
}

/** یک دسته را به Gemini می‌دهد. `null` یعنی این دسته ترجمه نشد. */
async function callGemini(texts: string[]): Promise<string[] | null> {
  if (!KEY) {
    lastError = "کلید API ست نشده است.";
    return null;
  }

  try {
    let model = workingModel ?? MODEL;
    let { status, body } = await rawCall(model, texts);

    // مدل ناشناخته → یک بار کشف و تلاش دوباره.
    if (status === 404 || /not found|not supported/i.test(body.error?.message ?? "")) {
      const found = await discoverModel();
      if (found && found !== model) {
        model = found;
        ({ status, body } = await rawCall(model, texts));
      }
    }

    if (body.error?.message) {
      lastError = `${status}: ${body.error.message.slice(0, 300)}`;
      return null;
    }
    if (status !== 200) {
      lastError = `HTTP ${status}`;
      return null;
    }

    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      const reason = body.candidates?.[0]?.finishReason;
      lastError = `پاسخ خالی${reason ? ` (finishReason=${reason})` : ""}`;
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastError = `خروجی JSON نبود: ${raw.slice(0, 120)}`;
      return null;
    }
    if (!Array.isArray(parsed)) {
      lastError = "خروجی آرایه نبود.";
      return null;
    }
    if (parsed.length !== texts.length) {
      lastError = `تعداد نخواند: ${texts.length} فرستادیم، ${parsed.length} برگشت.`;
      return null;
    }
    if (!parsed.every((x) => typeof x === "string" && x.trim())) {
      lastError = "بعضی خروجی‌ها رشته‌ی معتبر نبودند.";
      return null;
    }

    workingModel = model;
    lastError = null;
    return parsed as string[];
  } catch (e) {
    lastError = e instanceof Error ? e.message.slice(0, 300) : "خطای شبکه";
    return null;
  }
}

/** مدلی که آخرین بار جواب داد — برای نمایش در پنل. */
export function activeModel(): string {
  return workingModel ?? MODEL;
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

export type TranslateResult = {
  translated: number;
  failed: number;
  pending: number;
  /** خطای واقعی آخرین تلاش — `null` یعنی مشکلی نبود. */
  error: string | null;
  model: string;
};

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

  if (!KEY) {
    return {
      translated: 0,
      failed: 0,
      pending: await pendingCount(),
      error: "کلید API ست نشده است.",
      model: MODEL,
    };
  }

  lastError = null;

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < maxBatches; i++) {
    // failures < 3 یعنی عنوانی که مدل مدام رویش می‌شکند، صف را برای همیشه
    // اشغال نمی‌کند و بقیه پشتش نمی‌مانند.
    const batch = await pool.query<{
      hash: string;
      en: string;
      context: string | null;
    }>(
      `SELECT hash, en, context FROM translations
        WHERE fa IS NULL AND failures < 3
        ORDER BY created_at LIMIT $1`,
      [BATCH]
    );
    if (!batch.rowCount) break;

    const rows = batch.rows;
    // ⚠️ زمینه داخل [] می‌رود و پرامپت صریحا می‌گوید فقط برای فهمیدن از آن
    // استفاده کن و در خروجی نیاور — وگرنه ترجمه‌ی «بازی سوم» به نام یک
    // رویداد مشخص چسبیده می‌شد و در رویداد بعدی غلط از آب درمی‌آمد.
    const out = await callGemini(
      rows.map((r) => (r.context ? `${r.en} [${r.context}]` : r.en))
    );

    if (!out) {
      failed += rows.length;
      await pool.query(
        "UPDATE translations SET failures = failures + 1, updated_at = now() WHERE hash = ANY($1)",
        [rows.map((r) => r.hash)]
      );
      break; // دسته شکست خورد؛ دسته‌ی بعدی هم احتمالا می‌شکند.
    }

    // شمارنده‌ی شکست هم صفر می‌شود: ردیفی که حالا ترجمه دارد، «۱ بار شکست»
    // نباید نشان بدهد. تاریخچه‌ی تلاش‌های قبلی بعد از موفقیت فقط گمراه‌کننده
    // است — به نظر می‌رسد چیزی خراب است در حالی که نیست.
    await pool.query(
      `UPDATE translations AS t SET fa = v.fa, failures = 0, updated_at = now()
         FROM (SELECT * FROM UNNEST($1::text[], $2::text[]) AS x(hash, fa)) AS v
        WHERE t.hash = v.hash AND t.edited = false`,
      [rows.map((r) => r.hash), out.map((s) => s.trim())]
    );
    translated += rows.length;
  }

  return {
    translated,
    failed,
    pending: await pendingCount(),
    error: lastError,
    model: activeModel(),
  };
}

/**
 * شمارنده‌ی شکست همه‌ی ردیف‌ها را صفر می‌کند.
 *
 * لازم است چون علت شکست معمولا یک چیزِ مشترک است (کلید، نام مدل). وقتی آن
 * درست شد، ردیف‌هایی که سه بار شکسته‌اند نباید برای همیشه سوخته بمانند.
 */
export async function resetFailures(): Promise<number> {
  await ensureTranslationTable();
  const pool = await db();
  // شرط `fa IS NULL` عمدا برداشته شد: ردیف‌هایی که پیش از رفعِ علت شکست
  // خورده و بعد موفق شده‌اند، شمارنده‌ی کهنه‌شان را نگه داشته بودند و در
  // پنل «۱ بار شکست» نشان می‌دادند در حالی که ترجمه‌شان سالم بود.
  const r = await pool.query("UPDATE translations SET failures=0 WHERE failures > 0");
  return r.rowCount ?? 0;
}
