import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Distinct from legacy hashes: these accounts have not proved email ownership.
const PREFIX = "scrypt-pilot-v1$";
const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const COMMON_PASSWORDS = new Set([
  "123456789012345", "1234567890123456", "passwordpassword",
  "password123456789", "qwertyuiopasdfgh", "abcdefghijklmnop",
]);
const DUMMY_HASH = `${PREFIX}${"0".repeat(32)}$${"0".repeat(128)}`;
let activeDerivations = 0;

export class PasswordCapacityError extends Error {}

export function pilotPasswordHash(stored: string | null | undefined): boolean {
  return Boolean(stored?.startsWith(PREFIX));
}

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 15 || password.length > 128) {
    return "استخدم كلمة مرور من 15 إلى 128 حرفًا؛ يمكنك استخدام عبارة طويلة سهلة التذكر.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim()) || /^([\s\S])\1+$/.test(password)) {
    return "كلمة المرور شائعة جدًا. اختر عبارة أطول ومختلفة.";
  }
  return null;
}

async function derive(password: string, salt: string): Promise<Buffer> {
  // Bound memory use without retaining an unbounded queue of plaintext passwords.
  if (activeDerivations >= 2) throw new PasswordCapacityError();
  activeDerivations += 1;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, OPTIONS, (error, hash) => error ? reject(error) : resolve(hash));
    });
  } finally {
    activeDerivations -= 1;
  }
}

export async function hashPilotPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${PREFIX}${salt}$${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPilotPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const validFormat = /^scrypt-pilot-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored ?? "");
  const [salt, hash] = (validFormat ? stored! : DUMMY_HASH).slice(PREFIX.length).split("$");
  // Unknown, OAuth-only and legacy accounts take the same expensive path.
  const candidate = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");
  return validFormat && candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
