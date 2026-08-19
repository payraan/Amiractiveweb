import { log } from "@/lib/log";
import { db } from "@/lib/db";
import { tgCall } from "@/lib/telegram";

// ── کانال‌های ثبت‌شده‌ی سازندگان ─────────────────────────────
//
// ── چرا این ماژول وجود دارد ──
// موتور رشد پلتفرم، ادمین‌های کانال و گروه‌اند: کسی که چند هزار عضو دارد و
// می‌تواند بازار بسازد و همان‌جا منتشرش کند. کارمزد ۱ دلاری ساخت بازار
// برای کاربر معمولی یک ابزار ضد اسپم است، ولی برای ادمینی که روزی چند
// بازار می‌سازد یک مالیات بر تولید محتواست — دقیقا روی کسی که بیشترین
// ارزش را می‌آورد.
//
// پس: ادمین کانالش را ثبت می‌کند، گرداننده تأیید می‌کند، و از آن پس بازار
// ساختنش رایگان است.
//
// ── سه اثباتی که پیش از ثبت گرفته می‌شود ──
// هیچ‌کدام حرفِ خودِ کاربر نیست؛ هر سه را از تلگرام می‌پرسیم:
//   ۱. کانال واقعا وجود دارد و کانال/گروه است، نه یک چت شخصی.
//   ۲. **خودِ درخواست‌دهنده** آنجا سازنده یا ادمین است — وگرنه هرکسی
//      می‌توانست کانال یک نفر دیگر را به نام خودش ثبت کند.
//   ۳. ربات نارمون آنجا عضو است — بدون آن نه می‌توانیم عضویت را بسنجیم و
//      نه ادمین می‌تواند بازارش را با ربات منتشر کند.
//
// ⚠️ تأیید نهایی همچنان **انسانی** است. سه اثبات بالا فقط جعل را می‌بندند،
// نه اینکه بگویند این کانال ارزش معافیت دارد.

export type ChannelStatus = "pending" | "approved" | "rejected";

let ready: Promise<void> | null = null;

export async function ensureChannelTables(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ir_channels (
           id          SERIAL PRIMARY KEY,
           owner_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           chat_id     BIGINT NOT NULL,
           title       TEXT NOT NULL DEFAULT '',
           username    TEXT,
           members     INTEGER NOT NULL DEFAULT 0,
           status      TEXT NOT NULL DEFAULT 'pending',
           review_note TEXT,
           created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
           reviewed_at TIMESTAMPTZ
         )`
      );
      // ⚠️ یک کانال فقط به یک حساب. بدون این، دو نفر می‌توانستند همان کانال
      // را ثبت کنند و هر دو معافیت بگیرند — یعنی معافیت با تعداد حساب
      // ضرب می‌شد، نه با تعداد کانال.
      await pool.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS ir_channels_chat_uniq ON ir_channels (chat_id)"
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS ir_channels_owner
           ON ir_channels (owner_id, status)`
      );
    });
  }
  return ready;
}

export type ChannelRow = {
  id: number;
  chatId: string;
  title: string;
  username: string | null;
  members: number;
  status: ChannelStatus;
  reviewNote: string | null;
  createdAt: string;
};

export type RegisterResult =
  | { ok: true; id: number; title: string; members: number }
  | {
      ok: false;
      error:
        | "bad_input"
        | "not_found"
        | "not_a_channel"
        | "not_owner"
        | "bot_not_member"
        | "already_registered"
        | "server_error";
    };

type ChatInfo = { id: number; type: string; title?: string; username?: string };

/**
 * ثبت یک کانال یا گروه به نام کاربر.
 *
 * `raw` می‌تواند `@username`، لینک `t.me/...`، یا شناسه‌ی عددی باشد —
 * چون ادمین‌ها هر سه شکل را می‌فرستند و ردکردن دو تای آن‌ها فقط اصطکاک
 * است.
 */
