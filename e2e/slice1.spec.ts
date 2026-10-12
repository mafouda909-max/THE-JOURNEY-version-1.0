import { expect, test, type Page } from "@playwright/test";

/**
 * Slice 1 discovery flow (AD-13 loop 1) — guest: HOME → SEARCH → RESULTS →
 * OFFER DETAIL → AGENT PROFILE, against STAGING demo fixtures through the
 * staging preview projections (non-production build only).
 *
 * Deterministic fixture IDs (db/seeds/demo/0010_discovery_demo.sql):
 *   flight …101 · package …102 · umrah …103 · visa …104 · hotel …105 ·
 *   cruise/expiring …106 · custom …107 · agent1 profile …011
 */

const FLIGHT_OFFER_ID = "00000000-0000-4000-8000-000000000101";
const CRUISE_OFFER_ID = "00000000-0000-4000-8000-000000000106";
const AGENT_1_ID = "00000000-0000-4000-8000-000000000011";
const FLIGHT_TITLE = "طيران القاهرة إلى إسطنبول — ذهاب وعودة";

const resultsCards = (page: Page) =>
  page.locator('section[aria-label="نتائج البحث"] a[href^="/offers/"]');

test.describe("A. Home", () => {
  test("loads with Arabic RTL, hero search, and demo featured offers", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "مسافر منين ورايح فين؟",
    );
    const hero = page.locator('section[aria-label="ابحث عن رحلتك"]');
    await expect(hero).toBeVisible();
    await expect(hero.locator("#hero-dest")).toBeVisible();
    // Demo fixtures surface through the staging preview projection:
    await expect(page.locator(`a[href="/offers/${FLIGHT_OFFER_ID}"]`)).toBeVisible();
  });
});

test.describe("B. Search", () => {
  test("destination autocomplete drives URL-driven results", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#hero-dest");
    await input.fill("قاهر");
    const listbox = page.locator("#hero-dest-listbox");
    await expect(listbox).toBeVisible();
    // search_places RPC returns the city AND its airport (diacritic-normalized):
    await expect(
      listbox.getByRole("option").filter({ hasText: "القاهرة" }).first(),
    ).toBeVisible();
    await listbox.getByRole("option").filter({ hasText: "القاهرة" }).first().click();
    await page.getByRole("button", { name: "ابحث" }).click();

    // URL carries the canonical city slug:
    await expect(page).toHaveURL(/\/offers\?dest=cairo/);

    // D1 FIXED (Phase C slug resolution): dest=cairo resolves to the city
    // UUID; only visa …104 + custom …107 are Cairo-destined demo fixtures.
    await expect(resultsCards(page)).toHaveCount(2);
    await expect(page.locator(`a[href="/offers/00000000-0000-4000-8000-000000000104"]`)).toBeVisible();
    await expect(page.locator(`a[href="/offers/00000000-0000-4000-8000-000000000107"]`)).toBeVisible();
  });

  test("results render all published demo fixtures with expiring pill", async ({ page }) => {
    await page.goto("/offers");
    await expect(resultsCards(page)).toHaveCount(7);
    await expect(page.locator(`a[href="/offers/${CRUISE_OFFER_ID}"]`)).toContainText(
      "ينتهي قريبًا",
    );
    await expect(
      page.locator(`a[href="/offers/${FLIGHT_OFFER_ID}"]`).locator("h3"),
    ).toHaveText(FLIGHT_TITLE);
  });

  test("sort control mutates URL and reorders (price ascending)", async ({ page }) => {
    await page.goto("/offers");
    await page.locator("#sort-control").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    // Cheapest raw amount across fixtures is the hotel offer (1200 EUR):
    await expect(resultsCards(page).first().locator("h3")).toHaveText(
      "إقامة أنطاليا — منتجع شامل 7 ليالٍ",
    );
    // G. URL state persists across refresh:
    await page.reload();
    await expect(page.locator("#sort-control")).toHaveValue("price_asc");
    await expect(resultsCards(page).first().locator("h3")).toHaveText(
      "إقامة أنطاليا — منتجع شامل 7 ليالٍ",
    );
  });
});

