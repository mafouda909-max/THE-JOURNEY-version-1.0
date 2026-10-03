import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/offers", "/compare", "/readiness", "/join", "/community"];

for (const route of publicRoutes) {
  test(`renders ${route} in Arabic RTL without horizontal overflow`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
}

test("join remains fail-closed when passwordless providers are not configured", async ({ page, request }) => {
  await page.goto("/join", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();

  const config = await request.get("/api/auth/config");
  expect(config.ok()).toBeTruthy();
  expect(await config.json()).toEqual({
    google: false,
    magic: false,
    legacyPassword: false,
  });

  await expect(page.getByText("لا يوجد تسجيل Admin ذاتي")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("traveler and agency protected surfaces redirect unauthenticated users to join", async ({ page }) => {
  await page.goto("/account", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/join(?:\?|$)/);

  await page.goto("/account/agency", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/join(?:\?|$)/);
});

test("admin review surface stays fail-closed when ADMIN_API_KEY is absent", async ({ page }) => {
  await page.goto("/review", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "منطقة فريق الثقة" })).toBeVisible();
  await expect(page.getByText("الصلاحيات غير مهيأة بعد")).toBeVisible();
  await expect(page.locator('input[name="key"]')).toHaveCount(0);
});

test("empty marketplace states are explicit rather than fabricated", async ({ page }) => {
  await page.goto("/offers", { waitUntil: "networkidle" });
  await expect(page.getByText("لا نتائج بهذه الدقة")).toBeVisible();

  await page.goto("/agents", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText("0");
});

test("compare keeps supplier and currency identifiers legible inside RTL UI", async ({ page }) => {
  await page.goto("/compare", { waitUntil: "networkidle" });
  await expect(page.getByText("GDS / NDC ready")).toBeVisible();
  const currency = page.locator('select[name="currency"]');
  await expect(currency).toBeVisible();
  await expect(currency.locator("option")).toContainText(["EGP", "SAR", "AED", "USD", "EUR"]);
});

test("readiness begins in an unknown/not-evaluated state and does not invent a visa answer", async ({ page }) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByText("الـChecklist تتكوّن من سياقك أنت.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("تأشيرتك مؤكدة");
});
