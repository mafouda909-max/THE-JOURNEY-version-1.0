import { db } from "@/db";
import { accounts, linkedIdentities, auditLog, agents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { identityLinkingService } from "@/lib/identity-linking";
import { identityAssuranceService } from "@/lib/identity-assurance";
import { AIContextAssembly } from "@/lib/ai/context";

async function runIdentityHardeningEvaluation() {
  console.log("===============================================================");
  console.log("THE JOURNEY — IDENTITY ASSURANCE & ACCOUNT LINKING HARDENING TEST");
  console.log("===============================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name: string, condition: boolean, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASSED: ${name}`);
    } else {
      console.error(`  ✗ FAILED: ${name} - ${detail || "Assertion failed"}`);
    }
  }

  // Setup Test Accounts in Database
  const testEmail1 = `identity_test_user_1_${Date.now()}@thejourney.sa`;
  const testEmail2 = `identity_test_user_2_${Date.now()}@thejourney.sa`;

  const [acc1] = await db
    .insert(accounts)
    .values({
      email: testEmail1,
      passwordHash: "", // No password set initially
      role: "traveler",
      displayName: "Traveler One",
    })
    .returning();

  const [acc2] = await db
    .insert(accounts)
    .values({
      email: testEmail2,
      passwordHash: "valid_scrypt_hash_here_12345678901234567890", // Password set
      role: "traveler",
      displayName: "Traveler Two",
    })
    .returning();

  const googleSub1 = `google_sub_11111_${Date.now()}`;
  const googleSub2 = `google_sub_22222_${Date.now()}`;
  const metaSub1 = `meta_sub_33333_${Date.now()}`;

  // -------------------------------------------------------------------
  // TEST 1: Authentication Success & Initial Provider Link
  // -------------------------------------------------------------------
  console.log("1. Testing Identity Linking & Single Identity Mappings...");
  const link1 = await identityLinkingService.linkIdentity({
    accountId: acc1.id,
    provider: "google",
    providerSubject: googleSub1,
    email: testEmail1,
  });
  assertTest("Initial Google Link Success", link1.success === true);

  // -------------------------------------------------------------------
  // TEST 2: Already-Linked Identity (Same Account Idempotency)
  // -------------------------------------------------------------------
  const link1Repeat = await identityLinkingService.linkIdentity({
    accountId: acc1.id,
    provider: "google",
    providerSubject: googleSub1,
    email: testEmail1,
  });
  assertTest("Already-Linked Identity Idempotency", link1Repeat.success === true && link1Repeat.code === "ALREADY_LINKED");

  // -------------------------------------------------------------------
  // TEST 3: Attack Vector — Identity Linked to Another Account
  // -------------------------------------------------------------------
  console.log("\n2. Testing Account-Linking Attack Vectors...");
  const linkAttackOther = await identityLinkingService.linkIdentity({
    accountId: acc2.id,
    provider: "google",
    providerSubject: googleSub1, // Belongs to acc1!
  });
  assertTest(
    "Attack: Link Identity Bound to Another Account Fails Closed",
    linkAttackOther.success === false && linkAttackOther.code === "CONFLICT_LINKED_TO_OTHER",
  );

  // -------------------------------------------------------------------
  // TEST 4: Attack Vector — Duplicate Email Merge Without Proof
  // -------------------------------------------------------------------
  const emailDuplicateAttack = await identityLinkingService.linkIdentity({
    accountId: acc2.id,
    provider: "facebook",
    providerSubject: metaSub1,
    email: testEmail1, // Belongs to acc1!
  });
  assertTest(
    "Attack: Duplicate Email Merge Without Ownership Proof Fails Closed",
    emailDuplicateAttack.success === false && emailDuplicateAttack.code === "EMAIL_IN_USE_REQUIRE_RECOVERY",
  );

  // -------------------------------------------------------------------
  // TEST 5: Attack Vector — Invalid & Expired Linking Tokens
  // -------------------------------------------------------------------
  const invalidTokenResult = await identityLinkingService.linkIdentity({
    accountId: acc2.id,
    provider: "apple",
    providerSubject: "apple_sub_9999",
    linkingToken: "invalid_base64_tampered_token_string",
  });
  assertTest(
    "Attack: Tampered Linking Token Fails Closed",
    invalidTokenResult.success === false && invalidTokenResult.code === "INVALID_LINK_TOKEN",
  );

  const expiredTokenPayload = `${acc2.id}:apple:apple_sub_9999:${Date.now() - 100000}`;
  const expiredTokenSig = "dummy_sig";
  const expiredToken = Buffer.from(`${expiredTokenPayload}:${expiredTokenSig}`).toString("base64url");
  const expiredTokenResult = await identityLinkingService.linkIdentity({
    accountId: acc2.id,
    provider: "apple",
    providerSubject: "apple_sub_9999",
    linkingToken: expiredToken,
  });
  assertTest(
    "Attack: Expired Linking Token Fails Closed",
    expiredTokenResult.success === false && expiredTokenResult.code === "INVALID_LINK_TOKEN",
  );

  // -------------------------------------------------------------------
  // TEST 6: Attack Vector — Unlinking Last Recovery Method
  // -------------------------------------------------------------------
  console.log("\n3. Testing Unlinking Guard & Recovery Methods...");
  // Acc1 has no password and only 1 linked identity (googleSub1).
  const unlinkLastResult = await identityLinkingService.unlinkIdentity(
    acc1.id,
    "google",
    googleSub1,
  );
  assertTest(
    "Attack: Unlinking Last Recovery Method Fails Closed",
    unlinkLastResult.success === false && unlinkLastResult.code === "CANNOT_UNLINK_LAST_METHOD",
  );

  // Link a second provider to acc1 first, then unlink googleSub1 successfully
  await identityLinkingService.linkIdentity({
    accountId: acc1.id,
    provider: "facebook",
    providerSubject: metaSub1,
  });
  const unlinkSecondResult = await identityLinkingService.unlinkIdentity(
    acc1.id,
    "google",
    googleSub1,
  );
  assertTest(
    "Unlinking Provider With Remaining Backup Method Succeeds",
    unlinkSecondResult.success === true,
  );

  // -------------------------------------------------------------------
  // TEST 7: Identity Assurance Levels Evaluation
  // -------------------------------------------------------------------
  console.log("\n4. Testing Identity Assurance Framework...");
  const assuranceAcc1 = await identityAssuranceService.evaluateAssurance(acc1.id);
  assertTest(
    "Assurance Evaluation: BASIC for linked provider account",
    assuranceAcc1.assuranceLevel === "BASIC" && assuranceAcc1.hasRecoveryMethod === true,
  );

  // -------------------------------------------------------------------
  // TEST 8: AI Context Privacy Minimization Test
  // -------------------------------------------------------------------
  console.log("\n5. Testing AI Context Sanitization & Privacy Minimization...");
  const rawProfilePayload = {
    name: "John Doe",
    id: "meta_app_scoped_id_98765",
    age_range: { min: 30, max: 40 },
    birthday: "01/01/1990",
    email: "john.doe.secret@private.com",
    phone: "+966500000000",
  };

  const sanitizedContext = AIContextAssembly.sanitizeExternalProfile(rawProfilePayload);
  const contextStr = JSON.stringify(sanitizedContext);

  assertTest(
    "Privacy: No Meta/Google/Apple Provider ID in LLM Context",
    !contextStr.includes("meta_app_scoped_id_98765"),
  );
  assertTest(
    "Privacy: No Raw Birthdate in LLM Context",
    !contextStr.includes("01/01/1990"),
  );
  assertTest(
    "Privacy: No Email or Phone in LLM Context",
    !contextStr.includes("john.doe.secret@private.com") && !contextStr.includes("+966500000000"),
  );
  assertTest(
    "Safety: Age Attributes Derived Safely (isAdult: true, ageBracket: ADULT_25_64)",
    sanitizedContext.isAdult === true && sanitizedContext.ageBracket === "ADULT_25_64",
  );

  // Clean up test rows
  await db.delete(linkedIdentities).where(eq(linkedIdentities.accountId, acc1.id));
  await db.delete(linkedIdentities).where(eq(linkedIdentities.accountId, acc2.id));
  await db.delete(accounts).where(eq(accounts.id, acc1.id));
  await db.delete(accounts).where(eq(accounts.id, acc2.id));

  console.log("\n===============================================================");
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("===============================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runIdentityHardeningEvaluation().catch((err) => {
  console.error("Identity Evaluation Failed:", err);
  process.exit(1);
});
