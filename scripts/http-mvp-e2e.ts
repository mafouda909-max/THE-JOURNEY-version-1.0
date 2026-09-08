/** Real HTTP/Neon test. External email delivery, SMS and R2 are NOT simulated.
 * Test-only DB fixtures exercise downstream flow; this is not KYC/provider proof.
 * Run only against an explicitly identified isolated database and localhost app.
 */
import { config } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { verificationHash } from "../src/lib/verification-secret";
config({ path: ".env.local", quiet: true });
const origin = "http://localhost:3100";
const url = process.env.DATABASE_URL;
assert.ok(
  url &&
    process.env.TEST_DATABASE_HOST &&
    new URL(url).hostname === process.env.TEST_DATABASE_HOST,
  "Explicit isolated DB host is required",
);
assert.equal(
  process.env.TEST_BRANCH_ID,
  "br-lingering-mouse-b1yridh7",
  "This evidence run is pinned to the isolated branch",
);
const c = new Client({ connectionString: url });
let checks = 0;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  admin = false,
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(admin ? { "x-admin-key": process.env.ADMIN_API_KEY! } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
  };
}
function check(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  checks++;
  console.log(`PASS ${label}`);
}
async function signup(role: string) {
  const email = `journey-e2e-${randomUUID()}@example.test`;
  const password = randomBytes(18).toString("hex");
  const res = await request("/api/auth/signup", "POST", {
    email,
    password,
    passwordConfirmation: password,
    name: "Isolated E2E Account",
    role,
    city: "Test city",
  });
  check(res.status, 201, `HTTP ${role} signup`);
  assert.ok(res.cookie);
  const me = await request("/api/auth/me", "GET", undefined, res.cookie);
  return {
    email,
    password,
    cookie: res.cookie,
    id: me.data.account.id,
    agentId: me.data.agent?.id,
  };
}
async function main() {
  await c.connect();
  check((await request("/api/media")).status, 401, "anonymous media denied");
  check(
    (await request("/api/offers?status=pending_review")).status,
    404,
    "private offer list denied",
  );
  check(
    (
      await request("/api/verification", "POST", {
        channel: "email",
        action: "confirm",
        code: "111111",
      })
    ).status,
    401,
    "anonymous verification denied",
  );
  const agent = await signup("agent");
  const traveler = await signup("traveler");
  const other = await signup("traveler");
  check(
    (
      await request(
        "/api/media?resource=profile",
        "GET",
        undefined,
        other.cookie,
      )
    ).status,
    403,
    "traveler media denied",
  );
  check(
    (
      await request(
        "/api/media?resource=offer&offerId=9999999",
        "GET",
        undefined,
        agent.cookie,
      )
    ).status,
    404,
    "foreign media resource denied",
  );
  check(
    (
      await request(
        `/api/agents/${agent.agentId}`,
        "PATCH",
        { action: "verify" },
        undefined,
        true,
      )
    ).status,
    422,
    "admin cannot verify without submitted evidence",
  );
  check(
    (
      await request(
        "/api/onboarding",
        "POST",
        { action: "submit" },
        agent.cookie,
      )
    ).status,
    422,
    "incomplete onboarding denied",
  );
  check(
    (
      await request(
        "/api/verification",
        "POST",
        { channel: "phone", action: "request" },
        agent.cookie,
      )
    ).status,
    503,
    "SMS provider fails closed",
  );
  check(
    (await request("/api/kyc", "POST", { action: "upload" }, agent.cookie))
      .status,
    503,
    "unconfigured real R2 fails closed",
  );
  // A DB challenge fixture tests verification consumption, not email delivery.
  const challenge = randomUUID();
  const code = "642913";
  await c.query(
    "INSERT INTO verification_challenges(id,account_id,channel,destination,secret_hash,expires_at) VALUES($1,$2,'email',$3,$4,now()+interval '10 minutes')",
    [challenge, agent.id, agent.email, verificationHash(challenge, code)],
  );
  check(
    (
      await request(
        "/api/verification",
        "POST",
        { channel: "email", action: "confirm", code: "000000" },
        agent.cookie,
      )
    ).status,
    422,
    "wrong code denied",
  );
  check(
    (
      await request(
        "/api/verification",
        "POST",
        { channel: "email", action: "confirm", code },
        other.cookie,
      )
    ).status,
    422,
    "cross-account challenge denied",
  );
  check(
    (
      await request(
        "/api/verification",
        "POST",
        { channel: "email", action: "confirm", code },
        agent.cookie,
      )
    ).status,
    200,
    "valid challenge consumed over HTTP",
  );
  check(
    (
      await request(
        "/api/verification",
        "POST",
        { channel: "email", action: "confirm", code },
        agent.cookie,
      )
    ).status,
    422,
    "challenge replay denied",
  );
  check(
    (
      await c.query(
        "SELECT attempts,consumed_at,secret_hash FROM verification_challenges WHERE id=$1",
        [challenge],
      )
    ).rows[0].attempts,
    2,
    "challenge attempts persisted",
  );
  // Explicit isolated fixtures for downstream tests. Never evidence of real KYC.
  await c.query(
    "UPDATE agents SET verification_status='verified',verified_at=now(),bio='Isolated downstream fixture, not real KYC' WHERE id=$1",
    [agent.agentId],
  );
  await c.query(
    "INSERT INTO agent_documents(agent_id,document_type,storage_key,original_name,status,verified_at) VALUES($1,'passport_id',$2,'ISOLATED FIXTURE - NO REAL DOCUMENT','verified',now())",
    [agent.agentId, `kyc/agent_${agent.agentId}/passport_id/isolated-fixture`],
  );
  const offer = await request(
    "/api/offers",
    "POST",
    {
      title: "Isolated E2E offer for authorization",
      description:
        "An isolated test offer created only on a non-production database for checking the complete request and response flow.",
      tripType: "package",
      priceAmount: 1200,
      currency: "SAR",
      includes: ["Test transport"],
      originCity: "Test origin",
      destinationCity: "Test destination",
      destinationCountry: "Test country",
      destinationCountryEn: "Test",
      maxTravelers: 4,
    },
    agent.cookie,
  );
  check(
    offer.status,
    201,
    "eligible fixture agent creates pending offer over HTTP",
  );
  const id = offer.data.id;
  check(
    (await request(`/api/offers/${id}`)).status,
    404,
    "pending offer hidden",
  );
  check(
    (
      await request(
        `/api/offers/${id}`,
        "PATCH",
        { action: "approve" },
        other.cookie,
      )
    ).status,
    401,
    "traveler cannot moderate offer",
  );
  check(
    (
      await request(
        `/api/offers/${id}`,
        "PATCH",
        { action: "approve" },
        undefined,
        true,
      )
    ).status,
    200,
    "admin moderates eligible fixture offer",
  );
  check(
    (
      await request(
        `/api/offers/${id}`,
        "PATCH",
        { action: "approve" },
        undefined,
        true,
      )
    ).status,
    409,
    "repeat moderation denied",
  );
  check(
    (await request(`/api/offers/${id}`)).status,
    200,
    "published eligible offer visible",
  );
  const contact = await request(
    "/api/contact-requests",
    "POST",
    {
      offerId: id,
      travelerName: "Test Traveler",
      travelerEmail: traveler.email,
      travelerCount: 2,
      message: "Please send the details of this isolated test trip.",
    },
    traveler.cookie,
  );
  check(contact.status, 201, "traveler contacts through HTTP");
  const lead = contact.data.id;
  check(
    (
      await request(
        `/api/contact-requests/${lead}`,
        "PATCH",
        { status: "responded", response: "Unauthorized attempted reply" },
        other.cookie,
      )
    ).status,
    404,
    "unrelated account cannot answer",
  );
  check(
    (
      await request(
        `/api/contact-requests/${lead}`,
        "PATCH",
        {
          status: "responded",
          response: "Thank you. Here are your isolated trip details.",
        },
        agent.cookie,
      )
    ).status,
    200,
    "owning agent responds",
  );
  const guestView = await fetch(origin + `/api/contact-requests/${lead}`, {
    headers: { Authorization: `Bearer ${contact.data.trackingToken}` },
  });
  check(guestView.status, 200, "private tracking token reads request");
  check(
    (await request(`/api/contact-requests/${lead}`)).status,
    404,
    "anonymous request without tracking token denied",
  );
  const storedHash = (
    await c.query(
      "SELECT tracking_token_hash FROM contact_requests WHERE id=$1",
      [lead],
    )
  ).rows[0].tracking_token_hash;
  check(
    storedHash !== contact.data.trackingToken,
    true,
    "tracking secret not stored raw",
  );
  const saved = (
    await c.query(
      "SELECT status,response,traveler_account_id FROM contact_requests WHERE id=$1",
      [lead],
    )
  ).rows[0];
  check(saved.status, "responded", "response state persisted");
  check(saved.traveler_account_id, traveler.id, "request owned by account ID");
  check(
    (
      await c.query(
        "SELECT count(*)::int AS n FROM notifications WHERE account_id=$1 AND type='contact_responded'",
        [traveler.id],
      )
    ).rows[0].n,
    1,
    "traveler response notification persisted",
  );
  const page = await request("/account", "GET", undefined, traveler.cookie);
  check(
    typeof page.data === "string" &&
      page.data.includes("Here are your isolated trip details"),
    true,
    "traveler account renders real response",
  );
  const foreign = await request("/account", "GET", undefined, other.cookie);
  check(
    typeof foreign.data === "string" &&
      !foreign.data.includes("Here are your isolated trip details"),
    true,
    "other account cannot read response",
  );
  await c.query(
    "UPDATE offers SET expires_at=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  check(
    (await request(`/api/offers/${id}`)).status,
    404,
    "expired offer hidden",
  );
  check(
    (
      await request(
        "/api/contact-requests",
        "POST",
        { offerId: id },
        traveler.cookie,
      )
    ).status,
    404,
    "expired offer refuses contact",
  );
  await c.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE account_id=$1",
    [other.id],
  );
  check(
    (await request("/api/auth/me", "GET", undefined, other.cookie)).status,
    401,
    "expired session denied",
  );
  check(
    (await request("/api/auth/logout", "POST", {}, traveler.cookie)).status,
    200,
    "logout succeeds",
  );
  check(
    (await request("/api/auth/me", "GET", undefined, traveler.cookie)).status,
    401,
    "logged-out session denied",
  );
  check(
    (
      await request("/api/auth/login", "POST", {
        email: traveler.email,
        password: traveler.password,
      })
    ).status,
    200,
    "login works after logout",
  );
  console.log(
    JSON.stringify({
      checks,
      branch: process.env.TEST_BRANCH_ID,
      fixtures: "Retained ONLY on isolated branch",
      externalProviders: "NOT PROVEN",
    }),
  );
}
main()
  .catch((e) => {
    console.error(
      e instanceof assert.AssertionError
        ? e.message
        : "E2E failed; inspect isolated runtime",
    );
    process.exitCode = 1;
  })
  .finally(() => c.end());
