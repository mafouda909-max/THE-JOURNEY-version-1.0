import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents, authChallenges, linkedIdentities } from "@/db/schema";
import { disabledPasswordHash } from "@/lib/identity";

export type SelfServeRole = "traveler" | "agent";
export type AuthIntent = "login" | "signup";
export type VerifiedProvider = "google" | "email";

const DEFAULT_PHOTO =
  "https://images.pexels.com/photos/16900964/pexels-photo-16900964.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800";

export function normalizeAuthEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function normalizeSelfServeRole(value: unknown): SelfServeRole | null {
  return value === "agent" || value === "traveler" ? value : null;
}

export function normalizeAuthIntent(value: unknown): AuthIntent {
  return value === "signup" ? "signup" : "login";
}

function adminAllowlist(): Set<string> {
  return new Set(
    (process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function googleAdminLinkAllowed(email: string): boolean {
  return adminAllowlist().has(email.toLowerCase());
}

export function postAuthDestination(role: string): string {
  if (role === "traveler" && process.env.TRAVELER_WORKSPACE_ENABLED === "true") {
    return "/account/travel";
  }
  return "/account";
}

function pgCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") return null;
    if ("code" in current) {
      const code = String((current as { code?: unknown }).code ?? "");
      if (code) return code;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return null;
}

export type ProvisionResult =
  | { ok: true; account: typeof accounts.$inferSelect; created: boolean; linked: boolean }
  | { ok: false; status: number; code: string; error: string };

export async function provisionVerifiedIdentity(input: {
  provider: VerifiedProvider;
  providerSubject: string;
  email: string;
  displayName?: string | null;
  requestedRole: SelfServeRole;
  intent: AuthIntent;
  city?: string | null;
}): Promise<ProvisionResult> {
  const email = normalizeAuthEmail(input.email);
  const subject = input.providerSubject.trim();
  const requestedRole = normalizeSelfServeRole(input.requestedRole);
  if (!email || !subject || subject.length > 120 || !requestedRole) {
    return { ok: false, status: 422, code: "INVALID_IDENTITY", error: "بيانات الهوية غير صالحة." };
  }

  const existingLink = await db
    .select({ account: accounts })
    .from(linkedIdentities)
    .innerJoin(accounts, eq(linkedIdentities.accountId, accounts.id))
    .where(and(
      eq(linkedIdentities.provider, input.provider),
      eq(linkedIdentities.providerSubject, subject),
    ))
    .limit(1);

  if (existingLink[0]) {
    return { ok: true, account: existingLink[0].account, created: false, linked: false };
  }

  const byEmail = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  const existingAccount = byEmail[0];

  if (existingAccount) {
    if (existingAccount.role === "admin") {
      if (input.provider !== "google") {
        return {
          ok: false,
          status: 403,
          code: "ADMIN_MAGIC_LINK_DISABLED",
          error: "دخول الإدارة عبر البريد غير مفعّل. استخدم وسيلة الإدارة المعتمدة.",
        };
      }
      if (!googleAdminLinkAllowed(email)) {
        return {
          ok: false,
          status: 403,
          code: "ADMIN_GOOGLE_LINK_NOT_ALLOWED",
          error: "حساب الإدارة غير مصرح له بربط Google تلقائيًا.",
        };
      }
    }

    try {
      await db.insert(linkedIdentities).values({
        accountId: existingAccount.id,
        provider: input.provider,
        providerSubject: subject,
        email,
      });
    } catch (error) {
      if (pgCode(error) !== "23505") throw error;
      const raced = await db
        .select({ account: accounts })
        .from(linkedIdentities)
        .innerJoin(accounts, eq(linkedIdentities.accountId, accounts.id))
        .where(and(
          eq(linkedIdentities.provider, input.provider),
          eq(linkedIdentities.providerSubject, subject),
        ))
        .limit(1);
      if (!raced[0] || raced[0].account.id !== existingAccount.id) {
        return {
          ok: false,
          status: 409,
          code: "IDENTITY_ALREADY_LINKED",
          error: "هذه الهوية مرتبطة بحساب آخر.",
        };
      }
    }

    return { ok: true, account: existingAccount, created: false, linked: true };
  }

  if (input.intent !== "signup") {
    return {
      ok: false,
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
      error: "لا يوجد حساب بهذا البريد. اختر إنشاء حساب مسافر أو وكيل.",
    };
  }

  const displayName =
    typeof input.displayName === "string" && input.displayName.trim().length >= 2
      ? input.displayName.trim().slice(0, 120)
      : email.split("@")[0]!.slice(0, 120);

  try {
    const account = await db.transaction(async (tx) => {
      let agentId: number | null = null;

      if (requestedRole === "agent") {
        const [agent] = await tx
          .insert(agents)
          .values({
            displayName,
            latinName: displayName,
            bio: "",
            photoUrl: DEFAULT_PHOTO,
            city: input.city?.trim().slice(0, 120) || "—",
            country: "—",
            licenseType: "individual",
            licenseNumber: null,
            verificationStatus: "pending",
            verifiedAt: null,
            specialtyTags: [],
            languages: ["العربية"],
            responseRate: 0,
            avgResponseHours: 0,
            totalTrips: 0,
          })
          .returning({ id: agents.id });
        agentId = agent.id;
      }

      const [created] = await tx
        .insert(accounts)
        .values({
          email,
          passwordHash: disabledPasswordHash(),
          role: requestedRole,
          displayName,
          agentId,
        })
        .returning();

      await tx.insert(linkedIdentities).values({
        accountId: created.id,
        provider: input.provider,
        providerSubject: subject,
        email,
      });

      return created;
    });

    return { ok: true, account, created: true, linked: true };
  } catch (error) {
    if (pgCode(error) === "23505") {
      const raced = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
      if (raced[0] && raced[0].role !== "admin") {
        return provisionVerifiedIdentity({ ...input, intent: "login" });
      }
      return {
        ok: false,
        status: 409,
        code: "IDENTITY_CONFLICT",
        error: "تعذر ربط الهوية بالحساب بشكل آمن.",
      };
    }
    throw error;
  }
}

export function magicTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicChallenge(input: {
  email: string;
  requestedRole: SelfServeRole;
  intent: AuthIntent;
  displayName?: string | null;
  city?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.insert(authChallenges).values({
    tokenHash: magicTokenHash(token),
    email: input.email,
    requestedRole: input.requestedRole,
    intent: input.intent,
    purpose: "magic_link",
    displayName: input.displayName?.trim().slice(0, 120) || null,
    city: input.city?.trim().slice(0, 120) || null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function consumeMagicChallenge(token: string) {
  const hash = magicTokenHash(token);
  const rows = await db
    .update(authChallenges)
    .set({ usedAt: new Date() })
    .where(and(
      eq(authChallenges.tokenHash, hash),
      eq(authChallenges.purpose, "magic_link"),
      isNull(authChallenges.usedAt),
      gt(authChallenges.expiresAt, new Date()),
    ))
    .returning();
  return rows[0] ?? null;
}

export async function invalidateMagicChallenge(token: string): Promise<void> {
  await db
    .update(authChallenges)
    .set({ usedAt: new Date() })
    .where(eq(authChallenges.tokenHash, magicTokenHash(token)));
}
