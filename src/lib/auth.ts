import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Admin authorization boundary (fail-closed).
 *
 * Key resolution:
 *   1. ADMIN_API_KEY env var (production secret) if set
 *   2. else a locally generated key persisted in config/admin-key.json
 *      for local/preview development only.
 *
 * The browser never stores ADMIN_API_KEY itself. Successful login receives a
 * short-lived HMAC-signed session cookie derived from the key.
 */
function resolveAdminKey(): string | null {
  if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
  if (process.env.NODE_ENV === "production") return null;
  try {
    const file = join(process.cwd(), "config", "admin-key.json");
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (typeof parsed.key === "string" && parsed.key.length >= 16) {
        return parsed.key;
      }
    }
    const key = `tj-${randomBytes(18).toString("hex")}`;
    mkdirSync(join(process.cwd(), "config"), { recursive: true });
    writeFileSync(file, JSON.stringify({ key, rotatedAt: new Date().toISOString() }));
    return key;
  } catch {
    return null;
  }
}

const ADMIN_KEY = resolveAdminKey();
const ADMIN_SESSION_VERSION = "v1";
const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

export const adminAuthConfigured = Boolean(ADMIN_KEY);

function safeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function keyOk(candidate: string | null | undefined): boolean {
  return Boolean(ADMIN_KEY && candidate && safeEqualString(ADMIN_KEY, candidate));
}

function adminSessionSignature(expiresAt: number): string | null {
  if (!ADMIN_KEY) return null;
  return createHmac("sha256", ADMIN_KEY)
    .update(`tj_admin:${ADMIN_SESSION_VERSION}:${expiresAt}`)
    .digest("hex");
}

export function createAdminSessionToken(
  nowMs = Date.now(),
  ttlSeconds = ADMIN_SESSION_SECONDS,
): string | null {
  if (!ADMIN_KEY) return null;
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const signature = adminSessionSignature(expiresAt);
  return signature ? `${ADMIN_SESSION_VERSION}.${expiresAt}.${signature}` : null;
}

export function adminSessionMatches(candidate: string | null | undefined, nowMs = Date.now()): boolean {
  if (!ADMIN_KEY || !candidate) return false;
  const [version, expiresRaw, signature, extra] = candidate.split(".");
  if (extra !== undefined || version !== ADMIN_SESSION_VERSION || !expiresRaw || !signature) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(nowMs / 1000)) return false;
  const expected = adminSessionSignature(expiresAt);
  return Boolean(expected && safeEqualString(expected, signature));
}

export function isAdminRequest(request: Request): boolean {
  if (keyOk(request.headers.get("x-admin-key"))) return true;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)tj_admin=([^;]+)/);
  try {
    return adminSessionMatches(match?.[1] ? decodeURIComponent(match[1]) : null);
  } catch {
    return false;
  }
}

/** Returns null when authorized; otherwise the refusal response. */
export function requireAdmin(request: Request): NextResponse | null {
  if (!ADMIN_KEY) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Admin authorization is not configured — set ADMIN_API_KEY to open the trust desk.",
      },
      { status: 503 },
    );
  }
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized — صلاحيات إدارية مطلوبة." },
      { status: 401 },
    );
  }
  return null;
}

export function adminKeyMatches(candidate: unknown): boolean {
  return typeof candidate === "string" && keyOk(candidate);
}

export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  return adminSessionMatches(store.get("tj_admin")?.value ?? null);
}
