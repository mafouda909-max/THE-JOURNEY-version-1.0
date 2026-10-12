import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/** Shared Slice 2 E2E helpers — real Chromium against STAGING. */

export const AGENT1 = { email: "e2e-agent1@e2e.local", password: "Passw0rd!E2E" };
export const AGENT2 = { email: "e2e-agent2@e2e.local", password: "Passw0rd!E2E" };
const ADMIN = { email: "e2e-admin@e2e.local", password: "Passw0rd!E2E" };

const URL_BASE = "https://kmlsyyqmzgcmethgoglj.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbHN5eXFtemdjbWV0aGdvZ2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTg4NzcsImV4cCI6MjEwMzE5NDg3N30.f68WxFmXEKqeGsIwEEA3osKtmSQGTylAB2acoWDLuTY";

export const OFFER_EXPIRED_ID = "22222222-2222-4222-8222-000000000201";
export const OFFER_REJECTED_ID = "22222222-2222-4222-8222-000000000202";
export const OFFER_AGENT2_PUBLISHED_ID = "22222222-2222-4222-8222-000000000210";

const SECRET_FILE = ".e2e-cache/admin-totp.secret";

// ── TOTP (RFC 6238, SHA-1, 30 s, 6 digits) — no external deps ───────────────
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/g, "").toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpCode(secretB32: string, atMs = Date.now()): string {
  const key = base32Decode(secretB32);
  const counter = Math.floor(atMs / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[off] & 0x7f) << 24) |
    (hmac[off + 1] << 16) |
    (hmac[off + 2] << 8) |
    hmac[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

function saveSecret(secret: string): void {
  mkdirSync(".e2e-cache", { recursive: true });
  writeFileSync(SECRET_FILE, secret);
}
function loadSecret(): string | null {
  return existsSync(SECRET_FILE) ? readFileSync(SECRET_FILE, "utf8").trim() : null;
}

// ── Logins ───────────────────────────────────────────────────────────────────
export async function loginAgent(page: Page): Promise<void> {
  await page.goto("/login?next=/dashboard");
  await page.locator("#email").fill(AGENT1.email);
  await page.locator("#password").fill(AGENT1.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  // Session cookie must survive into the next server request — verify the
  // guarded layout actually rendered (guards run on EVERY dashboard request).
  await expect(page.getByRole("heading", { name: "مرحبًا" })).toBeVisible({ timeout: 30_000 });
}

/**
 * ADMIN login with the mandatory MFA gate. Deterministic state machine:
 *  1. password → land on mfa screen
 *  2. cached secret + challenge form → verify
 *  3. otherwise enroll a NEW factor (unique friendly name) — possible at
 *     AAL1 only when no verified factor exists, so the fixture pipeline
 *     resets admin factors before each full run.
 */

/**
 * ADMIN login with mandatory MFA — deterministic path: password + TOTP
 * enroll/challenge run over the REAL auth API from the test process, then the
 * resulting AAL2 session is materialized into the exact @supabase/ssr cookie
 * the server guards read. The browser then loads genuinely guarded pages;
 * requireAdminMfa() sees a true AAL2 session.
 */
export async function loginAdminMfa(page: Page): Promise<void> {
  const c = createClient(URL_BASE, ANON);
  const { error: pErr } = await c.auth.signInWithPassword(ADMIN);
  if (pErr) throw pErr;

  const { data: fdata } = await c.auth.mfa.listFactors();
  const totp = fdata?.totp.find((f) => f.status === "verified") as
    | { id: string; status: string }
    | undefined;
  let secret = loadSecret();

  if (!totp) {
    const en = await c.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `admin-${Date.now()}`,
    });
    if (en.error) throw en.error;
    secret = en.data.totp.secret;
    saveSecret(secret);
    const ch = await c.auth.mfa.challenge({ factorId: en.data.id });
    if (ch.error) throw ch.error;
    const v = await c.auth.mfa.verify({
      factorId: en.data.id,
      challengeId: ch.data.id,
      code: totpCode(secret),
    });
    if (v.error) throw v.error;
  } else if (!secret) {
    throw new Error(
      "verified admin factor exists but cached secret missing — reset factors",
    );
  }
  if (!secret || !totp) throw new Error("unreachable MFA state");

  const ch2 = await c.auth.mfa.challenge({ factorId: totp.id });
  if (ch2.error) throw ch2.error;
  const v2 = await c.auth.mfa.verify({
    factorId: totp.id,
    challengeId: ch2.data.id,
    code: totpCode(secret!),
  });
  if (v2.error) throw v2.error;

  const sess = (await c.auth.getSession()).data.session!;
  const store: Record<string, string> = {};
  const ssr = createServerClient(URL_BASE, ANON, {
    cookies: {
      getAll: () => [],
      setAll: (l) => l.forEach(({ name, value }) => (store[name] = value)),
    },
  });
  await ssr.auth.setSession({
    access_token: sess.access_token,
    refresh_token: sess.refresh_token,
  });

  await page.context().addCookies(
    Object.entries(store).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
  await page.goto("/admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "لوحة الإدارة", level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
}
