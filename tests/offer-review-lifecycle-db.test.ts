import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { createAdminSessionToken } from "../src/lib/auth";
import { PATCH as reviewOffer, PUT as resubmitOffer } from "../src/app/api/offers/[id]/route";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function agentCookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

function adminCookie() {
  const token = createAdminSessionToken();
  assert.ok(token, "admin auth must be configured in the test environment");
  return { cookie: `tj_admin=${encodeURIComponent(token)}` };
}

function offerPayload(suffix: string) {
  return {
    title: `Updated Istanbul package ${suffix}`,
    titleEn: `Updated Istanbul package ${suffix}`,
    description: "A corrected and materially detailed package description that explains the hotel, itinerary, commercial basis, and traveler expectations clearly.",
    tripType: "package",
    originCity: "Cairo",
    destinationCity: "Istanbul",
    destinationCountry: "تركيا",
    destinationCountryEn: "Türkiye",
    priceAmount: 1200,
    currency: "USD",
    priceType: "per_person",
    durationDays: 6,
    maxTravelers: 8,
    includes: ["Hotel", "Airport transfer"],
    excludes: ["Personal expenses"],
  };
}

test("offer review rejection and resubmission remain owned, auditable and race-safe", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    async function createAgent(label: string) {
      const agent = await client.query<{ id: number }>(
        `INSERT INTO agents
          (display_name,latin_name,bio,photo_url,city,country,license_type,license_number,
           verification_status,specialty_tags,languages,response_rate,avg_response_hours,total_trips)
         VALUES ($1,$1,'Review agent','https://example.invalid/review','Cairo','Egypt','agency',$2,
           'verified','{}','{Arabic}',0,0,0) RETURNING id`,
        [label, `REV-${label}-${suffix}`],
      );
      const account = await client.query<{ id: number }>(
        `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
         VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
        [`${label.toLowerCase()}-${suffix}@example.invalid`, label, agent.rows[0]!.id],
      );
      const token = `review-${label}-${suffix}`;
      await client.query(
        `INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
        [token, account.rows[0]!.id],
      );
      return { agentId: agent.rows[0]!.id, token };
    }

    const owner = await createAgent("Owner");
    const outsider = await createAgent("Outsider");
    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,title_en,description,trip_type,origin_city,destination_city,destination_country,
         destination_country_en,duration_days,price_amount,currency,price_type,includes,excludes,
         min_travelers,max_travelers,status,hero_image)
       VALUES ($1,$2,'Initial package','Initial offer awaiting trust review','package','Cairo','Istanbul',
         'تركيا','Türkiye',5,1000,'USD','per_person','{Hotel}','{}',1,6,'pending_review',
         'https://example.invalid/hero') RETURNING id`,
      [owner.agentId, `Initial Istanbul ${suffix}`],
    );
    const offerId = offer.rows[0]!.id;

    const rejected = await reviewOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { ...adminCookie(), "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: "The commercial description needs clearer inclusions and pricing basis." }),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    assert.equal(rejected.status, 200);
    const rejectedRow = await client.query<{ status: string; rejection_reason: string | null }>(
      `SELECT status,rejection_reason FROM offers WHERE id=$1`,
      [offerId],
    );
    assert.equal(rejectedRow.rows[0]!.status, "rejected");
    assert.match(rejectedRow.rows[0]!.rejection_reason ?? "", /commercial description/i);

    const outsiderAttempt = await resubmitOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PUT",
        headers: { ...agentCookie(outsider.token), "content-type": "application/json" },
        body: JSON.stringify(offerPayload(suffix)),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    assert.equal(outsiderAttempt.status, 404, "foreign offer ownership must fail closed");

    const invalidOwnerAttempt = await resubmitOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PUT",
        headers: { ...agentCookie(owner.token), "content-type": "application/json" },
        body: JSON.stringify({ ...offerPayload(suffix), description: "too short" }),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    assert.equal(invalidOwnerAttempt.status, 422);

    const resubmitted = await resubmitOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PUT",
        headers: { ...agentCookie(owner.token), "content-type": "application/json" },
        body: JSON.stringify(offerPayload(suffix)),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    assert.equal(resubmitted.status, 200);
    const pending = await client.query<{ status: string; rejection_reason: string | null; published_at: Date | null; expires_at: Date | null; is_featured: boolean }>(
      `SELECT status,rejection_reason,published_at,expires_at,is_featured FROM offers WHERE id=$1`,
      [offerId],
    );
    assert.deepEqual(pending.rows[0], {
      status: "pending_review",
      rejection_reason: null,
      published_at: null,
      expires_at: null,
      is_featured: false,
    });

    const approveRequest = () => reviewOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { ...adminCookie(), "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    const rejectRequest = () => reviewOffer(
      new Request(`http://local.test/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { ...adminCookie(), "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: "Concurrent moderator rejection with enough detail to be valid." }),
      }),
      { params: Promise.resolve({ id: String(offerId) }) },
    );
    const [decisionA, decisionB] = await Promise.all([approveRequest(), rejectRequest()]);
    assert.deepEqual([decisionA.status, decisionB.status].sort((a, b) => a - b), [200, 409]);

    const finalOffer = await client.query<{ status: string }>(`SELECT status FROM offers WHERE id=$1`, [offerId]);
    assert.ok(["published", "rejected"].includes(finalOffer.rows[0]!.status));

    const audit = await client.query<{ action: string; prev_state: string | null; new_state: string | null }>(
      `SELECT action,prev_state,new_state FROM audit_log WHERE target_type='offer' AND target_id=$1 ORDER BY id`,
      [offerId],
    );
    assert.ok(audit.rows.some((row) => row.action === "offer_resubmitted" && row.prev_state === "rejected" && row.new_state === "pending_review"));
    const finalDecisions = audit.rows.filter((row) => row.prev_state === "pending_review" && ["published", "rejected"].includes(row.new_state ?? ""));
    assert.equal(finalDecisions.length, 1, "only one concurrent moderation decision may commit");
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
