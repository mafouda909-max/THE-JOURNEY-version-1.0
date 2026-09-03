import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts, linkedIdentities, agentDocuments, agents } from "@/db/schema";

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
  public async evaluateAssurance(accountId: number): Promise<AccountAssuranceSummary> {
    const accRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    const account = accRows[0];
    if (!account) {
      throw new Error(`Account ${accountId} not found for assurance evaluation.`);
    }

    // 1. Query linked identities
    const identities = await db
      .select()
      .from(linkedIdentities)
      .where(eq(linkedIdentities.accountId, accountId));

    const linkedProviders = Array.from(new Set(identities.map((i) => i.provider)));

    // Account has recovery method if email exists or at least 1 provider linked
    const hasRecoveryMethod = Boolean(account.email || linkedProviders.length > 0);

    // 2. Check Business Verification (Agent KYB)
    let isBusinessVerified = false;
    if (account.agentId) {
      const agentRows = await db
        .select()
        .from(agents)
        .where(eq(agents.id, account.agentId))
        .limit(1);
      if (agentRows[0]?.verificationStatus === "verified") {
        isBusinessVerified = true;
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
          ),
        )
        .limit(1);
      if (passportDocs[0]) {
        isIdentityVerified = true;
      }
    }

    // 4. Compute Assurance Level (Age/isAdult NEVER affects this)
    let assuranceLevel: IdentityAssuranceLevel = "UNVERIFIED";

    if (isBusinessVerified && isIdentityVerified && linkedProviders.length >= 2) {
      assuranceLevel = "HIGH_ASSURANCE";
    } else if (isBusinessVerified) {
      assuranceLevel = "BUSINESS_VERIFIED";
    } else if (isIdentityVerified) {
      assuranceLevel = "IDENTITY_VERIFIED";
    } else if (linkedProviders.length > 0 || account.email) {
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
