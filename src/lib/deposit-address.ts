import { db } from "@/lib/db";
import { getDepositAddress, USDT_NETWORK } from "@/lib/zovix";

// ═══ آدرس واریز، ذخیره‌شده ═══════════════════════════════════
//
// ── چرا این فایل وجود دارد ──
// تا امروز هر بار باز شدن صفحه‌ی کیف پول یک تماس HTTP با درگاه می‌زد. تست
// بار نشان داد هر تماس ۱ تا ۶ ثانیه طول می‌کشد و تایم‌اوتش ۲۰ ثانیه است؛
// نتیجه‌اش این شد که `/api/wallet` زیر ۳۰ درخواست همزمان به **۳ درخواست در
// ثانیه** و p95 برابر ۲۰ ثانیه رسید. با ۵۰ هزار کاربر، هر باز شدن کیف پول
// یک تماس با درگاه است.
//
// ── چرا ذخیره‌کردن امن است ──
// درگاه برای یک `client_id` همیشه **همان** آدرس را برمی‌گرداند؛ این را با
// سه فراخوان پشت‌سرهم روی یک شناسه سنجیدیم و هر سه یکی بود. پس آدرس یک
// مقدار ثابت است، نه یک منبع زنده.
//
// ⚠️ اگر ذخیره‌کردن شکست بخورد، آدرس همچنان برگردانده می‌شود. آدرسی که
// گرفته‌ایم ولی ننوشته‌ایم، بدتر از آدرسی نیست که اصلا نگرفته‌ایم — و کاربری
// که منتظر آدرس واریز است نباید به‌خاطر یک خطای نوشتن دست خالی بماند.

let ready: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!ready) {
    ready = db().then(async (pool) => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS deposit_addresses (
           player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
           network TEXT NOT NULL,
           address TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           PRIMARY KEY (player_id, network)
         )`
      );
    });
  }
  return ready;
}

export type AddressResult =
  | { ok: true; address: string; cached: boolean }
  | { ok: false; error: string };

/**
 * آدرس واریز این بازیکن. اول از دیتابیس، و فقط اگر نبود از درگاه.
 */
export async function depositAddressFor(
  playerId: number,
  network = USDT_NETWORK
): Promise<AddressResult> {
  await ensureTable();
  const pool = await db();

  const hit = await pool.query<{ address: string }>(
    "SELECT address FROM deposit_addresses WHERE player_id=$1 AND network=$2",
    [playerId, network]
  );
  if (hit.rowCount) return { ok: true, address: hit.rows[0].address, cached: true };

  const r = await getDepositAddress(playerId, network);
  if (!r.ok) return { ok: false, error: r.error };

  const address = String(r.data.address ?? "").trim();
  if (!address) return { ok: false, error: "empty_address" };

  try {
    // ON CONFLICT DO NOTHING: دو درخواست همزمانِ همان کاربر هر دو آدرس را از
    // درگاه می‌گیرند (و درگاه به هر دو همان را می‌دهد)، پس دومی فقط نباید
    // بترکد.
    await pool.query(
      `INSERT INTO deposit_addresses (player_id, network, address)
       VALUES ($1,$2,$3) ON CONFLICT (player_id, network) DO NOTHING`,
      [playerId, network, address]
    );
  } catch {
    /* آدرس را داریم؛ نوشتنش نباید جلوی برگرداندنش را بگیرد */
  }

  return { ok: true, address, cached: false };
}
