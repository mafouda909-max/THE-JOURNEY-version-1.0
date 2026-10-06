import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

type Fixture = {
  project: string;
  workspaceAgentName: string;
  workspaceId: number;
  workspaceToken: string;
  workspaceAgentId: number;
  workspaceRequestId: number;
  opportunityId: number;
  ownerToken: string;
};
const fixtures: Fixture[] = JSON.parse(
  readFileSync(".service-browser-fixture.json", "utf8"),
);
const forProject = (project: string) =>
  fixtures.find((fixture) => fixture.project === project)!;
async function signIn(context: BrowserContext, fixture: Pick<Fixture, "workspaceToken">) {
  await context.addCookies([
    {
      name: "tj_sess",
      value: fixture.workspaceToken,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

test("workspace overview and paginated records show actual scoped totals", async ({
  page,
  context,
}, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  const foreign = fixtures.find((item) => item.project !== fixture.project)!;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(context, fixture);
  await page.goto("/account", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      name: `مرحباً، ${fixture.workspaceAgentName}`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "كل العروض (23)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "كل الطلبات (23)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "سجّل كوكيل", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("البريد غير موثّق", { exact: true })).toHaveCount(
    0,
  );
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/workspace-approved-overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  for (const path of ["offers", "requests", "notifications"]) {
    await page.goto(`/account/${path}`, { waitUntil: "networkidle" });
    await expect(
      page.getByText("عرض 1–20 من 23", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(20);
    await expect(page.locator("body")).not.toContainText(
      foreign.workspaceAgentName,
    );
    await noOverflow(page);
    await page.getByRole("link", { name: "التالي", exact: true }).click();
    await expect(
      page.getByText("عرض 21–23 من 23", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(3);
    await noOverflow(page);
  }
  await page.goto("/account", { waitUntil: "networkidle" });
  if (testInfo.project.name === "mobile-chromium")
    await page
      .getByRole("button", { name: "فتح قائمة مساحة العمل", exact: true })
      .click();
  const nav = page.getByRole("navigation", {
    name: "تنقل مساحة العمل",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "الملف المهني", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "نظرة عامة", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("opportunity workspace renders a privacy-scoped linked Travel Advisor brief without changing manual opportunities", async ({
  page,
  context,
}, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  await context.addCookies([
    {
      name: "tj_sess",
      value: fixture.ownerToken,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const manualResponse = await context.request.get(
    `/api/agency/workspaces/${fixture.workspaceId}/opportunities/${fixture.opportunityId}`,
  );
  expect(manualResponse.status()).toBe(200);
  const manualJson = await manualResponse.json() as { clientTravelBrief?: unknown };
  expect(manualJson.clientTravelBrief).toBeNull();

  await page.route("**/api/agency/workspaces/*/opportunities/*", async (route) => {
    const response = await route.fetch();
    const data = await response.json() as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...data,
        clientTravelBrief: {
          source: "linked_saved_trip",
          checkedAt: "2026-10-06T00:00:00.000Z",
          trip: {
            nationality: "مصري",
            passportValidityMonths: 12,
            destination: "تركيا",
            purpose: "tourism",
            travelDate: "2026-12-15T00:00:00.000Z",
            transitCountry: null,
          },
          decision: {
            status: "NEEDS_CONFIRMATION",
            routeComplexity: "UNKNOWN",
            topics: [
              { topic: "entry_visa", resolution: "UNCONFIRMED" },
            ],
          },
          freshness: {
            status: "UNKNOWN",
            nearestValidUntil: null,
            reasons: ["أعد التأكيد قبل الالتزام."],
          },
          change: {
            state: "CHANGED",
            previousCheckedAt: "2026-10-05T00:00:00.000Z",
            changedKeys: ["preparation:tourism_accommodation"],
          },
          preparation: [
            {
              id: "tourism_accommodation",
              category: "ACCOMMODATION",
              title: "الإقامة وإثبات مكان السكن",
              requirementState: "TO_VERIFY",
              readinessState: "NEEDS_ACTION",
              nextAction: "حدد مكان الإقامة، ثم أكد من المصدر الرسمي هل يلزم إثبات حجز أو عنوان.",
            },
          ],
          disclosure: "هذا ملخص قرار مشتق من رحلة ربطها المسافر بالاستفسار. لا يعرض إجابات المستشار الخام، ولا يحوّل بيانات المسافر أو خطة التجهيز إلى دليل رسمي.",
        },
      },
    });
  });

  await page.goto(`/account/agency/opportunities/${fixture.opportunityId}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Client Travel Brief", exact: true })).toBeVisible();
  await expect(page.getByText("الجنسية المبلغة", { exact: true })).toBeVisible();
  await expect(page.getByText("مصري", { exact: true })).toBeVisible();
  await expect(page.getByText("الإقامة وإثبات مكان السكن", { exact: true })).toBeVisible();
  await expect(page.getByText("يحتاج تأكيدًا رسميًا", { exact: true })).toBeVisible();
  await expect(page.getByText("يحتاج إجراء من العميل", { exact: true })).toBeVisible();
  await expect(page.getByText(/لا يعرض إجابات المستشار الخام/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/workspace-client-travel-brief-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("profile save failures preserve edits and a confirmed save survives reopening", async ({ page, context }, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  await signIn(context, fixture);
  await page.goto("/account/profile", { waitUntil: "networkidle" });
  const bio = page.getByLabel("نبذة عن خبرتك وخدماتك", { exact: true });
  const updatedBio = "نبذة اختبار خاصة للتحقق من حفظ الملف المهني وإعادة فتحه بدون فقد التغييرات عند تعذر الشبكة.";
  await bio.fill(updatedBio);
  await page.route("**/api/agent-verification", route => route.fulfill({ status: 503, json: { error: "تعذر الحفظ للاختبار." } }));
  await page.getByRole("button", { name: "حفظ الملف المهني", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "تعذر الحفظ للاختبار" })).toBeVisible();
  await expect(bio).toHaveValue(updatedBio);
  await expect(page.getByText("تغييرات لم تُحفظ بعد", { exact: true })).toBeVisible();
  await page.unroute("**/api/agent-verification");
  await page.route("**/api/agent-verification", route => route.fulfill({ json: { agent: { displayName: "Incomplete response" } } }));
  await page.getByRole("button", { name: "حفظ الملف المهني", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "تعذر تأكيد حفظ الملف" })).toBeVisible();
  await expect(bio).toHaveValue(updatedBio);
  await page.unroute("**/api/agent-verification");
  await page.getByRole("button", { name: "حفظ الملف المهني", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "تم حفظ بيانات الملف" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(bio).toHaveValue(updatedBio);
  await expect(page.getByText("اعتماد الوكيل: وكيل موثّق", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `test-results/workspace-approved-profile-${testInfo.project.name}.png`, fullPage: true });
});

test("owned inquiry follow-up is reachable, audited and recoverable after failure", async ({
  page,
  context,
}, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  const foreign = fixtures.find((item) => item.project !== fixture.project)!;
  await signIn(context, fixture);
  expect(
    (
      await context.request.patch(
        `/api/contact-requests/${foreign.workspaceRequestId}`,
        { data: { to: "viewed" } },
      )
    ).status(),
  ).toBe(403);
  await page.goto("/account/requests", { waitUntil: "networkidle" });
  const row = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: /رقم 23$/ }) });
  await expect(
    row.getByRole("link", { name: "مراسلة المسافر بالبريد", exact: true }),
  ).toHaveAttribute("href", /mailto:.*subject=/);
  await page.route(
    `**/api/contact-requests/${fixture.workspaceRequestId}`,
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: "تعذر التحديث للاختبار. حاول مرة أخرى." },
      }),
  );
  await row.getByRole("button", { name: "تأكيد الاطلاع", exact: true }).click();
  await expect(row.getByRole("alert")).toContainText("تعذر التحديث للاختبار");
  await expect(row.getByText("طلب جديد", { exact: true })).toBeVisible();
  await page.unroute(`**/api/contact-requests/${fixture.workspaceRequestId}`);
  for (const label of ["تأكيد الاطلاع", "تسجيل أنه تم الرد", "إغلاق الطلب"])
    await row.getByRole("button", { name: label, exact: true }).click();
  await expect(
    row.getByText("دورة الطلب مكتملة", { exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(row.getByText("مغلق", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/workspace-inquiries-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("approved agent creates a real private offer for human review", async ({
  page,
  context,
}, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  await signIn(context, fixture);
  await page.goto("/account/offers", { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "إنشاء عرض جديد", exact: true })
    .click();
  await page
    .getByLabel("عنوان العرض", { exact: true })
    .fill("عرض اصطناعي لاختبار إرسال الوكيل للمراجعة");
  await page
    .getByLabel("وصف البرنامج", { exact: true })
    .fill(
      "تفاصيل برنامج اصطناعي لاختبار حفظ العرض الخاص وإرساله للمراجعة البشرية، وليس عرض سفر حقيقيًا أو معروضًا تجاريًا.",
    );
  await page.getByLabel("مدينة الانطلاق", { exact: true }).fill("القاهرة");
  await page.getByLabel("مدينة الوجهة", { exact: true }).fill("إسطنبول");
  await page.getByLabel("دولة الوجهة", { exact: true }).fill("تركيا");
  await page
    .getByLabel("دولة الوجهة بالإنجليزية", { exact: true })
    .fill("Turkey");
  await page.getByLabel("السعر", { exact: true }).fill("17000");
  await page.getByLabel("العملة", { exact: true }).selectOption("EGP");
  await page
    .getByLabel("المشمولات", { exact: true })
    .fill("إقامة للاختبار فقط");
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/workspace-offer-form-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "إرسال للمراجعة", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "وصل عرضك لطابور المراجعة" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "كل العروض (24)", exact: true }),
  ).toBeVisible();
  const publicOffers = await context.request.get("/api/offers");
  expect((await publicOffers.json()).count).toBe(0);
});

test("verification progress waits for confirmed private upload", async ({
  page,
  context,
}, testInfo) => {
  // Upload failures need a clean unapproved account. The approved workspace
  // fixture now correctly has reviewed documents and cannot start at zero.
  await signIn(context, { workspaceToken: forProject(testInfo.project.name).ownerToken });
  await page.goto("/account/verification", { waitUntil: "networkidle" });
  await expect(
    page.getByText("0/3 من الأدلة المطلوبة جاهز للمراجعة", { exact: true }),
  ).toBeVisible();
  const doc = {
    id: 999001,
    documentType: "identity",
    originalName: "qa-only.pdf",
    status: "uploading",
  };
  let phase: "reserve" | "put" | "confirm" | "malformed" | "success" = "reserve";
  let confirmCalls = 0;
  let reserveCalls = 0;
  await page.route("**/api/agent-verification", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "confirm") confirmCalls += 1;
    else reserveCalls += 1;
    if (phase === "reserve" || (phase === "confirm" && body.action === "confirm")) {
      await route.fulfill({ status: 503, json: { error: "تعذر إكمال الرفع للاختبار." } });
      return;
    }
    await route.fulfill({
      json:
        body.action === "confirm"
          ? { stored: true, document: { ...doc, status: phase === "malformed" ? "uploading" : "pending" } }
          : {
              document: doc,
              upload: { uploadUrl: "/qa-private-upload", transport: "same_origin" },
            },
    });
  });
  await page.route("**/qa-private-upload", (route) =>
    route.fulfill({ status: phase === "put" ? 503 : 200, body: "" }),
  );
  await expect(page.getByText(/حتى 3MB للمستند في التجربة الحالية/)).toBeVisible();
  await page.getByLabel("رفع إثبات الهوية", { exact: true }).setInputFiles({
    name: "oversized-qa-only.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert").filter({ hasText: "لا يتجاوز 3MB" })).toBeVisible();
  expect(reserveCalls).toBe(0);
  for (const failure of ["reserve", "put", "confirm", "malformed"] as const) {
    phase = failure;
    await page.getByLabel("رفع إثبات الهوية", { exact: true }).setInputFiles({
      name: "qa-only.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 QA only"),
    });
    await expect(page.getByRole("alert").filter({ hasText: /تعذر|لم يكتمل|لم يتأكد/ })).toBeVisible();
    await expect(page.getByText("0/3 من الأدلة المطلوبة جاهز للمراجعة", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "وصل المستند" })).toHaveCount(0);
    if (failure === "reserve" || failure === "put") expect(confirmCalls).toBe(0);
  }
  phase = "success";
  await page.getByLabel("رفع إثبات الهوية", { exact: true }).setInputFiles({
    name: "qa-only.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 QA only"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "وصل المستند للتخزين الخاص" }),
  ).toBeVisible();
  await expect(
    page.getByText("1/3 من الأدلة المطلوبة جاهز للمراجعة", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("qa-only.pdf · قيد المراجعة", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/workspace-verification-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("notifications and logout keep the session after failures and allow retry", async ({
  page,
  context,
}, testInfo) => {
  const fixture = forProject(testInfo.project.name);
  await signIn(context, fixture);
  await page.goto("/account/notifications", { waitUntil: "networkidle" });
  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "تعذر تحديث الإشعارات للاختبار." },
    }),
  );
  await page
    .getByRole("button", { name: "تعليم الكل كمقروء", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "تعذر تحديث الإشعارات" }),
  ).toBeVisible();
  await expect(
    page.getByText("23 إشعار غير مقروء", { exact: false }),
  ).toBeVisible();
  await page.unroute("**/api/notifications");
  await page
    .getByRole("button", { name: "تعليم الكل كمقروء", exact: true })
    .click();
  await expect(
    page.getByText("0 إشعار غير مقروء", { exact: false }),
  ).toBeVisible();
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "تعذر تسجيل الخروج للاختبار." },
    }),
  );
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "تعذر تسجيل الخروج" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  expect((await context.request.get("/api/auth/me")).status()).toBe(200);
  await page.unroute("**/api/auth/logout");
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await context.request.get("/api/auth/me")).status()).toBe(401);
});
