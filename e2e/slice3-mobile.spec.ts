import { expect, test } from "@playwright/test";
import { AGENT1 } from "./helpers";

/**
 * SLICE 3 mobile smoke (Pixel 7) — contact drawer + inbox render.
 * Fixture offer …0220 must be provisioned (db/staging/0030) and the traveler
 * request from the desktop journey may or may not exist; assertions are
 * state-agnostic.
 */
const OFFER_ID = "22222222-2222-4222-8222-000000000220";

test("mobile: traveler opens the contact drawer on the offer page", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill("e2e-traveler@e2e.local");
  await page.locator("#password").fill("Passw0rd!E2E");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);

  await page.goto(`/offers/${OFFER_ID}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const trigger = page.getByRole("button", { name: "تواصل مع الوكيل" });
  // If a live/closed request from the desktop journey exists, the inline
  // status replaces the CTA — accept either, but when the CTA is present the
  // drawer MUST open with the form fields.
  if ((await trigger.count()) > 0) {
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "طلب تواصل للوكيل" })).toBeVisible();
    await expect(page.locator("#c-m-message")).toBeVisible();
    await expect(page.locator("#c-m-count")).toBeVisible();
  } else {
    await expect(page.getByText("طلب التواصل")).toBeVisible();
  }
});

test("mobile: agent inbox renders and is reachable from the portal nav", async ({ page }) => {
  await page.goto("/login?next=/dashboard/contacts");
  await page.locator("#email").fill(AGENT1.email);
  await page.locator("#password").fill(AGENT1.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/dashboard\/contacts$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "طلبات التواصل" })).toBeVisible();
});
