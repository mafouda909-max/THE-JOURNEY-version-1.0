import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, agents, sessions } from "@/db/schema";
import { createSession, sessionCookie } from "@/lib/identity";
import { normalizeAuthEmail, normalizeSelfServeRole, postAuthDestination } from "@/lib/passwordless-auth";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { hashPilotPassword, passwordPolicyError, PasswordCapacityError, verifyPilotPassword } from "@/lib/password-credentials";
import { trackEvent } from "@/lib/data";
import { randomBytes } from "node:crypto";
import { passwordAuthSchemaReady } from "@/lib/password-auth-schema";

type Action = "signup" | "login";
const CACHE_HEADERS = { "Cache-Control": "private, no-store" };
let readinessCache: { ok: boolean; until: number } | null = null;
let readinessInFlight: Promise<boolean> | null = null;

export function passwordAuthConfigured(): boolean {
  return process.env.PASSWORD_AUTH_ENABLED === "true" &&
    /^[a-f0-9]{64}$/.test(process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET ?? "");
}

export const passwordAuthReadiness = {
  async probe(): Promise<boolean> {
    if (!passwordAuthConfigured()) return false;
    if (readinessCache && readinessCache.until > Date.now()) return readinessCache.ok;
    if (readinessInFlight) return readinessInFlight;
    readinessInFlight = (async () => {
      const ok = await passwordAuthSchemaReady((statement) => db.execute(statement));
      readinessCache = { ok, until: Date.now() + (ok ? 30_000 : 5_000) };
      return ok;
    })();
    try { return await readinessInFlight; }
    finally { readinessInFlight = null; }
  },
};

function response(body: Record<string, unknown>, status: number, retry?: number) {
  return NextResponse.json(body, { status, headers: { ...CACHE_HEADERS, ...(retry ? { "Retry-After": String(retry) } : {}) } });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.split(";")[0].trim().match(/^application\/json$/i)) throw new Error("body");
  if (Number(request.headers.get("content-length") ?? 0) > 4096) throw new RangeError("body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new RangeError("body"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body");
  return parsed as Record<string, unknown>;
}

function throttleKey(value: string) {
  return createHmac("sha256", process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET!).update(value).digest("hex");
}

export async function consumePasswordBudget(action: Action, ip: string, email: string): Promise<{ allowed: boolean; retry: number }> {
  const limits = [
    { key: throttleKey(`${action}:ip:${ip}`), max: action === "signup" ? 8 : 20, seconds: action === "signup" ? 600 : 300 },
    { key: throttleKey(`${action}:email:${email}`), max: action === "signup" ? 3 : 8, seconds: 300 },
    { key: throttleKey(`${action}:global`), max: action === "signup" ? 30 : 200, seconds: action === "signup" ? 3600 : 300 },
  ].sort((a, b) => a.key.localeCompare(b.key));
  const values = sql.join(limits.map((limit) => sql`(${limit.key},1,now()+${limit.seconds}*interval '1 second')`), sql`, `);
  // One atomic statement shares limits across every serverless instance.
  const result = await db.execute(sql`INSERT INTO auth_password_attempts(bucket_key,attempts,reset_at) VALUES ${values}
    ON CONFLICT(bucket_key) DO UPDATE SET
      attempts=CASE WHEN auth_password_attempts.reset_at<=now() THEN 1 ELSE LEAST(auth_password_attempts.attempts+1,1000000) END,
      reset_at=CASE WHEN auth_password_attempts.reset_at<=now() THEN EXCLUDED.reset_at ELSE auth_password_attempts.reset_at END
    RETURNING bucket_key,attempts, GREATEST(1,ceil(extract(epoch FROM reset_at-now())))::integer AS retry`);
  let retry = 0;
  for (const row of result.rows) {
    const limit = limits.find((item) => item.key === row.bucket_key)!;
    if (Number(row.attempts) > limit.max) retry = Math.max(retry, Number(row.retry));
  }
  await db.execute(sql`DELETE FROM auth_password_attempts WHERE reset_at < now()-interval '1 hour'`);
  return { allowed: retry === 0, retry };
}