export async function registerChannel(
  playerId: number,
  tgUserId: number,
  raw: string
): Promise<RegisterResult> {
  await ensureChannelTables();

  const ref = normalizeChatRef(raw);
  if (!ref) return { ok: false, error: "bad_input" };

  // ۱. کانال وجود دارد؟
  const chat = await tgCall<ChatInfo>("getChat", { chat_id: ref });
  if (!chat.ok) {
    log.info("channel.lookup_failed", { playerId, err: chat.error });
    // «chat not found» تقریبا همیشه یعنی ربات آنجا نیست، نه اینکه کانال
    // وجود ندارد — تلگرام چت‌هایی را که ربات عضوشان نیست نشان نمی‌دهد.
    return {
      ok: false,
      error: /chat not found/i.test(chat.error) ? "bot_not_member" : "not_found",
    };
  }
  const info = chat.result;
  if (info.type !== "channel" && info.type !== "supergroup" && info.type !== "group") {
    return { ok: false, error: "not_a_channel" };
  }

  // ۲. خودِ درخواست‌دهنده آنجا ادمین است؟
  const me = await tgCall<{ status: string }>("getChatMember", {
    chat_id: info.id,
    user_id: tgUserId,
  });
  const role = me.ok ? me.result.status : "";
  if (role !== "creator" && role !== "administrator") {
    log.info("channel.not_owner", { playerId, chatId: info.id, role: role || "unknown" });
    return { ok: false, error: "not_owner" };
  }

  // ۳. ربات نارمون آنجا هست؟ getChat موفق بوده، پس هست — ولی تعداد اعضا
  // را هم می‌خواهیم تا گرداننده بداند دارد به چه اندازه‌ای معافیت می‌دهد.
  const count = await tgCall<number>("getChatMemberCount", { chat_id: info.id });
  const members = count.ok ? Number(count.result) : 0;

  const pool = await db();
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO ir_channels (owner_id, chat_id, title, username, members)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (chat_id) DO NOTHING
       RETURNING id`,
      [playerId, info.id, info.title ?? "", info.username ?? null, members]
    );
    if (!r.rowCount) return { ok: false, error: "already_registered" };

    log.warn("channel.registered", {
      playerId,
      channelId: r.rows[0].id,
      chatId: info.id,
      members,
      role,
    });
    return { ok: true, id: r.rows[0].id, title: info.title ?? "", members };
  } catch (err) {
    log.error("channel.register_failed", {
      playerId,
      err: err instanceof Error ? err.message : "error",
    });
    return { ok: false, error: "server_error" };
  }
}

/**
 * `@username` / لینک / شناسه‌ی عددی → چیزی که Bot API می‌پذیرد.
 *
 * `null` یعنی ورودی اصلا شبیه یک مرجع چت نبود و نباید به تلگرام فرستاده
 * شود.
 */
export function normalizeChatRef(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;

  // شناسه‌ی عددی سوپرگروه/کانال همیشه منفی است.
  if (/^-100\d{5,}$/.test(t)) return t;

  const m = /(?:t\.me\/|telegram\.me\/|^@)?([A-Za-z][A-Za-z0-9_]{4,31})$/.exec(
    t.replace(/^https?:\/\//, "")
  );
  return m ? `@${m[1]}` : null;
}

/** کانال‌های یک کاربر. */
export async function listPlayerChannels(playerId: number): Promise<ChannelRow[]> {
  await ensureChannelTables();
  const pool = await db();
  const r = await pool.query(
    `SELECT id, chat_id, title, username, members, status, review_note, created_at
       FROM ir_channels WHERE owner_id=$1 ORDER BY created_at DESC`,
    [playerId]
  );
  return r.rows.map(toRow);
}

/** همه‌ی کانال‌های در انتظار — برای پنل ادمین. */
export async function listPendingChannels(): Promise<
  (ChannelRow & { ownerId: number; ownerName: string | null })[]
> {
  await ensureChannelTables();
  const pool = await db();
  const r = await pool.query(
    `SELECT c.id, c.chat_id, c.title, c.username, c.members, c.status,
            c.review_note, c.created_at, c.owner_id, p.display_name AS owner_name
       FROM ir_channels c
       LEFT JOIN players p ON p.id = c.owner_id
      WHERE c.status='pending'
      ORDER BY c.created_at ASC`
  );
  return r.rows.map((x) => ({
    ...toRow(x),
    ownerId: x.owner_id,
    ownerName: x.owner_name,
  }));
}

/**
 * آیا این حساب کانال تأییدشده دارد؟ — یعنی از کارمزد ساخت بازار معاف است.
 *
 * ⚠️ این تابع در مسیر پول صدا زده می‌شود، پس عمدا فقط یک کوئری ساده است و
 * هیچ تماسی با تلگرام ندارد. اگر ادمین بعدا کانالش را حذف کند یا ربات را
 * بیرون بیندازد، معافیتش تا بازبینی دستی می‌ماند — که پذیرفتنی است: بدترین
 * پیامدش چند بازار رایگان است، نه از دست رفتن پول.
 */
export async function hasApprovedChannel(playerId: number): Promise<boolean> {
  await ensureChannelTables();
  const pool = await db();
  const r = await pool.query(
    "SELECT 1 FROM ir_channels WHERE owner_id=$1 AND status='approved' LIMIT 1",
    [playerId]
  );
  return Boolean(r.rowCount);
}

export type ReviewResult =
  | { ok: true; ownerId: number; title: string; approved: boolean }
  | { ok: false; error: "not_pending" };

/**
 * تأیید یا رد یک کانال.
 *
 * ⚠️ شرط `status='pending'` داخل خودِ UPDATE است، پس دو لمس هم‌زمان (پنل و
 * ربات با هم) فقط یکی‌شان اثر می‌گذارد — همان الگوی بازبینی بازار.
 */
export async function reviewChannel(
  id: number,
  approve: boolean,
  note?: string
): Promise<ReviewResult> {
  await ensureChannelTables();
  const pool = await db();
  const r = await pool.query<{ owner_id: number; title: string }>(
    `UPDATE ir_channels
        SET status=$2, reviewed_at=now(), review_note=$3
      WHERE id=$1 AND status='pending'
      RETURNING owner_id, title`,
    [id, approve ? "approved" : "rejected", note ?? null]
  );
  if (!r.rowCount) return { ok: false, error: "not_pending" };

  log.warn("channel.reviewed", {
    channelId: id,
    ownerId: r.rows[0].owner_id,
    approved: approve,
  });
  return {
    ok: true,
    ownerId: r.rows[0].owner_id,
    title: r.rows[0].title,
    approved: approve,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(x: any): ChannelRow {
  return {
    id: x.id,
    chatId: String(x.chat_id),
    title: x.title,
    username: x.username,
    members: x.members,
    status: x.status,
    reviewNote: x.review_note,
    createdAt: x.created_at,
  };
}

// ── اعلان و بازبینی از داخل ربات ─────────────────────────────

/** شناسه‌ی کال‌بک — کوتاه، چون تلگرام سقف ۶۴ بایت دارد. */
export const CH_REVIEW = {
  approve: (id: number) => `ch:ok:${id}`,
  reject: (id: number) => `ch:no:${id}`,
} as const;
