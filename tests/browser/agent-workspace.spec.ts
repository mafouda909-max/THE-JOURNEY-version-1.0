import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

type Fixture = {
  project: string;
  workspaceAgentName: string;
  workspaceToken: string;
  workspaceAgentId: number;
  workspaceRequestId: number;
};
const fixtures: Fixture[] = JSON.parse(
  readFileSync(".service-browser-fixture.json", "utf8"),
);
const forProject = (project: string) =>
  fixtures.find((fixture) => fixture.project === project)!;
async function signIn(context: BrowserContext, fixture: Fixture) {
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
  await signIn(context, forProject(testInfo.project.name));
  await page.goto("/account/verification", { waitUntil: "networkidle" });
  await expect(
    page.getByText("0/2 من الأدلة المطلوبة جاهز للمراجعة", { exact: true }),
  ).toBeVisible();
  const doc = {
    id: 999001,
    documentType: "identity",
    originalName: "qa-only.pdf",
    status: "uploading",
  };
  await page.route("**/api/agent-verification", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json:
        body.action === "confirm"
          ? { stored: true, document: { ...doc, status: "pending" } }
          : {
              document: doc,
              upload: { uploadUrl: "http://localhost:3000/qa-private-upload" },
            },
    });
  });
  await page.route("**/qa-private-upload", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.getByLabel("رفع إثبات الهوية", { exact: true }).setInputFiles({
    name: "qa-only.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 QA only"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "وصل المستند للتخزين الخاص" }),
  ).toBeVisible();
  await expect(
    page.getByText("1/2 من الأدلة المطلوبة جاهز للمراجعة", { exact: true }),
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
