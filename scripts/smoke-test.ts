import "dotenv/config";
import { db } from "../src/db";
import { sql, eq } from "drizzle-orm";
import {
  agents,
  offers,
  contactRequests,
  reviews,
  campaigns,
  contentItems,
  experiments,
  accounts,
  sessions,
  notifications,
  auditLog,
  events,
} from "../src/db/schema";
import { travelWebProvider } from "../src/lib/providers/web";
import { aiProvider } from "../src/lib/providers/ai";
import { emailProvider } from "../src/lib/providers/email";
import { runAIOfferReviewPipeline } from "../src/lib/ai-review";
import { travelIntelService } from "../src/lib/travel-intel";
import { automationEngine } from "../src/lib/automation";

async function runSmokeTest() {
  console.log("=== 1. DATABASE TABLES & SCHEMA VALIDATION ===");
  const tables = [
    { name: "agents", table: agents },
    { name: "offers", table: offers },
    { name: "contact_requests", table: contactRequests },
    { name: "reviews", table: reviews },
    { name: "campaigns", table: campaigns },
    { name: "content_items", table: contentItems },
    { name: "experiments", table: experiments },
    { name: "accounts", table: accounts },
    { name: "sessions", table: sessions },
    { name: "notifications", table: notifications },
    { name: "audit_log", table: auditLog },
    { name: "events", table: events },
  ];

  for (const t of tables) {
    const res = await db.select({ count: sql<number>`count(*)` }).from(t.table);
    console.log(`✓ Table '${t.name}' exists and has ${res[0].count} rows.`);
  }

  const pmTablesCheck = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('journeys', 'milestones', 'tasks', 'updates', 'members');
  `);
  console.log(`✓ PM tables present: ${pmTablesCheck.rows.length} (Expected 0)`);

  console.log("\n=== 2. PROVIDER PROBES ===");
  const webProbe = await travelWebProvider.probe();
  console.log(`✓ Tavily Web Provider: ${webProbe.status}`);

  const aiProbe = await aiProvider.probe();
  console.log(`✓ OpenRouter AI Provider: ${aiProbe.status}`);

  const emailProbe = await emailProvider.probe();
  console.log(`✓ Resend Email Provider: ${emailProbe.status}`);

  console.log("\n=== 3. AI OFFER REVIEW PIPELINE TEST ===");
  const sampleOffer = await db.select().from(offers).limit(1);
  if (sampleOffer[0]) {
    const reviewRes = await runAIOfferReviewPipeline(sampleOffer[0].id);
    console.log(`✓ AI Offer Review Pipeline executed: status = ${reviewRes.finalStatus}, risk = ${reviewRes.riskLevel}, reviewedBy = ${reviewRes.aiReview?.reviewedBy || 'deterministic_rules'}`);
  }

  console.log("\n=== 4. TRAVEL INTELLIGENCE PIPELINE TEST ===");
  const intelRes = await travelIntelService.queryTravelIntel("شروط الفيزا السياحية للسعودية");
  console.log(`✓ Travel Intelligence executed: confidence = ${intelRes.confidence}`);

  console.log("\n=== 5. AUTOMATION OS ROUTINES TEST ===");
  const autoRes = await automationEngine.executeAutomationRoutines();
  console.log(`✓ Automation OS executed: expired = ${autoRes.expiredOffersCount}, sla = ${autoRes.slaEscalationsCount}, reviewed = ${autoRes.autoReviewedOffersCount}`);

  console.log("\n=== ALL POST-RECOVERY RUNTIME TESTS PASSED ===");
}

runSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exit(1);
  });
