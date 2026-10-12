import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  OFFER_AGENT2_PUBLISHED_ID,
  OFFER_EXPIRED_ID,
  OFFER_REJECTED_ID,
  loginAgent,
  loginAdminMfa,
} from "./helpers";

let CREATED_ID = "";
const TITLE = "E2E عرض اختبار النشر الكامل";

test.describe.serial("SLICE 2 — agent publishing lifecycle", () => {
  // Cold dev-compiles of guarded routes can exceed the global 120s cap.
  test.setTimeout(300_000);

  test("agent login lands on the dashboard with RTL shell", async ({ page }) => {
    await loginAgent(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "مرحبًا" })).toBeVisible();
  });

  test("wizard creates a DRAFT offer end-to-end", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/dashboard/offers/new");

    await page.locator("#trip_type").selectOption("flight");
    // Persistent counter → guaranteed-fresh route per run (no duplicate-live
    // collisions with leftovers from previous executions):
    const counterPath = ".e2e-cache/run-counter";
    let runNo = 0;
    try {
      runNo = parseInt(readFileSync(counterPath, "utf8").trim(), 10) || 0;
    } catch {
      /* first run */
    }
    runNo += 1;
    mkdirSync(".e2e-cache", { recursive: true });
    writeFileSync(counterPath, String(runNo));
    const dests: [string, string][] = [
      ["إسطنبول", "istanbul"],
      ["دبي", "dubai"],
      ["أنطاليا", "antalya"],
      ["الغردقة", "hurghada"],
      ["عمّان", "amman"],
      ["أبوظبي", "abu-dhabi"],
      ["الدمام", "dammam"],
      ["الشارقة", "sharjah"],
      ["العقبة", "aqaba"],
      ["جدة", "jeddah"],
      ["إزمير", "izmir"],
      ["شرم الشيخ", "sharm-el-sheikh"],
      ["أنقرة", "ankara"],
    ];
    const dest = dests[runNo % dests.length];
    await page.locator("#origin_city_id").selectOption({ label: "القاهرة" });
    await page.locator("#destination_city_id").selectOption({ label: dest[0] });
    await page.locator("#route_type").selectOption("direct");
    await page.getByRole("button", { name: "التالي" }).click();

    await page.locator("#title_ar").fill(TITLE);
    await page
      .locator("#description_ar")
      .fill("وصف تجريبي كامل لعرض E2E يغطي دورة النشر من المسودة إلى النشر.");
    await page.locator("#includes").fill("طيران ذهاب وعودة\nضرائب");
    await page.getByRole("button", { name: "التالي" }).click();

    await page.locator("#price_amount").fill("12500");
    await page.locator("#currency").selectOption("EGP");
    await page.getByRole("button", { name: "التالي" }).click();

    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.locator("#valid_until").fill(future);
    await page.getByRole("button", { name: "حفظ كمسودة" }).click();

    await expect(page).toHaveURL(/\/dashboard\/offers\/([0-9a-f-]{36})\/edit\?created=1/);
    CREATED_ID = page.url().match(/offers\/([0-9a-f-]{36})\/edit/)![1];
    await expect(page.getByText("مسودة", { exact: true })).toBeVisible();
  });

  test("T1: draft submits to PENDING_REVIEW", async ({ page }) => {
    await loginAgent(page);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);
    await Promise.all([
      page.waitForURL(new RegExp("s=submitted")),
      page.getByRole("button", { name: "إرسال للمراجعة" }).click(),
    ]);
    await expect(page).toHaveURL(/s=submitted/);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);
    await expect(page.getByText("قيد المراجعة", { exact: true })).toBeVisible();
  });

  test("T2 via admin MFA: pending offer is approved and published", async ({ page }) => {
    await loginAdminMfa(page);
    await expect(page.getByText("عروض تنتظر القرار")).toBeVisible();

    await page.goto(`/admin/offers/${CREATED_ID}`);
    await Promise.all([
      page.waitForURL(new RegExp("s=approved")),
      page.getByRole("button", { name: "اعتماد ونشر" }).click(),
    ]);
    await expect(page).toHaveURL(/s=approved/);
  });

  test("preview seam stays demo-only: real E2E offer is NOT publicly listed", async ({ page }) => {
    // Ratified visibility model (AD-17 #8 + B9): the staging preview
    // projection exposes ONLY is_demo=true rows; real rows surface exclusively
    // through production's canonical view once migrated there.
    await page.goto("/offers");
    await expect(
      page.locator('a[href^="/offers/"]').filter({ hasText: TITLE }),
    ).toHaveCount(0);
  });

  test("E1 minor edit keeps the offer PUBLISHED", async ({ page }) => {
    await loginAgent(page);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);

    await expect(page.getByRole("heading", { name: "تعديل بسيط" })).toBeVisible();
    await page
      .locator("#description_ar")
      .fill("وصف محدَّث بعد تعديل بسيط معتمد دون إعادة مراجعة.");
    await Promise.all([
      page.waitForURL(new RegExp("s=minor_saved")),
      page.getByRole("button", { name: "حفظ التعديل البسيط" }).click(),
    ]);
    await expect(page).toHaveURL(/s=minor_saved/);
    await expect(page.getByText("منشور").first()).toBeVisible();
  });

  test("E2 major edit atomically re-enters PENDING_REVIEW", async ({ page }) => {
    await loginAgent(page);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);

    await page.getByRole("heading", { name: "تعديل جوهري" }).waitFor();
    await page.locator("#price_amount").fill("13900");
    await Promise.all([
      page.waitForURL(new RegExp("s=major_submitted")),
      page.getByRole("button", { name: "إرسال التعديل الجوهري للمراجعة" }).click(),
    ]);
    await expect(page).toHaveURL(/s=major_submitted/);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);
    await expect(page.getByText("قيد المراجعة", { exact: true })).toBeVisible();
  });

  test("T4: REJECTED fixture edits and resubmits to PENDING_REVIEW", async ({ page }) => {
    await loginAgent(page);
    await page.goto(`/dashboard/offers/${OFFER_REJECTED_ID}/edit`);
    // Idempotency guard: a previous passing run already resubmitted this
    // fixture (it is now pending_review — terminal for this test until the
    // pre-run fixture reset restores it). Skip rather than fail.
    const isPending = await page
      .getByText("قيد المراجعة", { exact: true })
      .or(page.getByText("هذا العرض قيد مراجعة الإدارة حاليًا"))
      .count();
    test.skip(isPending > 0, "fixture already resubmitted by an earlier run");
    await expect(page.getByText("سبب الرفض", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect(page).toHaveURL(/s=saved/);

    await page.getByRole("button", { name: "إعادة إرسال للمراجعة" }).click();
    await expect(page).toHaveURL(/s=resubmitted/);
  });

  test("T6: EXPIRED fixture renews with a strictly newer valid_until", async ({ page }) => {
    await loginAgent(page);
    await page.goto(`/dashboard/offers/${OFFER_EXPIRED_ID}/edit`);

    // Idempotency guard: a previous passing run already renewed this fixture
    // (now pending_review until the pre-run fixture reset). Skip, not fail.
    const isPending = await page
      .getByText("قيد المراجعة", { exact: true })
      .or(page.getByText("هذا العرض قيد مراجعة الإدارة حاليًا"))
      .count();
    test.skip(isPending > 0, "fixture already renewed by an earlier run");

    const renewal = page.locator("#new_valid_until");
    await renewal.waitFor();
    const future = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    await renewal.fill(future);
    await page.getByRole("button", { name: /تجديد وإعادة إرسال|إعادة إرسال/ }).click();
    await expect(page).toHaveURL(/s=resubmitted/);
  });

  test("T7b: published→archived via owner unpublish path", async ({ page }) => {
    // Re-approve the major-edit so a published row exists to archive.
    await loginAdminMfa(page);
    await page.goto(`/admin/offers/${CREATED_ID}`);
    await Promise.all([
      page.waitForURL(new RegExp("s=approved")),
      page.getByRole("button", { name: "اعتماد ونشر" }).click(),
    ]);
    await expect(page).toHaveURL(/s=approved/);

    await loginAgent(page);
    await page.goto(`/dashboard/offers/${CREATED_ID}/edit`);
    await Promise.all([
      page.waitForURL(new RegExp("s=archived")),
      page.getByRole("button", { name: "أرشفة العرض" }).click(),
    ]);
    await expect(page).toHaveURL(/s=archived/);
  });

  test("SECURITY: agent cannot open another agent's offer editor", async ({ page }) => {
    await loginAgent(page); // agent1
    const resp = await page.goto(`/dashboard/offers/${OFFER_AGENT2_PUBLISHED_ID}/edit`);
    expect(resp?.status()).toBe(404);
  });

  test("SECURITY: agent is redirected away from /admin", async ({ page }) => {
    await loginAgent(page);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });
});

test.describe.serial("SLICE 2 — verification flow + 30-day cooldown", () => {
  test("cooldown blocks immediate resubmission after rejection (server-side)", async ({
    page,
  }) => {
    await page.goto("/login?next=/dashboard/verification");
    await page.locator("#email").fill("e2e-agent2@e2e.local");
    await page.locator("#password").fill("Passw0rd!E2E");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(/\/dashboard\/verification/);

    await page.getByRole("button", { name: "بدء طلب التوثيق" }).click();
    // Decision 3: the BEFORE INSERT trigger rejects while inside 30 days.
    await expect(page.getByTestId("vf-error")).toContainText("verification_cooldown_active");
  });

  test("admin reject requires a reason note", async ({ page }) => {
    await loginAdminMfa(page);
    await page.goto("/admin/agents");

    const card = page.locator("[data-testid^='vreq-']").first();
    const count = await card.count();
    test.skip(count === 0, "no in_review verification requests right now");
    await card.getByRole("button", { name: "رفض الطلب" }).click();
    // Missing note → server-side guard redirects with an error parameter:
    await expect(page).toHaveURL(/e=/);
  });
});
