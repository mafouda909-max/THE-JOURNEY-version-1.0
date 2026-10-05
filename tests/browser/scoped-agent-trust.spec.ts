import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

// This scenario writes only to the same isolated local database used by the
// clean Browser QA build. It cannot approve or publish anything in Production.
function localQaDatabase(): string {
  const value = process.env.SERVICE_FULFILLMENT_TEST_DATABASE_URL;
  if (!value || value !== process.env.DATABASE_URL || process.env.SILA_SERVICE_BROWSER_QA !== "true") {
    throw new Error("Scoped trust proof requires explicit isolated Browser QA configuration");
  }
  const url = new URL(value);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
    !["/journey_browser", "/sila_service_browser"].includes(url.pathname)) {
    throw new Error("Scoped trust proof refuses remote or non-QA databases");
  }
  return value;
}

test("scoped trust is private-safe and expiry removes every public entry point", async ({ page, request }, testInfo) => {
  const client = new Client({ connectionString: localQaDatabase() });
  await client.connect();
  let agentId: number | undefined;
  const suffix = randomUUID();
  const privateLicense = `QA-LIC-${suffix.slice(0, 20)}`;
  const privateFilename = `private-identity-${suffix}.pdf`;
  try {
    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name,latin_name,bio,photo_url,city,country,license_type,license_number,
         verification_status,verified_at,specialty_tags,languages,response_rate,avg_response_hours,total_trips)
       VALUES ($1,'Scoped Trust QA','ملف اصطناعي في قاعدة اختبار محلية فقط، وليس وكالة تجارية حقيقية.',
         '/brand/sila-app-icon.svg','القاهرة','مصر','agency',$2,'verified',NOW()-INTERVAL '1 hour',
         '{}','{العربية}',0,0,0) RETURNING id`,
      [`وكالة لاختبار نطاق الثقة ${testInfo.project.name}`, privateLicense],
    );
    agentId = agent.rows[0]!.id;
    for (const type of ["identity", "license", "commercial_register"]) {
      await client.query(
        `INSERT INTO agent_documents
          (agent_id,document_type,storage_key,original_name,status,verified_at,expires_at)
         VALUES($1,$2,$3,$4,'verified',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 day')`,
        [agentId, type, `kyc/agent_${agentId}/${type}_${suffix}.pdf`, privateFilename],
      );
    }
    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,description,trip_type,origin_city,destination_city,destination_country,
         destination_country_en,price_amount,currency,price_type,includes,excludes,status,
         hero_image,published_at,expires_at)
       VALUES ($1,'عرض اصطناعي لاختبار نطاق الثقة محليًا','لا يمثل هذا السجل معروضًا حقيقيًا؛ اختبار محلي معزول فقط.',
         'package','القاهرة','إسطنبول','تركيا','Turkey',17000,'EGP','per_person',
         '{إقامة للاختبار}','{طيران للاختبار}','published','/brand/sila-app-icon.svg',NOW(),NOW()+INTERVAL '1 day')
       RETURNING id`,
      [agentId],
    );
    const offerId = offer.rows[0]!.id;
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    const response = await page.goto(`/agents/${agentId}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    for (const label of ["هوية مُراجَعة", "نشاط مهني مُراجع", "كيان مُراجع"]) {
      await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
    }
    await expect(page.getByText("ما الذي راجعته صلة عن هذا الوكيل؟", { exact: true })).toBeVisible();
    await expect(page.getByText(/راجعناه:/)).toHaveCount(3);
    await expect(page.getByText(/صالح حتى:/)).toHaveCount(3);
    await expect(page.getByText(/ولا تعني اعتماد كل سعر أو فندق أو معلومة سفر/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.screenshot({ path: `test-results/trust-scoped-${testInfo.project.name}.png`, fullPage: true });
    const payload = await (await request.get(`/api/agents/${agentId}`)).json();
    expect(payload.agent.trust.claims.map((claim: { kind: string }) => claim.kind)).toEqual(["identity", "activity", "entity"]);
    const publicText = JSON.stringify(payload) + await page.content();
    for (const secret of [privateLicense, privateFilename, `kyc/agent_${agentId}/`, '"storageKey"', '"licenseNumber"']) {
      expect(publicText).not.toContain(secret);
    }
    expect((await request.get(`/api/offers/${offerId}`)).status()).toBe(200);

    // Keep the agent's historical approved state unchanged. Only the required
    // evidence expires: the source is the eligibility decision, not the badge.
    await client.query(
      "UPDATE agent_documents SET expires_at=NOW()-INTERVAL '1 second' WHERE agent_id=$1 AND document_type='license'",
      [agentId],
    );
    expect((await request.get(`/api/agents/${agentId}`)).status()).toBe(404);
    expect((await request.get(`/api/offers/${offerId}`)).status()).toBe(404);
    const discovery = await (await request.get("/api/offers")).json();
    expect(discovery.offers.some((item: { id: number }) => item.id === offerId)).toBe(false);
    expect(discovery.count).toBe(discovery.offers.length);
    const expiredPage = await page.goto(`/offers/${offerId}`, { waitUntil: "networkidle" });
    expect(expiredPage?.status()).toBe(404);
    const blocked = await request.post("/api/contact-requests", { data: {
      offerId,
      travelerName: "مسافر اختبار محلي",
      travelerEmail: `trust-qa-${suffix}@example.invalid`,
      travelerCount: 1,
      message: "استفسار اصطناعي لاختبار رفض العرض عند انتهاء دليل النشاط.",
    } });
    expect(blocked.status()).toBe(404);
    const inquiries = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM contact_requests WHERE offer_id=$1", [offerId],
    );
    expect(inquiries.rows[0]!.count).toBe("0");
    expect(runtimeErrors).toEqual([]);
  } finally {
    if (agentId) await client.query("DELETE FROM agents WHERE id=$1", [agentId]);
    await client.end();
  }
});
