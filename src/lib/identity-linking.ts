import { randomBytes, createHmac } from "node:crypto";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/db";
import { accounts, linkedIdentities, auditLog } from "@/db/schema";
import type { Account } from "@/db/schema";
import { eventBus } from "@/lib/events/bus";
import { redTeamSecurityEngine } from "@/lib/redteam";
import { notify } from "@/lib/notify";

export type IdentityProvider = "google" | "apple" | "facebook" | "phone" | "email";

export interface ProviderIdentityPayload {
  provider: IdentityProvider;
  providerSubject: string; // OAuth 'sub' or verified phone/email identifier
  email?: string;
  emailVerified?: boolean;
}

export interface LinkIdentityParams {
  accountId: number;
  provider: IdentityProvider;
  providerSubject: string;
  email?: string;
  linkingToken?: string;
}

export interface LinkingTokenPayload {
  accountId: number;
  provider: IdentityProvider;
  providerSubject: string;
  expiresAt: number;
}

/**
 * HMAC secret for identity-linking challenge tokens.
 *
 * SECURITY: There is deliberately NO hardcoded fallback. A repository default
 * would let anyone who can read the source forge valid linking tokens. When
 * LINKING_TOKEN_SECRET is not configured, token generation/verification fail
 * closed with a clear configuration error.
 */
function linkingTokenSecret(): string {
  const secret = process.env.LINKING_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "LINKING_TOKEN_SECRET is not configured (min 16 chars) — identity linking tokens are disabled (fail-closed).",
    );
  }
  return secret;
}
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type IdentityErrorCode =
  | "ALREADY_LINKED"
  | "CONFLICT_LINKED_TO_OTHER"
  | "EMAIL_IN_USE_REQUIRE_RECOVERY"
  | "PHONE_IN_USE_REQUIRE_VERIFICATION"
  | "INVALID_LINK_TOKEN"
  | "EXPIRED_LINK_TOKEN"
  | "CANNOT_UNLINK_LAST_METHOD"
  | "RATE_LIMIT_EXCEEDED"
  | "HIGH_RISK_STEP_UP_REQUIRED";

export interface IdentityActionResult {
  success: boolean;
  code?: IdentityErrorCode;
  message: string;
  requiresStepUp?: boolean;
  linkedCount?: number;
}

export class IdentityLinkingService {
  /**
   * Generate a signed, time-limited linking challenge token for explicit account linking proof.
   */
  public generateLinkingToken(
    accountId: number,
    provider: IdentityProvider,
    providerSubject: string,
  ): { token: string; expiresAt: number } {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const payloadStr = `${accountId}:${provider}:${providerSubject}:${expiresAt}`;
    const signature = createHmac("sha256", linkingTokenSecret())
      .update(payloadStr)
      .digest("hex");
    const token = Buffer.from(`${payloadStr}:${signature}`).toString("base64url");
    return { token, expiresAt };
  }

  /**
   * Verify a linking challenge token. Fail closed on signature mismatch or expiration.
   */
  public verifyLinkingToken(token: string): LinkingTokenPayload | { error: IdentityErrorCode } {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length !== 5) return { error: "INVALID_LINK_TOKEN" };

      const [accountIdStr, provider, providerSubject, expiresAtStr, signature] = parts;
      const accountId = Number.parseInt(accountIdStr, 10);
      const expiresAt = Number.parseInt(expiresAtStr, 10);

      if (isNaN(accountId) || isNaN(expiresAt)) return { error: "INVALID_LINK_TOKEN" };

      const expectedPayload = `${accountId}:${provider}:${providerSubject}:${expiresAt}`;
      const expectedSig = createHmac("sha256", linkingTokenSecret())
        .update(expectedPayload)
        .digest("hex");

      if (signature !== expectedSig) return { error: "INVALID_LINK_TOKEN" };
      if (Date.now() > expiresAt) return { error: "EXPIRED_LINK_TOKEN" };