function uniqueViolation(error: unknown): boolean {
  let current = error;
  for (let i = 0; i < 6 && current && typeof current === "object"; i += 1) {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function passwordAuthPost(request: Request, action: Action) {
  if (!passwordAuthConfigured()) return response({ error: "التسجيل والدخول بكلمة المرور غير مفعّلين حاليًا." }, 410);
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin) return response({ error: "مسار الدخول غير جاهز على هذا العنوان." }, 503);
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return response({ error: "ابدأ التسجيل أو الدخول من موقع صلة." }, 403);
  }
  const burst = rateLimiter.checkRateLimit(`auth:password:burst:${clientIpFromRequest(request)}`, 30, 60);
  if (!burst.allowed) return response({ error: "محاولات كثيرة — حاول بعد قليل." }, 429, burst.resetSeconds);

  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch (error) { return response({ error: "بيانات الطلب غير صالحة." }, error instanceof RangeError ? 413 : 400); }
  const email = normalizeAuthEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const role = normalizeSelfServeRole(body.role);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (action === "signup") {
    const policyError = passwordPolicyError(password);
    if (!email || !role || name.length < 2 || name.length > 120 || city.length > 120 || policyError) {
      return response({ error: policyError ?? "راجع الاسم والبريد ونوع الحساب." }, 422);
    }
  } else if (!email || password.length < 1 || password.length > 128) {
    return response({ error: "بيانات الدخول غير صحيحة." }, 401);
  }
  if (!await passwordAuthReadiness.probe()) return response({ error: "التسجيل غير متاح مؤقتًا. حاول بعد قليل." }, 503);

  try {
    const budget = await consumePasswordBudget(action, clientIpFromRequest(request), email!);
    if (!budget.allowed) return response({ error: "محاولات كثيرة — حاول بعد قليل." }, 429, budget.retry);
    const existing = await db.select().from(accounts).where(sql`lower(${accounts.email})=${email}`).limit(1);
    let account = existing[0];
    let token: string;
    if (action === "signup") {
      // Never set a password, attach an agent, or change the role of an existing account.
      if (account) return response({ error: "تعذر إنشاء حساب بهذا البريد. جرّب تسجيل الدخول أو بريدًا آخر." }, 409);
      const passwordHash = await hashPilotPassword(password);
      const created = await db.transaction(async (tx) => {
        let agentId: number | null = null;
        if (role === "agent") {
          const [agent] = await tx.insert(agents).values({
            displayName: name, latinName: name, bio: "", photoUrl: "/brand/sila-app-icon.svg",
            city: city || "—", country: "—", licenseType: "individual", licenseNumber: null,
            verificationStatus: "pending", verifiedAt: null, specialtyTags: [], languages: ["العربية"],
            responseRate: 0, avgResponseHours: 0, totalTrips: 0,
          }).returning({ id: agents.id });
          agentId = agent.id;
        }
        const [newAccount] = await tx.insert(accounts).values({ email: email!, passwordHash, role: role!, displayName: name, agentId }).returning();
        const sessionToken = randomBytes(32).toString("hex");
        await tx.insert(sessions).values({ token: sessionToken, accountId: newAccount.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
        return { account: newAccount, token: sessionToken };
      });
      account = created.account;
      token = created.token;
      if (role === "agent") {
        await trackEvent("agent_auth_started", { meta: "provider=password;intent=signup" });
        await trackEvent("agent_identity_provisioned", { meta: "provider=password;role=agent;email_verified=false" });
      }
    } else {
      const matched = await verifyPilotPassword(password, account?.passwordHash);
      if (!account || !matched || !["traveler", "agent"].includes(account.role)) {
        return response({ error: "بيانات الدخول غير صحيحة." }, 401);
      }
      token = await createSession(account.id);
    }
    const result = response({ ok: true, role: account.role, emailVerified: false, destination: postAuthDestination(account.role) }, action === "signup" ? 201 : 200);
    const cookie = sessionCookie(token);
    result.cookies.set(cookie.name, cookie.value, cookie);
    return result;
  } catch (error) {
    if (error instanceof PasswordCapacityError) return response({ error: "محاولات كثيرة — حاول بعد قليل." }, 429, 2);
    if (uniqueViolation(error)) return response({ error: "تعذر إنشاء حساب بهذا البريد. جرّب تسجيل الدخول أو بريدًا آخر." }, 409);
    // No password, email, token, body or provider error enters logs/audit/analytics.
    return response({ error: "تعذر إكمال العملية الآن. حاول بعد قليل." }, 503);
  }
}
