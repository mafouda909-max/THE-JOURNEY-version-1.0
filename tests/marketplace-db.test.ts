import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import {
  getAgentById,
  getDestinations,
  getFeaturedOffers,
  getOfferById,
  getPublishedOffers,
} from "../src/lib/data";

const databaseUrl = process.env.MARKETPLACE_TEST_DATABASE_URL;

test("public marketplace data helpers enforce current trust and expiry", { skip: !databaseUrl }, async (t) => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));

    async function createAgent(label: string, verificationStatus: string) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO agents
          (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
           verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
         VALUES ($1, $1, 'Marketplace DB test profile', 'https://example.invalid/photo', 'Cairo', 'Egypt',
           'agency', $2, $3, '{}', '{Arabic}', 90, 2, 25)
         RETURNING id`,
        [label, `LIC-${label}`, verificationStatus],
      );
      return inserted.rows[0]!.id;
    }

    async function createOffer(
      agentId: number,
      label: string,
      options: { status?: string; expires?: "future" | "past" | "none"; featured?: boolean } = {},
    ) {
      const expiresAt = options.expires === "past"
        ? new Date(Date.now() - 60_000)
        : options.expires === "none"
          ? null
          : new Date(Date.now() + 86_400_000);
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO offers
          (agent_id, title, description, trip_type, origin_city, destination_city,
           destination_country, destination_country_en, price_amount, currency, price_type,
           includes, excludes, status, hero_image, is_featured, published_at, expires_at)
         VALUES ($1, $2, 'A sufficiently detailed marketplace test offer', 'package', 'Cairo', 'Istanbul',
           'تركيا', 'Turkey', 25000, 'EGP', 'per_person', '{hotel}', '{}', $3,
           'https://example.invalid/offer.jpg', $4, NOW(), $5)
         RETURNING id`,
        [agentId, label, options.status ?? "published", options.featured ?? false, expiresAt],
      );
      return inserted.rows[0]!.id;
    }

    const verifiedAgent = await createAgent("Verified", "verified");
    const suspendedAgent = await createAgent("Suspended", "suspended");
    const reviewAgent = await createAgent("InReview", "in_review");

    const active = await createOffer(verifiedAgent, "Active verified offer", { featured: true });
    const activeSecond = await createOffer(verifiedAgent, "Second active offer");
    const expired = await createOffer(verifiedAgent, "Expired verified offer", { expires: "past" });
    const suspended = await createOffer(suspendedAgent, "Suspended agent offer");
    const review = await createOffer(reviewAgent, "In-review agent offer");
    const pending = await createOffer(verifiedAgent, "Pending moderation offer", { status: "pending_review" });

    await t.test("published discovery returns only unexpired offers from currently verified agents", async () => {
      const rows = await getPublishedOffers();
      assert.deepEqual(rows.map((row) => row.id).sort((a, b) => a - b), [active, activeSecond].sort((a, b) => a - b));
      assert.equal(rows.some((row) => [expired, suspended, review, pending].includes(row.id)), false);
    });

    await t.test("featured discovery uses the same public trust boundary", async () => {
      const rows = await getFeaturedOffers();
      assert.deepEqual(rows.map((row) => row.id), [active]);
    });

    await t.test("offer detail fails closed when the offer is stale or its agent loses verification", async () => {
      assert.equal((await getOfferById(active))?.id, active);
      assert.equal(await getOfferById(expired), null);
      assert.equal(await getOfferById(suspended), null);
      assert.equal(await getOfferById(review), null);
      assert.equal(await getOfferById(pending), null);
    });

    await t.test("public agent detail hides non-verified agents and excludes expired offers", async () => {
      const agent = await getAgentById(verifiedAgent);
      assert.ok(agent);
      assert.deepEqual(agent.offers.map((offer) => offer.id).sort((a, b) => a - b), [active, activeSecond].sort((a, b) => a - b));
      assert.equal(await getAgentById(suspendedAgent), null);
      assert.equal(await getAgentById(reviewAgent), null);
    });

    await t.test("destination counts are derived only from public-safe offers", async () => {
      const destinations = await getDestinations();
      assert.equal(destinations.length, 1);
      assert.equal(destinations[0]?.countryEn, "Turkey");
      assert.equal(destinations[0]?.offerCount, 2);
    });

    // getOfferById/getAgentById emit fire-and-forget telemetry; give it a turn
    // before closing the shared pool used by src/db.
    await new Promise((resolve) => setTimeout(resolve, 25));
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
