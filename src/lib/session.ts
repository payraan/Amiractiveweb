import { createHmac, timingSafeEqual } from "crypto";

// Sessions are a signed "playerId.expiry.signature" token stored in a cookie.
// Secret falls back to DATABASE_URL-derived value if SESSION_SECRET is unset,
// so it works out of the box on Railway but can be hardened later.
const SECRET =
  process.env.SESSION_SECRET ||
  process.env.DATABASE_URL?.slice(-32) ||
  "amiractive-dev-secret-change-me";

const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export function signSession(playerId: number): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const body = `${playerId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): number | null {
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
