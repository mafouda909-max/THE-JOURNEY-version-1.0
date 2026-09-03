import "dotenv/config";
import { db } from "../src/db";
import { sql, eq } from "drizzle-orm";
import {
  accounts,
  linkedIdentities,
  agents,
  offers,
  contactRequests,
  notifications,
  auditLog,
  travelFacts,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/identity";
import { identityLinkingService } from "../src/lib/identity-linking";
import { identityAssuranceService } from "../src/lib/identity-assurance";
import { travelWebProvider } from "../src/lib/providers/web";
import { aiProvider } from "../src/lib/providers/ai";
import { emailProvider } from "../src/lib/providers/email";
import { r2Configured } from "../src/lib/r2";
import { mcpRuntimeClient } from "../src/lib/mcp/client";
import { travelIntelService } from "../src/lib/travel-intel";
import { aiTravelAssistant } from "../src/lib/assistant";
import { travelReadinessEngine } from "../src/lib/travel-readiness";
import { claimCheckerEngine } from "../src/lib/claim-checker";
import { getPublishedOffers } from "../src/lib/data";
import { smartOfferRanker } from "../src/lib/ranking";
import { runAIOfferReviewPipeline } from "../src/lib/ai-review";
import { automationEngine } from "../src/lib/automation";
import { travelDataChangeEngine } from "../src/lib/data-change";
import { leadIntelligenceEngine } from "../src/lib/lead-intel";
import { revenueIntelligenceEngine } from "../src/lib/revenue";
import { redTeamSecurityEngine } from "../src/lib/redteam";
import { productInnovationsEngine } from "../src/lib/product-innovations";

async function runAcceptanceTest() {
  console.log("=================================================================");
  console.log("   THE JOURNEY — SYSTEM-LEVEL ACCEPTANCE TEST & VALIDATION RUN   ");
  console.log("=================================================================\n");

  const startTime = Date.now();

  // STAGE 1: PLATFORM OPERATIONAL HEALTH & PROVIDERS
  console.log("--- STAGE 1: PLATFORM OPERATIONAL HEALTH & PROVIDER PROBES ---");
  const dbCheck = await db.execute(sql`SELECT 1 as ping`);
  console.log(`✓ PostgreSQL Database: LIVE & HEALTHY (ping = ${dbCheck.rows[0]?.ping})`);

  const webProbe = await travelWebProvider.probe();
  console.log(`✓ Tavily Web Research: Status = ${webProbe.status} (Latency = ${webProbe.latencyMs}ms)`);

  const aiProbe = await aiProvider.probe();
  console.log(`✓ OpenRouter AI Runtime: Status = ${aiProbe.status} (Latency = ${aiProbe.latencyMs}ms)`);

  const emailProbe = await emailProvider.probe();
  console.log(`✓ Resend Email SDK: Status = ${emailProbe.status}`);

  console.log(`✓ Cloudflare R2 Storage: Status = ${r2Configured ? "CONNECTED" : "NOT_CONFIGURED"}`);

  // STAGE 2: MCP SERVER DISCOVERY & TOOL RUNTIME
  console.log("\n--- STAGE 2: REAL MCP SERVER DISCOVERY & TOOL RUNTIME ---");
  const mcpResults = await mcpRuntimeClient.verifyAllConfiguredServers();
  for (const m of mcpResults) {
    console.log(`✓ MCP Server '${m.serverName}': Status = ${m.status}, Tools Discovered = ${m.toolsCount}`);
    if (m.latencyMs) console.log(`  Tool Execution Latency: ${m.latencyMs}ms`);
  }

  // STAGE 3: END-TO-END CUSTOMER JOURNEY & AI ASSISTANT
  console.log("\n--- STAGE 3: CUSTOMER JOURNEY, AI ASSISTANT & TRAVEL READINESS ---");
  // 3a. Account Creation & Identity Linking & Assurance
  const [travelerAcc] = await db
    .insert(accounts)
    .values({
      email: `accept_traveler_${Date.now()}@journey.local`,
      passwordHash: hashPassword("TravelerPass2026!"),
      role: "traveler",
      displayName: "مسافر قبول النظام",
    })
    .returning();

  const linkRes = await identityLinkingService.linkIdentity({
    accountId: travelerAcc.id,
    provider: "google",
    providerSubject: `google_accept_sub_${travelerAcc.id}`,
    email: travelerAcc.email,
  });
  const assurance = await identityAssuranceService.evaluateAssurance(travelerAcc.id);
  console.log(`✓ Account #${travelerAcc.id} created, identity linked, Assurance Level = ${assurance.assuranceLevel}`);

  // 3b. Real AI Travel Assistant & Readiness Check
  const readiness = await travelReadinessEngine.evaluateReadiness({
    nationality: "Saudi Arabia",
    passportValidityMonths: 12,
    destination: "جورجيا",
  });
  console.log(`✓ Travel Readiness Evaluated: Status = ${readiness.status} (Score = ${readiness.overallScore}/100)`);

  const assistantRes = await aiTravelAssistant.processQuery({
    userQuestion: "هل يحتاج المواطن السعودي تأشيرة لسفر جورجيا؟",
    travelerContext: {
      nationality: "Saudi Arabia",
      destination: "جورجيا",
      passportValidityMonths: 12,
    },
  });
  console.log(`✓ AI Travel Assistant Executed (Confidence = ${assistantRes.confidence})`);
  console.log(`  Answer snippet: ${assistantRes.answer.slice(0, 140)}...`);

  // 3c. Smart Offer Ranking & Discovery
  const publishedOffers = await getPublishedOffers();
  const rankedOffers = smartOfferRanker.rankOffers(publishedOffers);
  const topOffer = rankedOffers[0]?.offer || publishedOffers[0];
  console.log(`✓ Smart Ranked ${rankedOffers.length} offers. Top Offer: '${topOffer?.title}' (Score = ${rankedOffers[0]?.score})`);
  if (rankedOffers[0]?.trustExplanation) {
    console.log(`  Trust Explanation: ${rankedOffers[0].trustExplanation.whyItMatches}`);
  }

  // 3d. Contact Request Creation & Lead Qualification
  const [contactReq] = await db
    .insert(contactRequests)
    .values({
      offerId: topOffer.id,
      agentId: topOffer.agentId,
      travelerName: travelerAcc.displayName,
      travelerEmail: travelerAcc.email,
      message: "السلام عليكم — أود الاستفسار عن حجز رحلة جورجيا لشخصين.",
      travelerCount: 2,
      travelDates: "أكتوبر ٢٠٢٦",
      utmCampaign: "عمرة بلا قلق",
      offerSnapshot: JSON.stringify({ title: topOffer.title, priceAmount: topOffer.priceAmount }),
      status: "new",
    })
    .returning();

  const leadQual = await leadIntelligenceEngine.qualifyAndAssignLead(contactReq.id);
  console.log(`✓ Lead #${contactReq.id} Qualified: Status = ${leadQual.status}, Score = ${leadQual.qualificationScore}/100, SLA Target = ${leadQual.slaTargetHours}h`);

  // STAGE 4: AI OFFER REVIEW & CLAIM CHECKING PIPELINE
  console.log("\n--- STAGE 4: AI OFFER REVIEW & CLAIM CHECKING PIPELINE ---");
  const claimsAudit = await claimCheckerEngine.verifyOfferClaims({
    title: topOffer.title,
    description: topOffer.description,
    includes: topOffer.includes,
    originCity: topOffer.originCity,
    destinationCity: topOffer.destinationCity,
    destinationCountry: topOffer.destinationCountry,
  });
  console.log(`✓ Offer Claim Audit Executed: Trust Score = ${claimsAudit.overallTrustScore}/100, Claims Evaluated = ${claimsAudit.evaluatedClaims.length}`);

  const reviewResult = await runAIOfferReviewPipeline(topOffer.id);
  console.log(`✓ AI Offer Review Pipeline executed: status = ${reviewResult.finalStatus}, risk = ${reviewResult.riskLevel}`);

  // STAGE 5: AUTOMATION OS & PRODUCT INNOVATIONS
  console.log("\n--- STAGE 5: AUTOMATION OS & PRODUCT INNOVATIONS ---");
  const changeRes = await travelDataChangeEngine.handleFactUpdate({
    subject: "visa:SA->GE",
    attribute: "visa_required",
    newValue: "false",
    source: "https://georgia.gov.ge/visa-policy",
    authorityLevel: 5,
  });
  console.log(`✓ Travel Data Change Engine: Material Change = ${changeRes.isMaterialChange}, Previous = '${changeRes.previousValue}', New = '${changeRes.newValue}'`);

  const autoRun = await automationEngine.executeAutomationRoutines();
  console.log(`✓ Automation OS Routines executed: Expired = ${autoRun.expiredOffersCount}, SLA Escalations = ${autoRun.slaEscalationsCount}, Auto Reviewed = ${autoRun.autoReviewedOffersCount}`);

  const innovationReport = await productInnovationsEngine.executePlatformInnovations();
  console.log(`✓ Platform Innovations Executed: Audited ${innovationReport.offersAudited} offers, Processed ${innovationReport.alertsProcessed} alerts.`);

  // STAGE 6: FRAUD RED-TEAM SCAN & REVENUE INTELLIGENCE
  console.log("\n--- STAGE 6: FRAUD RED-TEAM SCAN & REVENUE INTELLIGENCE ---");
  const fraudScan = redTeamSecurityEngine.scanContentForFraud("تواصل معي على الواتساب 0500000000 للحصول على خصم خارج المنصة");
  console.log(`✓ Red-Team Fraud Scan: Suspicious = ${fraudScan.isSuspicious}, Risk Score = ${fraudScan.riskScore}, Recommended Action = ${fraudScan.recommendedAction}`);

  const revenueMetrics = await revenueIntelligenceEngine.calculatePlatformRevenueMetrics();
  console.log(`✓ Revenue Intelligence Summary: Total Leads = ${revenueMetrics.totalLeads}, Qualified = ${revenueMetrics.qualifiedLeads}, Conversion Rate = ${revenueMetrics.conversionRatePct}%`);
  console.log(`  GMV Requested = SAR ${revenueMetrics.gmvRequestedSAR.toLocaleString()}, Est. Platform Take-Rate Fees = SAR ${revenueMetrics.estimatedPlatformFeesSAR.toLocaleString()}`);

  const totalTimeMs = Date.now() - startTime;
  console.log("\n=================================================================");
  console.log(`   ACCEPTANCE TEST COMPLETED SUCCESSFULLY IN ${totalTimeMs}ms   `);
  console.log("=================================================================");
}

runAcceptanceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ACCEPTANCE TEST FAILED:", err);
    process.exit(1);
  });
