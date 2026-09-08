import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  linkedIdentities,
  agentDocuments,
  agents,
} from "@/db/schema";

/**
 * IDENTITY ASSURANCE FRAMEWORK
 *
 * Explicit distinction between:
 *   1. Authentication (session token / OAuth proof)
 *   2. Identity Verification (government ID / passport verification)
 *   3. Business Verification (commercial registry / travel agency license KYB)
 *   4. Trust (computed reputation & zero risk signals)
 *
 * Strict Rule: Age information or `isAdult` flag MUST NEVER be used as proof of identity or assurance level.
 */

export type IdentityAssuranceLevel =
  | "UNVERIFIED"
  | "BASIC"
  | "IDENTITY_VERIFIED"
  | "BUSINESS_VERIFIED"
  | "HIGH_ASSURANCE";

export interface AccountAssuranceSummary {
  accountId: number;
  email: string;
  role: string;
  assuranceLevel: IdentityAssuranceLevel;
  linkedProviders: string[];
  isIdentityVerified: boolean;
  isBusinessVerified: boolean;
  hasRecoveryMethod: boolean;
  rejectionOrRiskNotes?: string;
}

export class IdentityAssuranceService {
  /**
   * Evaluate the identity assurance level for a given account.
   */
  public async evaluateAssurance(
    accountId: number,
  ): Promise<AccountAssuranceSummary> {
    const accRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    const account = accRows[0];
    if (!account) {
      throw new Error(
        `Account ${accountId} not found for assurance evaluation.`,
      );
    }

    // 1. Query linked identities
    const identities = await db
      .select()
      .from(linkedIdentities)
      .where(eq(linkedIdentities.accountId, accountId));

    const linkedProviders = Array.from(
      new Set(identities.map((i) => i.provider)),
    );

    // Only verified email is established as a recovery destination.
    const hasRecoveryMethod = Boolean(account.emailVerifiedAt);

    // 2. Check Business Verification (Agent KYB)
    let isBusinessVerified = false;
    if (account.agentId) {
      const agentRows = await db
        .select()
        .from(agents)
        .where(eq(agents.id, account.agentId))
        .limit(1);
      if (
        agentRows[0]?.verificationStatus === "verified" &&
        agentRows[0].verifiedAt &&
        agentRows[0].licenseType === "agency"
      ) {
        const businessDocs = await db
          .select({ id: agentDocuments.id })
          .from(agentDocuments)
          .where(
            and(
              eq(agentDocuments.agentId, account.agentId),
              eq(agentDocuments.status, "verified"),
              sql`${agentDocuments.verifiedAt} IS NOT NULL`,
              sql`${agentDocuments.documentType} IN ('commercial_register', 'license_cert')`,
              sql`(${agentDocuments.expiresAt} IS NULL OR ${agentDocuments.expiresAt} > now())`,
            ),
          )
          .limit(1);
        isBusinessVerified = businessDocs.length > 0;
      }
    }

    // 3. Check Personal Identity Verification (KYC Documents e.g. passport_id)
    let isIdentityVerified = false;
    if (account.agentId) {
      const passportDocs = await db
        .select()
        .from(agentDocuments)
        .where(
          and(
            eq(agentDocuments.agentId, account.agentId),
            eq(agentDocuments.documentType, "passport_id"),
            eq(agentDocuments.status, "verified"),
            sql`${agentDocuments.verifiedAt} IS NOT NULL`,
            sql`(${agentDocuments.expiresAt} IS NULL OR ${agentDocuments.expiresAt} > now())`,
          ),
        )
        .limit(1);
      if (passportDocs.length > 0) {
        isIdentityVerified = true;
      }
    }

    // 4. Compute Assurance Level (Age/isAdult NEVER affects this)
    let assuranceLevel: IdentityAssuranceLevel = "UNVERIFIED";

    if (
      isBusinessVerified &&
      isIdentityVerified &&
      linkedProviders.length >= 2
    ) {
      assuranceLevel = "HIGH_ASSURANCE";
    } else if (isBusinessVerified) {
      assuranceLevel = "BUSINESS_VERIFIED";
    } else if (isIdentityVerified) {
      assuranceLevel = "IDENTITY_VERIFIED";
    } else if (account.emailVerifiedAt) {
      assuranceLevel = "BASIC";
    }

    return {
      accountId: account.id,
      email: account.email,
      role: account.role,
      assuranceLevel,
      linkedProviders,
      isIdentityVerified,
      isBusinessVerified,
      hasRecoveryMethod,
    };
  }
}

export const identityAssuranceService = new IdentityAssuranceService();
