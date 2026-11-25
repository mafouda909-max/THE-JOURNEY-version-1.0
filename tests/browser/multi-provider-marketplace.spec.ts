import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { pool } from "../../src/db";
import {
  executeCommercialCommand,
  type CommercialActor,
} from "../../src/lib/commercial-service";
import {
  activateQuoteDelivery,
  prepareQuoteDelivery,
} from "../../src/lib/quote-delivery-agent";

type AgencyFixture = {
  name: string;
  workspaceId: number;
  agentId: number;
  accountId: number;
  token: string;
};
type Fixture = {
  travelerToken: string;
  travelerEmail: string;
  agencies: [AgencyFixture, AgencyFixture];
};
const fixturePath = ".multi-provider-browser-fixture.json";
const fixture = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture
  : null;

test.afterAll(async () => {
  await pool.end();
});

async function signIn(context: BrowserContext, token: string) {
  await context.clearCookies();
  await context.addCookies([{
    name: "tj_sess",
    value: token,
    url: "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function createQuote(
  agency: AgencyFixture,
  requestId: number,
  currency: "USD" | "EUR",
) {
  const opportunityResult = await pool.query<{ id: number }>(
    "SELECT id FROM agency_opportunities WHERE workspace_id=$1 AND source_contact_request_id=$2 LIMIT 1",
    [agency.workspaceId, requestId],
  );
  const opportunityId = opportunityResult.rows[0]?.id;
  if (!opportunityId) throw new Error("Adopted opportunity missing for workspace " + agency.workspaceId + ".");

  const actor: CommercialActor = {
    workspaceId: agency.workspaceId,
    agentId: agency.agentId,
    accountId: agency.accountId,
    membershipRole: "owner",
  };
  const validUntil = new Date(Date.now() + 48 * 3_600_000).toISOString();
  const quote = await executeCommercialCommand(actor, {
    command: "create_quote_version",
    opportunityId,
    validUntil,
    clientFacingTerms: "عرض اختباري اصطناعي. إعادة تأكيد التوافر والشروط تتم مباشرة مع مقدم الخدمة خارج صلة.",
    lines: [{
      kind: "hotel",
      label: "إقامة اختبار " + agency.name,
      quantity: 1,
      currency,
      costUnitMinor: 80000,
      sellUnitMinor: currency === "USD" ? 95000 : 99000,
      commissionExpectedMinor: 0,
      supplierOptionId: null,
      provenance: {
        sourceType: "manual",
        sourceRef: "multi-provider-browser-" + requestId + "-" + agency.workspaceId,
        observedAt: new Date().toISOString(),
        validUntil,
      },
    }],
  });
  if (quote.status !== 201) {
    throw new Error("Could not create synthetic quote: " + JSON.stringify(quote.body));
  }

  const quoteId = Number(quote.body.quoteId);
  const quoteVersionId = Number((quote.body.quoteVersion as Record<string, unknown>).id);
  const prepared = await prepareQuoteDelivery(
    { workspaceId: agency.workspaceId, accountId: agency.accountId },
    { quoteId, quoteVersionId, channel: "link" },
  );
  if (prepared.status !== 201) {
    throw new Error("Could not prepare synthetic quote delivery: " + JSON.stringify(prepared.body));
  }
  const token = String((prepared.body as Record<string, unknown>).activationToken);
  const activated = await activateQuoteDelivery(
    { workspaceId: agency.workspaceId, accountId: agency.accountId },
    { token },
  );
  if (activated.status !== 200) {
    throw new Error("Could not activate synthetic quote delivery: " + JSON.stringify(activated.body));
  }
  return { opportunityId, quoteId };
}

test("traveler request → two isolated agencies → independent quotes → decision → direct-confirmation acknowledgement", async ({
  browser,
  page,
  context,
}, testInfo) => {
  if (!fixture) {
    test.skip(true, "This journey runs only in the isolated multi-provider browser-QA job.");
    return;
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(context, fixture.travelerToken);
  await page.goto("/account/travel", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "اطلب عروضًا مناسبة من شبكة مقدمي الخدمة", exact: true }),
  ).toBeVisible();

  const marketplace = page.locator('section[aria-labelledby="multi-provider-market-title"]');
  await marketplace.getByTestId("multi-provider-category-select").selectOption("hotel");
  await marketplace.getByLabel("مدينة المغادرة", { exact: true }).fill("القاهرة");
  await marketplace.getByLabel("الوجهات المطلوبة", { exact: true }).fill("إسطنبول");
  await marketplace.getByLabel("تاريخ المغادرة", { exact: true }).fill("2027-05-10");
  await marketplace.getByLabel("تاريخ العودة", { exact: true }).fill("2027-05-15");
  await marketplace.getByLabel("بالغون", { exact: true }).fill("2");
  await marketplace.getByLabel("أطفال", { exact: true }).fill("1");
  await marketplace.getByLabel("رضع", { exact: true }).fill("0");

  const submit = marketplace.getByRole("button", { name: "أرسل الطلب إلى مقدمي الخدمة", exact: true });
  await expect(submit).toBeDisabled();
  await marketplace.locator('input[type="checkbox"]').check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    marketplace.getByRole("status").filter({ hasText: "تم إرسال طلبك إلى 2 جهات." }),
  ).toBeVisible();

  const followLink = marketplace.getByRole("link", { name: "متابعة الطلب والعروض", exact: true });
  await expect(followLink).toHaveAttribute("href", /^\/account\/travel\/requests\/\d+$/);
  const href = await followLink.getAttribute("href");
  const requestId = Number(href?.split("/").pop());
  expect(Number.isSafeInteger(requestId) && requestId > 0).toBeTruthy();
  await followLink.click();
  await expect(page.getByRole("heading", {
    name: new RegExp("TRQ-" + String(requestId).padStart(5, "0")),
  })).toBeVisible();

  const requestUrl = "/account/travel/requests/" + requestId;
  for (const agency of fixture.agencies) {
    await expect(page.getByRole("heading", { name: agency.name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("جهة خارج التخصص", { exact: true })).toHaveCount(0);
  await expect(page.getByText("جهة بلا أدلة ثقة مكتملة", { exact: true })).toHaveCount(0);

  const agencyContext = await browser.newContext({
    locale: "ar-EG",
    ...(testInfo.project.name === "mobile-chromium"
      ? {
          viewport: { width: 393, height: 852 },
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
        }
      : { viewport: { width: 1440, height: 1000 } }),
  });
  const agencyPage = await agencyContext.newPage();
  const opportunities: Array<{ agency: AgencyFixture; opportunityId: number }> = [];
  try {
    for (const agency of fixture.agencies) {
      await signIn(agencyContext, agency.token);
      await agencyPage.goto("/account/agency", { waitUntil: "networkidle" });
      const inboxCard = agencyPage.locator("article").filter({
        hasText: "TRQ-" + String(requestId).padStart(5, "0"),
      });
      await expect(inboxCard).toBeVisible();
      await expect(inboxCard).toContainText("إسطنبول");
      await expect(agencyPage.locator("body")).not.toContainText(fixture.travelerEmail);
      await noOverflow(agencyPage);
      await inboxCard.getByRole("button", { name: "اعتماد كفرصة", exact: true }).click();
      await expect(
        agencyPage.getByRole("status").filter({ hasText: "تم اعتماد الطلب كفرصة" }),
      ).toBeVisible();

      const opportunity = await pool.query<{ id: number }>(
        "SELECT id FROM agency_opportunities WHERE workspace_id=$1 AND source_contact_request_id=$2 LIMIT 1",
        [agency.workspaceId, requestId],
      );
      const opportunityId = opportunity.rows[0]?.id;
      if (!opportunityId) throw new Error("Opportunity missing after adoption by " + agency.name + ".");
      opportunities.push({ agency, opportunityId });
    }

    await signIn(agencyContext, fixture.agencies[1].token);
    await agencyPage.goto("/account/agency/opportunities/" + opportunities[0]!.opportunityId, { waitUntil: "networkidle" });
    await expect(agencyPage).toHaveURL(/\/account(?:\?|$)/);

    const quoteA = await createQuote(fixture.agencies[0], requestId, "USD");
    const quoteB = await createQuote(fixture.agencies[1], requestId, "EUR");

    await signIn(context, fixture.travelerToken);
    await page.goto(requestUrl, { waitUntil: "networkidle" });
    await expect(page.getByText(/العروض الواردة تستخدم أكثر من عملة/)).toBeVisible();
    await expect(page.getByRole("heading", { name: fixture.agencies[0].name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: fixture.agencies[1].name, exact: true })).toBeVisible();

    const quoteCardA = page.locator("article").filter({ hasText: "إقامة اختبار " + fixture.agencies[0].name });
    const quoteCardB = page.locator("article").filter({ hasText: "إقامة اختبار " + fixture.agencies[1].name });
    await expect(quoteCardA.getByRole("button", { name: "أوافق على هذا العرض", exact: true })).toBeVisible();
    await expect(quoteCardB.getByRole("button", { name: "أوافق على هذا العرض", exact: true })).toBeVisible();
    await expect(quoteCardA).not.toContainText("grossProfitMinor");
    await page.screenshot({
      path: "test-results/multi-provider-comparison-" + testInfo.project.name + ".png",
      fullPage: true,
    });

    await quoteCardA.getByRole("button", { name: "أوافق على هذا العرض", exact: true }).click();
    await expect(quoteCardA).toContainText("وافقت على العرض");

    await signIn(agencyContext, fixture.agencies[0].token);
    await agencyPage.goto("/account/agency/opportunities/" + opportunities[0]!.opportunityId, { waitUntil: "networkidle" });
    const confirmationPanel = agencyPage.locator('section[aria-labelledby="direct-confirmation-title"]');
    await expect(confirmationPanel).toBeVisible();
    await confirmationPanel.getByLabel("اسم مقدم الخدمة").fill("مزود إقامة تجريبي");
    await confirmationPanel.getByLabel("طريقة التواصل", { exact: true }).selectOption("whatsapp");
    await confirmationPanel.getByLabel("ملخص مختصر — اختياري").fill("إفادة اصطناعية لاختبار مسار الإقرار فقط.");
    await confirmationPanel.getByRole("button", { name: "تسجيل إفادة التواصل المباشر", exact: true }).click();
    await expect(
      confirmationPanel.getByRole("status").filter({ hasText: "تم تسجيل إفادة الوكالة" }),
    ).toBeVisible();
    await noOverflow(agencyPage);

    await signIn(context, fixture.travelerToken);
    await page.goto(requestUrl, { waitUntil: "networkidle" });
    const confirmedQuote = page.locator("article").filter({
      hasText: "إقامة اختبار " + fixture.agencies[0].name,
    });
    await expect(confirmedQuote).toContainText("مزود إقامة تجريبي");
    await confirmedQuote.getByRole("button", { name: "نعم، تواصل معي مقدم الخدمة", exact: true }).click();
    await expect(confirmedQuote).toContainText("أكدت التواصل");
    await expect(confirmedQuote.getByText(/إفادة من الوكالة وليست تحققًا من صلة/)).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: "test-results/multi-provider-confirmation-" + testInfo.project.name + ".png",
      fullPage: true,
    });

    expect(quoteA.opportunityId).toBe(opportunities[0]!.opportunityId);
    expect(quoteB.opportunityId).toBe(opportunities[1]!.opportunityId);
    expect(errors).toEqual([]);
  } finally {
    await agencyContext.close();
  }
});
