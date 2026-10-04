import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type Fixture = { project: string; workspaceId: number; opportunityId: number; ownerToken: string; partnerToken: string; outsiderToken: string; partnerEmail: string };
test.skip(process.env.SILA_SERVICE_BROWSER_QA !== "true", "Needs explicit isolated PostgreSQL browser fixtures.");

async function rtl(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
}

test("office and assigned partner complete, rework and settle a service without leaking finances", async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  const fixture = (JSON.parse(readFileSync(".service-browser-fixture.json", "utf8")) as Fixture[]).find((item) => item.project === testInfo.project.name)!;
  expect(fixture).toBeTruthy();
  const contextOptions = { baseURL, viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, deviceScaleFactor: testInfo.project.use.deviceScaleFactor, hasTouch: testInfo.project.use.hasTouch, locale: "ar-EG" };
  const officeContext = await browser.newContext(contextOptions);
  const partnerContext = await browser.newContext(contextOptions);
  const clientContext = await browser.newContext(contextOptions);
  try {
    for (const [context, token] of [[officeContext, fixture.ownerToken], [partnerContext, fixture.partnerToken]] as const) await context.addCookies([{ name: "tj_sess", value: token, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    const office = await officeContext.newPage(); const partner = await partnerContext.newPage(); const client = await clientContext.newPage();
    const runtimeErrors: string[] = [];
    for (const page of [office, partner, client]) { page.on("pageerror", (error) => runtimeErrors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); }); }
    const officeUrl = `/account/agency/opportunities/${fixture.opportunityId}`;
    await office.goto(officeUrl, { waitUntil: "networkidle" });
    const panel = office.locator('section[aria-labelledby="service-fulfillment-title"]');
    await expect(panel.getByRole("heading", { name: "من الموافقة إلى التسليم" })).toBeVisible();
    await panel.getByRole("button", { name: "تكليف شريك", exact: true }).click();
    await panel.getByLabel("بند الخدمة المعتمد").selectOption({ label: "خدمة مستندات للاختبار · EGP" });
    await panel.getByLabel("بريد حساب الشريك").fill(fixture.partnerEmail);
    await panel.getByLabel("المطلوب من الشريك").fill("تجهيز ملف اختبار بلا بيانات حقيقية");
    await panel.getByLabel("معيار قبول التسليم").fill("ملف كامل قابل للمراجعة");
    await panel.getByLabel("مرجع اتفاق الشريك أو مستند تأهيله").fill("QA-REVIEWED-AGREEMENT");
    const due = new Date(Date.now() + 72 * 3_600_000).toISOString().slice(0, 16);
    await panel.getByLabel("موعد التسليم", { exact: true }).fill(due);
    await panel.getByLabel("رسوم صلة بنفس عملة بند الخدمة").fill("150.00");
    await panel.getByRole("checkbox").check();
    const creating = office.waitForResponse((response) => response.url().endsWith("/service-orders") && response.request().method() === "POST", { timeout: 10_000 });
    await panel.getByRole("button", { name: "إرسال التكليف داخل صلة" }).click();
    const created = await creating;
    const createdBody = await created.json();
    expect(created.status(), JSON.stringify(createdBody)).toBe(201);
    await expect(panel.getByText("ينتظر موافقة الشريك", { exact: true })).toBeVisible();
    await rtl(office);

    await partner.goto("/account/partner", { waitUntil: "networkidle" });
    await expect(partner.getByRole("button", { name: "قبول التكليف", exact: true })).toBeVisible();
    await expect(partner.locator("body")).not.toContainText("رسوم صلة المتفق عليها");
    await partner.getByRole("button", { name: "قبول التكليف", exact: true }).click();
    await partner.getByRole("button", { name: "بدء التنفيذ", exact: true }).click();
    await partner.getByLabel("وصف التسليم أو مرجعه").fill("QA-DELIVERY-1");
    await partner.getByRole("button", { name: "تسليم للمراجعة", exact: true }).click();
    await expect(partner.getByText("ينتظر مراجعة التسليم", { exact: true })).toBeVisible();
    await rtl(partner);

    await office.reload({ waitUntil: "networkidle" });
    await panel.getByLabel("ملاحظة الإجراء").fill("تحتاج صفحة إضافية");
    await panel.getByRole("button", { name: "طلب تعديل مع السبب" }).click();
    await expect(panel.getByText("مطلوب تعديل", { exact: true })).toBeVisible();
    await partner.reload({ waitUntil: "networkidle" });
    await expect(partner.getByText("آخر ملاحظة: تحتاج صفحة إضافية")).toBeVisible();
    await partner.getByRole("button", { name: "بدء التنفيذ", exact: true }).click();
    await partner.getByLabel("وصف التسليم أو مرجعه").fill("QA-DELIVERY-2");
    await partner.getByRole("button", { name: "تسليم للمراجعة", exact: true }).click();
    await expect(partner.getByText("ينتظر مراجعة التسليم", { exact: true })).toBeVisible();
    await office.reload({ waitUntil: "networkidle" });
    await panel.getByRole("button", { name: "قبول التسليم", exact: true }).click();
    await expect(panel.getByText("تسليم مقبول", { exact: true })).toBeVisible();
    await expect(panel.getByText("QA-DELIVERY-1", { exact: true })).toBeVisible();
    await expect(panel.getByText("QA-DELIVERY-2", { exact: true })).toBeVisible();

    await panel.getByText("تسجيل تحصيل أو استرداد أو تكلفة تشغيل", { exact: true }).click();
    await panel.getByLabel("المبلغ بـEGP").fill("150");
    await panel.getByLabel("مرجع الإثبات", { exact: true }).fill("QA-RECEIPT");
    await panel.getByLabel("وصف التسجيل", { exact: true }).fill("PRIVATE-QA-BANK-NOTE");
    await panel.getByRole("button", { name: "تسجيل رسوم دُفعت لصلة" }).click();
    await expect(panel.getByLabel("المبلغ بـEGP")).toHaveValue("");
    await panel.getByLabel("المبلغ بـEGP").fill("75");
    await panel.getByLabel("مرجع الإثبات", { exact: true }).fill("QA-OPERATOR-TIME");
    await panel.getByLabel("وصف التسجيل", { exact: true }).fill("وقت تشغيل ودعم للاختبار");
    await panel.getByRole("button", { name: "تسجيل تكلفة تشغيل", exact: true }).click();
    await expect(panel.getByLabel("المبلغ بـEGP")).toHaveValue("");
    await partner.reload({ waitUntil: "networkidle" });
    await expect(partner.locator("body")).not.toContainText("PRIVATE-QA-BANK-NOTE");
    await expect(partner.locator("body")).not.toContainText("سجل التحصيل والتكاليف");

    await panel.getByRole("button", { name: "إصدار رابط متابعة", exact: true }).click();
    const statusUrl = await panel.getByLabel("رابط المتابعة", { exact: true }).inputValue();
    const response = await client.goto(statusUrl, { waitUntil: "networkidle" });
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(client.getByText("تسليم مقبول", { exact: true })).toBeVisible();
    await expect(client.locator("body")).not.toContainText("PRIVATE-QA-BANK-NOTE");
    await expect(client.locator("body")).not.toContainText("QA-DELIVERY");
    await expect(client.locator("body")).not.toContainText("عميل اختبار خاص");
    await expect(client.locator("body")).not.toContainText("تكلفة خدمة الشريك");
    await rtl(client);
    await panel.getByRole("button", { name: "إلغاء رابط المتابعة", exact: true }).click();
    await expect(panel.getByRole("button", { name: "إلغاء رابط المتابعة", exact: true })).toHaveCount(0);
    await client.reload({ waitUntil: "networkidle" });
    await expect(client.getByRole("heading", { name: "المتابعة غير متاحة الآن" })).toBeVisible();
    await rtl(office); await rtl(partner);
    const outsider = await browser.newContext(contextOptions);
    try {
      await outsider.addCookies([{ name: "tj_sess", value: fixture.outsiderToken, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      const denied = await outsider.request.get(`/api/agency/workspaces/${fixture.workspaceId}/service-orders`);
      expect(denied.status()).toBe(404);
      const own = await outsider.request.get("/api/partner/service-orders");
      expect((await own.json()).orders).toEqual([]);
    } finally { await outsider.close(); }
    await office.screenshot({ path: `test-results/service-office-${testInfo.project.name}.png`, fullPage: true });
    await partner.screenshot({ path: `test-results/service-partner-${testInfo.project.name}.png`, fullPage: true });
    expect(runtimeErrors).toEqual([]);
  } finally { await Promise.allSettled([officeContext.close(), partnerContext.close(), clientContext.close()]); }
});
