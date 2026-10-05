import { expect, test } from "@playwright/test";
import { createAdminSessionToken } from "../../src/lib/auth";

test.beforeEach(async ({ context }) => {
  test.skip(process.env.SILA_SERVICE_BROWSER_QA !== "true" || !process.env.ADMIN_API_KEY, "Requires the isolated browser database and test admin key.");
  const value = createAdminSessionToken();
  if (!value) throw new Error("Test admin session unavailable");
  await context.addCookies([{ name: "tj_admin", value, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
});

test("admin capabilities show real readiness, planned adapters and bounded refresh", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/review");
  const panel = page.getByRole("region", { name: "قدرات صلة" });
  await expect(panel.getByRole("heading", { name: "قاعدة البيانات", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "قيد التطوير", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "ربط GDS", exact: true })).toBeVisible();
  await expect(panel.getByText("لم تُنفّذ بعد", { exact: true }).first()).toBeVisible();
  await panel.getByRole("button", { name: "المتاحة", exact: true }).click();
  const database = panel.locator("article").filter({ has: page.getByRole("heading", { name: "قاعدة البيانات", exact: true }) });
  await database.locator("summary").click();
  await expect(database.getByText("آخر نجاح في جلسة التشغيل", { exact: true })).toBeVisible();
  const refresh = page.waitForResponse((response) => response.url().endsWith("/api/tools") && response.request().method() === "POST");
  await panel.getByRole("button", { name: "تحديث الفحص" }).click();
  expect((await refresh).status()).toBe(200);
  await expect(panel.getByRole("button", { name: "تحديث الفحص" })).toBeEnabled();
  await panel.getByRole("button", { name: "القدرات المنفّذة" }).click();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.documentElement.clientWidth));
  await panel.screenshot({ path: `test-results/capabilities-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});

test("admin capabilities recover from a failed request without an endless spinner", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let fail = true;
  await page.route("**/api/tools", async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
    else await route.continue();
  });
  await page.goto("/review");
  const panel = page.getByRole("region", { name: "قدرات صلة" });
  await expect(panel.getByRole("alert")).toContainText("تعذر تحميل حالة التشغيل");
  await expect(panel.getByRole("button", { name: "إعادة المحاولة" })).toBeEnabled();
  await panel.screenshot({ path: `test-results/capabilities-error-${testInfo.project.name}.png` });
  fail = false;
  await panel.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(panel.getByRole("heading", { name: "قاعدة البيانات", exact: true })).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("growth failure is recoverable while capabilities and populated JSON audit timestamps remain usable", async ({ page }) => {
  let fail = true;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/growth", async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
    else await route.continue();
  });
  await page.goto("/review");
  const growth = page.getByRole("region", { name: "مكتب النمو", exact: true });
  await expect(growth.getByRole("alert")).toContainText("تعذر تحميل مكتب النمو");
  await expect(page.getByRole("region", { name: "قدرات صلة" }).getByRole("heading", { name: "قاعدة البيانات", exact: true })).toBeVisible();
  fail = false;
  await growth.getByRole("button", { name: "إعادة تحميل مكتب النمو" }).click();
  await expect(growth.getByRole("heading", { name: "مكتب النمو والمحتوى", exact: true })).toBeVisible();
  await expect(growth.getByText("tool_health_probe", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