test.describe("C. Offer Detail", () => {
  test("renders title, route, price, validity, verified agent, breadcrumb, metadata", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(`a[href="/offers/${FLIGHT_OFFER_ID}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/offers/${FLIGHT_OFFER_ID}$`));

    // Breadcrumb:
    const crumb = page.locator('nav[aria-label="مسار التنقل"]');
    await expect(crumb).toBeVisible();
    await expect(crumb.getByRole("link", { name: "الرئيسية" })).toBeVisible();
    await expect(crumb.getByRole("link", { name: "العروض" })).toBeVisible();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FLIGHT_TITLE);
    await expect(page.getByText("إسطنبول").first()).toBeVisible();
    await expect(page.getByText(/18,500\s*EGP/)).toBeVisible();
    await expect(page.getByText("صالح حتى")).toBeVisible();
    // Verified-agent signal links to the profile:
    const agentLink = page.locator(`a[href="/agents/${AGENT_1_ID}"]`);
    await expect(agentLink).toContainText("وكيل موثّق");
    // SEO metadata from generateMetadata:
    await expect(page).toHaveTitle(new RegExp(FLIGHT_TITLE));
  });
});

test.describe("D. Agent Profile", () => {
  test("opens from offer detail and lists the agent's published offers", async ({ page }) => {
    await page.goto(`/offers/${FLIGHT_OFFER_ID}`);
    await page.locator(`a[href="/agents/${AGENT_1_ID}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_1_ID}$`));

    await expect(page.getByText("رحلات الشرق").first()).toBeVisible();
    // Agent 1 owns flight …101, umrah …103 and custom …107:
    await expect(
      page.locator('a[href^="/offers/"]').filter({ hasText: "عمرة اقتصادي" }),
    ).toBeVisible();
    await expect(page.locator('nav[aria-label="مسار التنقل"]')).toBeVisible();
  });
});

test.describe("E. States", () => {
  test("loading skeletons render before data arrives", async ({ page }) => {
    // Gate the transport closed until we've asserted the skeleton — fully
    // deterministic regardless of device/hydration speed.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/rest/v1/public_offers_staging**", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/offers");
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    release();
    await expect(resultsCards(page).first()).toBeVisible();
  });

  test("empty state for filters matching nothing (D3 regression)", async ({ page }) => {
    // Well-formed UUID that matches no city → honest empty result set.
    // Regression: D3 operator-precedence bug rendered `true` instead of
    // <EmptyResults/> when status === "empty" — the state was invisible.
    await page.goto("/offers?dest=00000000-0000-4000-8000-999999999999");
    await expect(page.getByText("لا توجد نتائج مطابقة")).toBeVisible();
    await expect(page.getByRole("button", { name: "مسح كل الفلاتر" })).toBeVisible();
  });

  test("error state appears when the data source fails", async ({ page }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await page.goto("/offers");
    // Scope to the results region: Next's route announcer also has role=alert.
    const alert = page
      .locator('section[aria-label="نتائج البحث"]')
      .getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "إعادة المحاولة" })).toBeVisible();
  });

  test("retry refetches and recovers after a transient failure (D2 regression)", async ({ page }) => {
    // Regression: D2 — retry was setPage(1), a no-op on page-1 failures;
    // requestKey never changed and no refetch fired. The reload key now
    // guarantees the query executes again.
    let failing = true;
    await page.route("**/rest/v1/public_offers_staging**", async (route) => {
      if (failing) return route.abort();
      return route.fallback();
    });
    await page.goto("/offers");
    // Scope to results section — Next's route announcer also has role=alert.
    const alert = page
      .locator('section[aria-label="نتائج البحث"]')
      .getByRole("alert");
    await expect(alert).toBeVisible();

    failing = false;
    await alert.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(resultsCards(page)).toHaveCount(7);
    await expect(
      page.locator('section[aria-label="نتائج البحث"]').getByRole("alert"),
    ).toHaveCount(0);
  });
});

test.describe("G. URL/state behavior", () => {
  test("filters round-trip through the URL and survive refresh", async ({ page }) => {
    await page.goto("/");
    await page.locator("#hero-dest").fill("قاهر");
    const listbox = page.locator("#hero-dest-listbox");
    await listbox.getByRole("option").filter({ hasText: "القاهرة" }).first().click();
    await page.getByRole("button", { name: "ابحث" }).click();

    await expect(page).toHaveURL(/dest=cairo/);
    await expect(resultsCards(page)).toHaveCount(2);

    // Refresh preserves the URL-encoded filter state and re-resolves it:
    await page.reload();
    await expect(page).toHaveURL(/dest=cairo/);
    await expect(resultsCards(page)).toHaveCount(2);
  });
});
