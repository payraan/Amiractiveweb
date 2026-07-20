import { createHmac, timingSafeEqual, scrypt, randomBytes } from "crypto";
import { db } from "@/lib/db";

// ── Admin session (separate from player sessions) ──────────────
const SECRET =
  process.env.ADMIN_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.DATABASE_URL?.slice(-40) ||
  "amiractive-admin-dev-secret";

const MAX_AGE_S = 60 * 60 * 12; // 12h admin sessions
export const ADMIN_COOKIE = "amir_admin";
export const ADMIN_MAX_AGE = MAX_AGE_S;

export function signAdmin(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const body = `admin.${exp}`;
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifyAdmin(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [who, expStr, sig] = parts;
  if (who !== "admin") return false;
  const expected = createHmac("sha256", SECRET).update(`admin.${expStr}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  if (Number(expStr) * 1000 < Date.now()) return false;
  return true;
}

// ── Admin password check ───────────────────────────────────────
// ADMIN_PASSWORD is a plain password stored in Railway env.
function scryptAsync(pw: string, salt: Buffer): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(pw, salt, 32, (e, d) => (e ? rej(e) : res(d)))
  );
}

export async function checkAdminPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // constant-time compare via scrypt with a fixed salt derived from secret
  const salt = Buffer.from(SECRET.slice(0, 16).padEnd(16, "x"));
  const [a, b] = await Promise.all([
    scryptAsync(input, salt),
    scryptAsync(expected, salt),
  ]);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Audit table for credit top-ups ─────────────────────────────
let topupReady: Promise<void> | null = null;
export async function ensureTopupTable() {
  if (!topupReady) {
    topupReady = db().then((pool) =>
      pool
        .query(
          `CREATE TABLE IF NOT EXISTS credit_topups (
             id SERIAL PRIMARY KEY,
             player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
             amount INTEGER NOT NULL,
             note TEXT,
             created_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`
        )
        .then(() => undefined)
    );
  }
  return topupReady;
}

export function randomId() {
  return randomBytes(8).toString("hex");
}
