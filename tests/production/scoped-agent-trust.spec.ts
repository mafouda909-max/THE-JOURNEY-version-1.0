import { expect, test } from "@playwright/test";

function assertScopedAgent(value: unknown) {
  expect(value).not.toBeNull();
  const agent = value as Record<string, unknown>;
  for (const privateField of ["licenseNumber", "verifiedAt", "storageKey", "originalName", "documents"]) {
    expect(Object.hasOwn(agent, privateField)).toBe(false);
  }
  const trust = agent.trust as {
    status: string;
    claims: Array<{ kind: string; scope: string; verifiedAt: string; validUntil: string | null }>;
    reviewedAt: string;
    validUntil: string | null;
    limitations: string[];
  };
  expect(trust.status).toBe("reviewed");
  const kinds = trust.claims.map(claim => claim.kind);
  expect(kinds).toContain("identity");
  expect(kinds).toContain("activity");
  if (agent.licenseType === "agency") expect(kinds).toContain("entity");
  for (const claim of trust.claims) {
    expect(claim.scope.length).toBeGreaterThan(0);
    expect(Number.isFinite(Date.parse(claim.verifiedAt))).toBe(true);
    expect(Date.parse(claim.verifiedAt)).toBeLessThanOrEqual(Date.now() + 5_000);
    if (claim.validUntil !== null) expect(Date.parse(claim.validUntil)).toBeGreaterThan(Date.now());
    expect(Object.keys(claim).sort()).toEqual(["kind", "label", "scope", "validUntil", "verifiedAt"]);
  }
  expect(trust.limitations.length).toBeGreaterThan(0);
}

test("production public trust policy and discovery expose scoped claims without private evidence", async ({ page, request }) => {
  // Anonymous reads only. Empty genuine supply is a valid state; this proof
  // never inserts, approves, publishes or impersonates a real agent.
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const policy = await page.goto("/trust", { waitUntil: "networkidle" });
  expect(policy?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "سياسة توثيق الوكلاء", exact: true })).toBeVisible();
  for (const scope of ["هوية مُراجَعة", "نشاط مهني مُراجع", "كيان مُراجع"]) {
    await expect(page.getByText(scope, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/روابط موقعة قصيرة العمر/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const directory = await page.goto("/agents", { waitUntil: "networkidle" });
  expect(directory?.status()).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const agentsResponse = await request.get("/api/agents");
  expect(agentsResponse.status()).toBe(200);
  const agents = await agentsResponse.json();
  expect(agents.count).toBe(agents.agents.length);
  for (const agent of agents.agents) assertScopedAgent(agent);
  const offersResponse = await request.get("/api/offers");
  expect(offersResponse.status()).toBe(200);
  const offers = await offersResponse.json();
  expect(offers.count).toBe(offers.offers.length);
  for (const offer of offers.offers) assertScopedAgent(offer.agent);
  expect(errors).toEqual([]);
});
