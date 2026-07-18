import { randomBytes, scrypt, timingSafeEqual } from "crypto";

// scrypt is built into Node — no external dependency, strong by default.
function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/** Returns "salt:hash" (both hex) for storage. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verify against a stored "salt:hash". */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(password, salt);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Normalizes a Telegram handle: strips @, lowercases, trims. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Masks a username for public display, e.g. "amiractive" -> "am•••ve". */
export function maskUsername(username: string): string {
  const u = username.replace(/^@+/, "");
  if (u.length <= 4) return u[0] + "•••";
  return `${u.slice(0, 2)}•••${u.slice(-2)}`;
}
