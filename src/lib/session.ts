import { createHmac, timingSafeEqual } from "crypto";

// Sessions are a signed "playerId.expiry.signature" token stored in a cookie.
//
// SESSION_SECRET is REQUIRED. It used to fall back to the tail of DATABASE_URL,
// but on Railway that tail is something like ".railway.internal:5432/railway" —
// low entropy and guessable, which would let anyone forge a session cookie for
// any playerId (full account takeover). We now fail closed instead: with no
// secret set, nobody is authenticated and login fails loudly.
//
// Generate one with:  openssl rand -hex 32   and set it in Railway variables.
const SECRET = process.env.SESSION_SECRET ?? "";

if (!SECRET) {
  console.error(
    "[session] SESSION_SECRET is not set — all sessions are rejected. " +
      "Set it in Railway (openssl rand -hex 32)."
  );
}

const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export function signSession(playerId: number): string {
  if (!SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const body = `${playerId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): number | null {
  if (!SECRET) return null; // fail closed
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expStr, sig] = parts;
  const body = `${idStr}.${expStr}`;
  const expected = createHmac("sha256", SECRET).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expStr) * 1000 < Date.now()) return null;
  const id = Number(idStr);
  return Number.isInteger(id) ? id : null;
}

export const SESSION_COOKIE = "amir_session";
export const SESSION_MAX_AGE = MAX_AGE_S;
