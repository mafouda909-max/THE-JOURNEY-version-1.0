import { createHash, randomInt, timingSafeEqual } from "node:crypto";
export const newVerificationCode = () => String(randomInt(100000, 1000000));
export const verificationHash = (id: string, code: string) =>
  createHash("sha256").update(`${id}:${code}`).digest("hex");
export function matchesVerification(id: string, code: string, hash: string) {
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(verificationHash(id, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
