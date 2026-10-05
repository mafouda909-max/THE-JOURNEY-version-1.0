import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { pool } from "../src/db";
import {
  executeCommercialCommand,
  type CommercialActor,
} from "../src/lib/commercial-service";
import {
  prepareQuoteDelivery,
  activateQuoteDelivery,
} from "../src/lib/quote-delivery-agent";
import { respondToQuoteDelivery } from "../src/lib/quote-delivery-public";
import { PASSWORD_PILOT_MIGRATIONS } from "../src/lib/password-auth-schema";

// Synthetic fixtures only. Refuse any remote or non-QA database before writing.
const databaseUrl = process.env.SERVICE_FULFILLMENT_TEST_DATABASE_URL;
if (
  !databaseUrl ||
  databaseUrl !== process.env.DATABASE_URL ||
  process.env.SILA_SERVICE_BROWSER_QA !== "true"
)
  throw new Error("Explicit isolated browser-QA configuration is required.");
const url = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !["/journey_browser", "/sila_service_browser"].includes(url.pathname)
)
  throw new Error("Browser fixtures require a local QA database.");

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of [
      "production_schema.sql",
      "phase1_agency_foundation.sql",
      "phase2_agency_commercial_domain.sql",
      "phase3_supply_freshness_integrity.sql",
      "phase4_quote_delivery_integrity.sql",
      "phase5_quote_delivery_loop.sql",
      "service_fulfillment_pilot.sql",
    ])
      await client.query(readFileSync(`db/${file}`, "utf8"));
    const existing = await client.query(
      `SELECT COUNT(*)::integer AS count FROM agency_workspaces`,
    );
    assert.equal(
      existing.rows[0].count,
      0,
      "Use a fresh QA database; this script never resets real data.",
    );
    const accountsBefore = await client.query(
      "SELECT COUNT(*)::integer AS count FROM accounts",
    );
    assert.equal(
      accountsBefore.rows[0].count,
      0,
      "Account upgrade simulation requires an empty isolated QA database.",
    );
    // Exercise the legacy production prerequisite before browser signup, rather
    // than testing only a fresh schema that already contains the ownership column.
    await client.query(
      "ALTER TABLE contact_requests DROP COLUMN traveler_account_id",
    );
    for (let pass = 0; pass < 2; pass += 1) {
      for (const migration of PASSWORD_PILOT_MIGRATIONS)
        await client.query(readFileSync(migration, "utf8"));
    }
    const suffix = randomUUID().slice(0, 12);
    const fixtures = [];
    for (const [index, project] of [
      "desktop-chromium",
      "mobile-chromium",
    ].entries()) {
      const name = `مكتب اختبار ${index + 1}`;
      const agent = await client.query(
        `INSERT INTO agents(display_name,latin_name,bio,photo_url,city,country,license_type,license_number,verification_status,specialty_tags,languages) VALUES($1,'QA only','Synthetic browser fixture','https://example.invalid/qa','Cairo','Egypt','agency',$2,'in_review','{}','{Arabic}') RETURNING id`,
        [name, `QA-${index}-${suffix}`],
      );
      const owner = await client.query(
        `INSERT INTO accounts(email,password_hash,role,display_name,agent_id) VALUES($1,'disabled$qa','agent',$2,$3) RETURNING id`,
        [`office-${index}-${suffix}@example.invalid`, name, agent.rows[0].id],
      );
      const partnerEmail = `partner-${index}-${suffix}@example.invalid`;
      const partner = await client.query(
        `INSERT INTO accounts(email,password_hash,role,display_name) VALUES($1,'disabled$qa','traveler','شريك اختبار') RETURNING id`,
        [partnerEmail],
      );
      const outsider = await client.query(
        `INSERT INTO accounts(email,password_hash,role,display_name) VALUES($1,'disabled$qa','traveler','حساب اختبار خارجي') RETURNING id`,
        [`outsider-${index}-${suffix}@example.invalid`],
      );
      const workspace = await client.query(
        `INSERT INTO agency_workspaces(agent_id,name) VALUES($1,$2) RETURNING id`,
        [agent.rows[0].id, name],
      );
      const workspaceId = Number(workspace.rows[0].id);
      assert.equal(
        workspaceId,
        index + 1,
        "Fresh QA workspaces must match the explicit 1,2 pilot allowlist.",
      );
      await client.query(
        `INSERT INTO agency_memberships(workspace_id,account_id,role) VALUES($1,$2,'owner')`,
        [workspaceId, owner.rows[0].id],
      );
      const ownerToken = randomUUID();
      const partnerToken = randomUUID();
      const outsiderToken = randomUUID();
      for (const [token, accountId] of [
        [ownerToken, owner.rows[0].id],
        [partnerToken, partner.rows[0].id],
        [outsiderToken, outsider.rows[0].id],
      ])
        await client.query(
          `INSERT INTO sessions(token,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '2 hours')`,
          [token, accountId],
        );
      const actor: CommercialActor = {
        accountId: Number(owner.rows[0].id),
        agentId: Number(agent.rows[0].id),
        workspaceId,
        membershipRole: "owner",
      };
      const opportunity = await executeCommercialCommand(actor, {
        command: "create_opportunity",
        source: "manual",
        client: {
          displayName: "عميل اختبار خاص",
          email: `private-customer-${index}-${suffix}@example.invalid`,
        },
        intent: {
          originCity: "Cairo",
          destinations: ["Istanbul"],
          travelers: { adults: 1, children: 0, infants: 0 },
        },
      });
      assert.equal(opportunity.status, 201, JSON.stringify(opportunity.body));
      const opportunityId = Number(
        (opportunity.body.opportunity as Record<string, unknown>).id,
      );
      const observedAt = new Date().toISOString();
      const source = await executeCommercialCommand(actor, {
        command: "record_supplier_option",
        opportunityId,
        category: "other",
        supplierName: "شريك اختبار",
        description: "خدمة مستندات للاختبار فقط",
        currency: "EGP",
        costAmountMinor: 135000,
        commissionExpectedMinor: 0,
        sourceType: "contract",
        sourceRef: "QA-CONTRACT",
        observedAt,
      });
      assert.equal(source.status, 201, JSON.stringify(source.body));
      const sourceRow = source.body.supplierOption as Record<string, unknown>;
      const quote = await executeCommercialCommand(actor, {
        command: "create_quote_version",
        opportunityId,
        validUntil: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        clientFacingTerms: "شروط اختبار فقط",
        lines: [
          {
            kind: "other",
            label: "خدمة مستندات للاختبار",
            quantity: 1,
            currency: "EGP",
            costUnitMinor: 135000,
            sellUnitMinor: 170000,
            commissionExpectedMinor: 0,
            supplierOptionId: Number(sourceRow.id),
            provenance: {
              sourceType: "contract",
              sourceRef: "QA-CONTRACT",
              observedAt: new Date(String(sourceRow.observedAt)).toISOString(),
              validUntil: null,
            },
          },
        ],
      });
      assert.equal(quote.status, 201, JSON.stringify(quote.body));
      const quoteVersionId = Number(
        (quote.body.quoteVersion as Record<string, unknown>).id,
      );
      const delivery = await prepareQuoteDelivery(
        { workspaceId, accountId: actor.accountId },
        {
          quoteId: Number(quote.body.quoteId),
          quoteVersionId,
          channel: "manual",
        },
      );
      assert.equal(delivery.status, 201, JSON.stringify(delivery.body));
      const token = String(delivery.body.activationToken);
      assert.equal(
        (
          await activateQuoteDelivery(
            { workspaceId, accountId: actor.accountId },
            { token },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await respondToQuoteDelivery(token, {
            response: "approved",
            message: "QA approval",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await executeCommercialCommand(actor, {
            command: "record_outcome",
            opportunityId,
            outcome: "won",
            quoteVersionId,
          })
        ).status,
        200,
      );
      // Workspace fixtures are isolated QA records. No public offers are seeded.
      const workspaceAgentName = `وكيل معتمد للاختبار ${index + 1}`;
      const workspaceAgent = await client.query(
        `INSERT INTO agents(display_name,latin_name,bio,photo_url,city,country,license_type,verification_status,verified_at,specialty_tags,languages) VALUES($1,'SILA QA Agent','ملف اصطناعي للاختبارات فقط، لا يمثل وكيلًا أو نشاطًا تجاريًا حقيقيًا.','/brand/sila-app-icon.svg','القاهرة','مصر','individual','verified',NOW(),'{}','{العربية}') RETURNING id`,
        [workspaceAgentName],
      );
      const workspaceAgentId = Number(workspaceAgent.rows[0].id);
      for (const documentType of ["identity", "license"]) {
        await client.query(
          `INSERT INTO agent_documents
            (agent_id,document_type,storage_key,original_name,status,verified_at,expires_at)
           VALUES($1,$2,$3,$4,'verified',NOW(),NOW()+INTERVAL '1 year')`,
          [workspaceAgentId, documentType, `kyc/agent_${workspaceAgentId}/${documentType}_browser-qa.pdf`, `${documentType}-browser-qa.pdf`],
        );
      }
      const workspaceOwner = await client.query(
        `INSERT INTO accounts(email,password_hash,role,display_name,agent_id) VALUES($1,'disabled$qa','agent',$2,$3) RETURNING id`,
        [
          `workspace-${index}-${suffix}@example.invalid`,
          workspaceAgentName,
          workspaceAgentId,
        ],
      );
      const workspaceAccountId = Number(workspaceOwner.rows[0].id);
      const workspaceToken = randomUUID();
      await client.query(
        `INSERT INTO sessions(token,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '2 hours')`,
        [workspaceToken, workspaceAccountId],
      );
      let workspaceRequestId = 0;
      for (let row = 1; row <= 23; row += 1) {
        const offer = await client.query(
          `INSERT INTO offers(agent_id,title,description,trip_type,origin_city,destination_city,destination_country,destination_country_en,price_amount,currency,price_type,includes,excludes,status,hero_image) VALUES($1,$2,'تفاصيل اصطناعية خاصة لاختبار مساحة الوكيل، ولا تمثل عرض سفر حقيقيًا.','package','القاهرة','إسطنبول','تركيا','Turkey',17000,'EGP','per_person','{إقامة للاختبار}','{طيران للاختبار}','pending_review','/brand/sila-app-icon.svg') RETURNING id`,
          [workspaceAgentId, `عرض اختبار خاص ${index + 1}: رقم ${row}`],
        );
        const inquiry = await client.query(
          `INSERT INTO contact_requests(offer_id,agent_id,traveler_name,traveler_email,message,traveler_count,status) VALUES($1,$2,$3,$4,$5,2,'new') RETURNING id`,
          [
            offer.rows[0].id,
            workspaceAgentId,
            `مسافر خاص للاختبار ${index + 1}: رقم ${row}`,
            `private-inquiry-${index}-${row}@example.invalid`,
            `رسالة خاصة لحساب اختبار ${index + 1}، طلب رقم ${row}.`,
          ],
        );
        workspaceRequestId = Number(inquiry.rows[0].id);
        await client.query(
          `INSERT INTO notifications(account_id,type,title,body,idempotency_key) VALUES($1,'contact',$2,'تنبيه اصطناعي خاص بحساب الاختبار، وليس رسالة من مستخدم حقيقي.',$3)`,
          [
            workspaceAccountId,
            `إشعار خاص للاختبار ${index + 1}: رقم ${row}`,
            `qa-workspace-${index}-${suffix}-${row}`,
          ],
        );
      }
      fixtures.push({
        project,
        workspaceId,
        opportunityId,
        ownerToken,
        partnerToken,
        outsiderToken,
        partnerEmail,
        workspaceAgentId,
        workspaceAgentName,
        workspaceAccountId,
        workspaceToken,
        workspaceRequestId,
      });
    }
    writeFileSync(".service-browser-fixture.json", JSON.stringify(fixtures), {
      mode: 0o600,
    });
    console.log(
      "Created two synthetic fulfillment browser fixtures in the isolated QA database.",
    );
  } finally {
    await pool.end();
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
