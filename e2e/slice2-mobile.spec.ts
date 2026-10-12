import { expect, test } from "@playwright/test";
import { loginAgent } from "./helpers";

/** Slice 2 MOBILE smoke — Pixel 7 viewport, P0 agent surfaces. */
test.describe.serial("SLICE 2 mobile smoke", () => {
  test("agent login + dashboard RTL on mobile", async ({ page }) => {
    await loginAgent(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "مرحبًا" })).toBeVisible();
    await expect(page.locator('nav[aria-label="قائمة الوكيل"]')).toBeVisible();
    // Quick-create affordance present on mobile nav:
    await expect(page.getByRole("link", { name: "+ عرض جديد" })).toBeVisible();
  });

  test("create-offer wizard renders step 1 on mobile", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/dashboard/offers/new");
    await expect(page.locator("#trip_type")).toBeVisible();
    await expect(page.locator("#origin_city_id")).toBeVisible();
    await expect(page.getByRole("button", { name: "التالي" })).toBeVisible();
  });

  test("my-offers list renders on mobile", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/dashboard/offers");
    await expect(page.getByRole("heading", { name: "إدارة العروض" })).toBeVisible();
  });
});
