import { expect, test } from "@playwright/test";
import { AGENT1, loginAgent } from "./helpers";

/**
 * SLICE 2A — auth surface E2E: guards, login/logout, register error path,
 * public auth pages render. Runs against the :3199 dev server (staging).
 */
test.describe.serial("SLICE 2A — authentication & guards", () => {
  test.setTimeout(300_000);

  test("unauthenticated /dashboard redirects to /login via requireAgent's registration-first funnel", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fagents%2Fregister$/);
    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  });

  test("unauthenticated /admin/dashboard refuses access", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Flogin$/);
  });

  test("public auth pages render their forms", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#display_name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.getByRole("button", { name: "إرسال الرابط" })).toBeVisible();

    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: "أكد بريدك الإلكتروني" })).toBeVisible();

    await page.goto("/agents/register");
    await expect(page.locator("#business_name")).toBeVisible();
    await expect(page.locator("#city_id")).toBeVisible();
  });

  test("wrong password surfaces the auth error on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(AGENT1.email);
    await page.locator("#password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(/\/login\?e=/);
    await expect(page.locator("p[role='alert']")).toBeVisible();
  });

  test("duplicate-email signup gets the same neutral response (anti-enumeration)", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.locator("#display_name").fill("مستخدم مكرر");
    await page.locator("#email").fill(AGENT1.email);
    await page.locator("#password").fill("Passw0rd!E2E");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();
    // GoTrue deliberately does NOT reveal whether the address is taken:
    // the flow lands on the neutral verify-email step with no error surfaced.
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.getByRole("heading", { name: "أكد بريدك الإلكتروني" })).toBeVisible();
  });

  test("agent login reaches the guarded RTL dashboard", async ({ page }) => {
    await loginAgent(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("بوابة الوكيل")).toBeVisible();
  });

  test("sign-out clears the session and guard re-engages", async ({ page }) => {
    await loginAgent(page);
    await Promise.all([
      page.waitForURL(/localhost:\d+\/$/),
      page.getByRole("button", { name: /خروج/ }).click(),
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fagents%2Fregister$/);
  });
});
