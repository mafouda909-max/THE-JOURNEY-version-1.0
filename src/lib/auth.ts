import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Admin authorization boundary (fail-closed).
 *
 * Key resolution:
 *   1. ADMIN_API_KEY env var (production secret) if set
 *   2. else a locally generated key persisted in config/admin-key.json
 *      (the preview bootstrap rewrites .env on every boot, so a file the
 *      host doesn't manage is the only durable local secret)
 */
function resolveAdminKey(): string | null {
  if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
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

export const adminAuthConfigured = Boolean(ADMIN_KEY);

function keyOk(candidate: string | null | undefined): boolean {
  return Boolean(ADMIN_KEY && candidate && candidate === ADMIN_KEY);
}

export function isAdminRequest(request: Request): boolean {
  if (keyOk(request.headers.get("x-admin-key"))) return true;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)tj_admin=([^;]+)/);
  return keyOk(match?.[1] ? decodeURIComponent(match[1]) : null);
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
  return keyOk(store.get("tj_admin")?.value ?? null);
}