      return {
        accountId,
        provider: provider as IdentityProvider,
        providerSubject,
        expiresAt,
      };
    } catch {
      return { error: "INVALID_LINK_TOKEN" };
    }
  }

  /**
   * Find account by provider subject key.
   */
  public async findAccountByIdentity(
    provider: IdentityProvider,
    providerSubject: string,
  ): Promise<Account | null> {
    const rows = await db
      .select({ account: accounts })
      .from(linkedIdentities)
      .innerJoin(accounts, eq(linkedIdentities.accountId, accounts.id))
      .where(
        and(
          eq(linkedIdentities.provider, provider),
          eq(linkedIdentities.providerSubject, providerSubject),
        ),
      )
      .limit(1);

    return rows[0]?.account || null;
  }

  /**
   * Link an external provider identity to an account.
   * Enforces:
   *   - One provider identity -> One Journey account.
   *   - Token proof or explicit session authorization.
   *   - Fraud risk scan & takeover notifications.
   *   - Fails closed on conflicts.
   */
  public async linkIdentity(params: LinkIdentityParams): Promise<IdentityActionResult> {
    // 1. Verify token if provided
    if (params.linkingToken) {
      const tokenVerification = this.verifyLinkingToken(params.linkingToken);
      if ("error" in tokenVerification) {
        return {
          success: false,
          code: tokenVerification.error,
          message:
            tokenVerification.error === "EXPIRED_LINK_TOKEN"
              ? "رمز التوثيق منتهي الصلاحية — يرجى إعادة المحاولة."
              : "رمز توثيق ربط الحساب غير صالح.",
        };
      }
      if (
        tokenVerification.accountId !== params.accountId ||
        tokenVerification.provider !== params.provider ||
        tokenVerification.providerSubject !== params.providerSubject
      ) {
        return {
          success: false,
          code: "INVALID_LINK_TOKEN",
          message: "بيانات رمز التوثيق غير متطابقة مع الحساب المستهدف.",
        };
      }
    }

    // 2. Check if this exact (provider, providerSubject) is already linked to ANY account
    const existingLink = await db
      .select()
      .from(linkedIdentities)
      .where(
        and(
          eq(linkedIdentities.provider, params.provider),
          eq(linkedIdentities.providerSubject, params.providerSubject),
        ),
      )
      .limit(1);

    if (existingLink[0]) {
      if (existingLink[0].accountId === params.accountId) {
        return {
          success: true,
          code: "ALREADY_LINKED",
          message: "الهوية مرتبطة بالفعل بهذا الحساب.",
        };
      }
      return {
        success: false,
        code: "CONFLICT_LINKED_TO_OTHER",
        message: "خطأ تكرار الهوية: هذه الهوية الاجتماعية أو رقم الهاتف مرتبط بحساب آخر بالفعل.",
      };
    }

    // 3. Check if email conflicts with another account (if email provided)
    if (params.email) {
      const emailAcc = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, params.email))
        .limit(1);

      if (emailAcc[0] && emailAcc[0].id !== params.accountId) {
        return {
          success: false,
          code: "EMAIL_IN_USE_REQUIRE_RECOVERY",
          message: "البريد الإلكتروني مستخدم بحساب آخر — لا يمكن الدمج التلقائي دون توثيق ملكية الحساب الأول.",
        };
      }
    }

    // 4. Perform Risk Scan
    const riskScan = redTeamSecurityEngine.scanContentForFraud(
      `Link ${params.provider} sub ${params.providerSubject} email ${params.email || ""}`,
    );

    if (riskScan.riskScore >= 0.8) {
      await eventBus.publish({
        type: "identity.risk_detected",
        entityId: params.accountId,
        payload: { provider: params.provider, subject: params.providerSubject, riskScore: riskScan.riskScore },
        idempotencyKey: `risk_link_${params.accountId}_${Date.now()}`,
        occurredAt: new Date().toISOString(),
      });
      return {
        success: false,
        code: "HIGH_RISK_STEP_UP_REQUIRED",
        message: "تم اكتشاف مؤشر خطورة مرتفع — يلزم إكمال التوثيق الإضافي (Step-Up Verification).",
        requiresStepUp: true,
      };
    }

    // 5. Insert Identity Link
    await db.insert(linkedIdentities).values({
      accountId: params.accountId,
      provider: params.provider,
      providerSubject: params.providerSubject,
      email: params.email,
    });

    // 6. Audit Trail & Events
    await db.insert(auditLog).values({
      actor: "account_user",
      action: "identity_linked",
      targetType: "account",
      targetId: params.accountId,
      reason: `Linked ${params.provider} identity successfully`,
      meta: JSON.stringify({ provider: params.provider, email: params.email }),
    });

    await eventBus.publish({
      type: "identity.linked",
      entityId: params.accountId,
      payload: { provider: params.provider, email: params.email },
      idempotencyKey: `link_${params.accountId}_${params.provider}_${Date.now()}`,
      occurredAt: new Date().toISOString(),
    });

    // Account Takeover Alert Notification
    await notify({
      accountId: params.accountId,
      type: "identity_alert",
      title: "تنبيه أمان: تم ربط وسيلة دخول جديدة",
      body: `تم ربط حسابك بـ (${params.provider}) بنجاح. إذا لم تكن أنت من قام بهذا الإجراء، يُرجى مراجعة الأمان فوراً.`,
      targetId: params.accountId,
    });

    return {
      success: true,
      message: "تم ربط الهوية بنجاح بالحساب.",
    };
  }

  /**
   * Unlink an external provider identity from an account.
   * Strict Rule: CANNOT UNLINK THE LAST REMAINING RECOVERY METHOD.
   */
  public async unlinkIdentity(
    accountId: number,
    provider: IdentityProvider,
    providerSubject: string,
  ): Promise<IdentityActionResult> {
    // 1. Get current linked identities count
    const links = await db
      .select()
      .from(linkedIdentities)
      .where(eq(linkedIdentities.accountId, accountId));

    const targetLink = links.find(
      (l) => l.provider === provider && l.providerSubject === providerSubject,
    );

    if (!targetLink) {
      return {
        success: false,
        message: "الهوية المطلوبة غير مرتبطة بهذا الحساب.",
      };
    }

    // 2. Check if account has alternative recovery method (email password OR remaining linked identities)
    const accRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    const account = accRows[0];
    const remainingLinksCount = links.length - 1;
    const hasPasswordHash = Boolean(account?.passwordHash && account.passwordHash.length > 10);

    if (remainingLinksCount === 0 && !hasPasswordHash) {
      return {
        success: false,
        code: "CANNOT_UNLINK_LAST_METHOD",
        message: "لا يمكن إلغاء ربط وسيلة الدخول الأخيرة — يجب إضافة وسيلة دخول بديلة أولاً لمنع فقدان الحساب.",
      };
    }

    // 3. Delete link
    await db
      .delete(linkedIdentities)
      .where(eq(linkedIdentities.id, targetLink.id));

    // 4. Audit & Events
    await db.insert(auditLog).values({
      actor: "account_user",
      action: "identity_unlinked",
      targetType: "account",
      targetId: accountId,
      reason: `Unlinked ${provider} identity`,
      meta: JSON.stringify({ provider }),
    });

    await eventBus.publish({
      type: "identity.unlinked",
      entityId: accountId,
      payload: { provider },
      idempotencyKey: `unlink_${accountId}_${provider}_${Date.now()}`,
      occurredAt: new Date().toISOString(),
    });

    await notify({
      accountId,
      type: "identity_alert",
      title: "تنبيه أمان: تم إلغاء ربط وسيلة دخول",
      body: `تم إلغاء ربط (${provider}) من حسابك.`,
      targetId: accountId,
    });

    return {
      success: true,
      message: "تم إلغاء ربط الهوية بنجاح.",
      linkedCount: remainingLinksCount,
    };
  }

  /**
   * Safe Admin Account Overview (Hides raw passwords, secrets, OAuth tokens)
   */
  public async getAccountIdentityOverview(accountId: number) {
    const accRows = await db
      .select({
        id: accounts.id,
        email: accounts.email,
        role: accounts.role,
        displayName: accounts.displayName,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!accRows[0]) return null;

    const links = await db
      .select({
        provider: linkedIdentities.provider,
        linkedAt: linkedIdentities.linkedAt,
      })
      .from(linkedIdentities)
      .where(eq(linkedIdentities.accountId, accountId));

    const auditEvents = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.targetType, "account"),
          eq(auditLog.targetId, accountId),
        ),
      )
      .limit(20);

    return {
      account: accRows[0],
      linkedIdentities: links,
      recentAuditTrail: auditEvents,
    };
  }
}

export const identityLinkingService = new IdentityLinkingService();
