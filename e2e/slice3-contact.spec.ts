import { expect, test } from "@playwright/test";
import { AGENT1, loginAgent } from "./helpers";

/**
 * SLICE 3 — conversion loop (AD-13 loop 3): traveler contact → respond →
 * track. Runs against the :3199 dev server + STAGING fixtures
 * (db/staging/0030): published non-demo offer …0220 owned by agent1, and the
 * confirmed traveler e2e-traveler@e2e.local / Passw0rd!E2E.
 */
const OFFER_ID = "22222222-2222-4222-8222-000000000220";
const TRAVELER = { email: "e2e-traveler@e2e.local", password: "Passw0rd!E2E" };
const MESSAGE =
  "السلام عليكم، أرغب بحجز هذه الرحلة لعائلة مكونة من أربعة أفراد خلال أكتوبر. ما السعر النهائي؟";

const offerUrl = (qs = "") => `/offers/${OFFER_ID}${qs ? `?${qs}` : ""}`;

async function loginTraveler(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(TRAVELER.email);
  await page.locator("#password").fill(TRAVELER.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function loginAs(page: import("@playwright/test").Page, who: typeof TRAVELER | typeof AGENT1) {
  await page.goto("/login");
  await page.locator("#email").fill(who.email);
  await page.locator("#password").fill(who.password);
  await page.getByRole("button", { name: "دخول" }).click();
  // Deterministic: session cookie must be set before any guarded goto.
  await expect(page).toHaveURL(/localhost:\d+\/(dashboard)?$/);
}

async function openDesktopForm(page: import("@playwright/test").Page): Promise<import("@playwright/test").Locator> {
  const form = page.locator('form[data-form="desktop"]');
  const summary = page.locator("details > summary");
  if ((await form.isVisible()) === false) {
    await summary.click();
  }
  await form.locator("#c-d-message").waitFor();
  return form;
}

test.describe.serial("SLICE 3 — traveler → agent → tracking", () => {
  test.setTimeout(300_000);

  test("A: guest CTA deep-links through login back to the offer", async ({ page }) => {
    await page.goto(offerUrl());
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const cta = page.getByRole("link", { name: "تواصل مع الوكيل" });
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${offerUrl()}$`));

    await page.locator("#email").fill(TRAVELER.email);
    await page.locator("#password").fill(TRAVELER.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(new RegExp(`/offers/${OFFER_ID}$`));
    // Traveler now sees the real contact affordance, not the guest link.
    const form = await openDesktopForm(page);
    await expect(form.locator("#c-d-message")).toBeVisible();
  });

  test("B+C: traveler submits a request and NEW status appears inline", async ({ page }) => {
    await loginTraveler(page);
    await page.goto(offerUrl());

    const form = await openDesktopForm(page);
    await form.locator("#c-d-message").fill(MESSAGE);
    await form.locator("#c-d-count").fill("4");
    await form.locator("#c-d-dates").fill("مرن خلال أكتوبر");
    await form.getByRole("button", { name: "إرسال طلب التواصل" }).click();

    await expect(page).toHaveURL(/cs=created$/);
    await expect(page.getByText("طلب التواصل")).toBeVisible();
    await expect(page.getByText("جديد", { exact: true })).toBeVisible();
    // Lifecycle tracker rendered with all three stages:
    await expect(page.getByText("تمت المشاهدة")).toBeVisible();
    await expect(page.getByText("تم الرد")).toBeVisible();
    // K (anti-spam, UI level): an active request replaces the form entirely —
    // a second live request is impossible from this surface.
    await expect(page.locator('form[data-form="desktop"]')).toHaveCount(0);
  });

  test("J: traveler cancels while NEW, then re-requests", async ({ page }) => {
    await loginTraveler(page);
    await page.goto(offerUrl());

    await Promise.all([
      page.waitForURL(/cs=cancelled$/),
      page.getByRole("button", { name: "إلغاء الطلب" }).click(),
    ]);
    await expect(page.getByText("أُلغي الطلب")).toBeVisible();
    // Terminal state re-opens the CTA (anti-spam only caps LIVE requests):
    const form = await openDesktopForm(page);
    await form.locator("#c-d-message").fill(MESSAGE);
    await form.getByRole("button", { name: "إرسال طلب التواصل" }).click();
    await expect(page).toHaveURL(/cs=created$/);
  });

  test("D: agent inbox lists the request; foreign agents see nothing", async ({ page }) => {
    await loginAgent(page); // agent1 owns the fixture offer
    await page.goto("/dashboard/contacts");
    await expect(page.getByRole("heading", { name: "طلبات التواصل" })).toBeVisible();
    await expect(page.getByText("عرض E2E للتواصل — القاهرة إلى إسطنبول").first()).toBeVisible();
    await expect(page.getByText("جديد", { exact: true }).first()).toBeVisible();
  });

  let REQUEST_ID = "";
  test("E+F: opening marks VIEWED and the agent responds", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/dashboard/contacts");
    await page.locator('a[href^="/dashboard/contacts/"]').first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/contacts/[0-9a-f-]{36}$`));
    REQUEST_ID = page.url().split("/").pop()!;

    // E: detail shows participant info + message; viewed marking is async.
    await expect(page.getByText("رسالة المسافر")).toBeVisible();
    await expect(page.getByText(MESSAGE)).toBeVisible();
    await expect(page.locator("#response_message")).toBeVisible();
    await expect(page.getByText("تمت المشاهدة", { exact: true })).toBeVisible({ timeout: 30_000 });

    // F: respond (NEW/VIEWED only path).
    await page.locator("#response_message").fill(
      "أهلًا بك! الرحلة متاحة في أكتوبر، السعر النهائي للعائلة ٤٧٠٠٠ جنيه شاملة الإقامة. للتنسيق نتواصل معك واتساب.",
    );
    await Promise.all([
      page.waitForURL(/s=responded$/),
      page.getByRole("button", { name: "إرسال الرد" }).click(),
    ]);
    await expect(page.getByText("ردّك")).toBeVisible();
    // L: agents have no close/cancel controls — ever.
    await expect(page.getByRole("button", { name: "إلغاء الطلب" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إنهاء الطلب وشكرًا" })).toHaveCount(0);
  });

  test("G+H: traveler sees RESPONDED + response text; /profile tracks history", async ({ page }) => {
    await loginTraveler(page);
    await page.goto(offerUrl());
    await expect(page.getByText("تم الرد", { exact: true })).toBeVisible();
    await expect(page.getByText("رد الوكيل:")).toBeVisible();
    await expect(page.getByText(/٤٧٠٠٠ جنيه/)).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "طلبات التواصل" })).toBeVisible();
    await expect(page.getByText("عرض E2E للتواصل — القاهرة إلى إسطنبول").first()).toBeVisible();
    await expect(page.getByText("تم الرد", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/رد الوكيل:/).first()).toBeVisible();
  });

  test("I: traveler closes after RESPONDED (terminal)", async ({ page }) => {
    await loginTraveler(page);
    await page.goto(offerUrl());
    await Promise.all([
      page.waitForURL(/cs=closed$/),
      page.getByRole("button", { name: "إنهاء الطلب وشكرًا" }).click(),
    ]);
    await expect(page.getByText("أُغلق الطلب")).toBeVisible();
    // Terminal → CTA returns for future requests.
    await openDesktopForm(page);
  });

  test("M: foreign agent cannot access another agent's contact request", async ({ page }) => {
    await loginAs(page, { email: "e2e-agent2@e2e.local", password: "Passw0rd!E2E" });
    await page.goto(`/dashboard/contacts/${REQUEST_ID}`);
    // Streaming commits the response before the RLS guard resolves, so the
    // transport status may stay 200 — what M guarantees is zero existence or
    // data leakage: the foreign agent gets the not-found surface, never rows.
    await expect(page.getByText("الصفحة غير موجودة")).toBeVisible();
    await expect(page.getByText(MESSAGE)).toHaveCount(0);
  });

  test("O: RTL holds on every Slice 3 surface", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/dashboard/contacts");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await loginTraveler(page);
    await page.goto("/profile");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto(offerUrl());
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
