import { expect, test } from "@playwright/test";

/**
 * H. Production safety smoke (AD-17 #8 hard guard).
 * Runs against the PRODUCTION build (`next start`, NODE_ENV=production) with
 * NEXT_PUBLIC_DEMO_PREVIEW=true present in the environment — the canonical
 * views MUST win regardless, so no demo fixture is ever exposed.
 */

const FLIGHT_OFFER_ID = "00000000-0000-4000-8000-000000000101";
const FLIGHT_TITLE = "طيران القاهرة إلى إسطنبول — ذهاب وعودة";
const AGENT_ID = "00000000-0000-4000-8000-000000000011";

test("production home never renders demo fixtures", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  // The hard guard (AD-17 #8): demo fixtures NEVER surface through a
  // production build even when NEXT_PUBLIC_DEMO_PREVIEW=true is set.
  // Since Slice 3, staging also hosts ONE real (non-demo) contact-flow
  // fixture offer — real rows may render; demo rows may not.
  await expect(page.getByText(FLIGHT_TITLE)).toHaveCount(0);
  await expect(page.getByText("عرض تجريبي")).toHaveCount(0);
});

test("production offer detail cannot resolve demo rows", async ({ page }) => {
  await page.goto(`/offers/${FLIGHT_OFFER_ID}`);
  await expect(page.getByText("هذا العرض غير متاح")).toBeVisible();
  await expect(page.getByText(FLIGHT_TITLE)).toHaveCount(0);
});

/**
 * Load-more ×12 pagination contract, exercised in a REAL browser against the
 * production-mode app (effects fire exactly once) with a controlled
 * transport-level mock — no additional demo data inserted.
 * The mock matches BOTH view names (`public_offers**`), so it serves the
 * canonical source a production build requests.
 */
test("load-more pages by 12 until exhausted", async ({ page }) => {
  const TOTAL = 30;
  const PAGE_SIZE = 12;
  await page.route("**/rest/v1/public_offers**", async (route) => {
    // postgrest-js expresses .range() via offset/limit query params; fall back
    // to the Range header, then to the first page.
    const u = new URL(route.request().url());
    const limitParam = Number(u.searchParams.get("limit") ?? NaN);
    const offsetParam = Number(u.searchParams.get("offset") ?? NaN);
    let start: number;
    let end: number;
    if (Number.isFinite(offsetParam)) {
      const limit = Number.isFinite(limitParam) ? limitParam : PAGE_SIZE;
      start = offsetParam;
      end = offsetParam + limit - 1;
    } else {
      const range = route.request().headers()["range"] ?? `0-${PAGE_SIZE - 1}`;
      const m = /(\d+)-(\d+)/.exec(range);
      start = m ? Number(m[1]) : 0;
      end = Math.min(Number(m?.[2] ?? PAGE_SIZE - 1), TOTAL - 1);
    }
    start = Math.max(0, Math.min(start, TOTAL));
    end = Math.min(end, TOTAL - 1);
    const rows = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => {
      const n = start + i + 1;
      return {
        id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
        title_ar: `عرض تجريبي رقم ${n}`,
        trip_type: "flight",
        route_type: "direct",
        origin_city_ar: "القاهرة",
        destination_city_ar: `مدينة ${n}`,
        origin_airport_iata: null,
        destination_airport_iata: null,
        airline_id: null,
        airline_name_ar: null,
        airline_iata: null,
        departure_date: null,
        return_date: null,
        duration_days: 5,
        flexible_dates: false,
        price_amount: String(1000 + n),
        currency: "EGP",
        price_type: "fixed",
        price_basis: "per_person",
        includes: [],
        excludes: [],
        min_travelers: 1,
        max_travelers: 4,
        valid_from: new Date(Date.now() - 86_400_000).toISOString(),
        valid_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        published_at: new Date(Date.now() - 3_600_000).toISOString(),
        agent_id: AGENT_ID,
        agent_display_name: "وكيل تجريبي — رحلات الشرق",
        agent_avg_rating: null,
        agent_reviews_count: 0,
        agent_response_rate_pct: 0,
        agent_verified_at: new Date().toISOString(),
      };
    });
    await route.fulfill({
      status: 200,
      // CORS: without expose-headers the browser hides content-range from JS,
      // and supabase-js would parse count=null → infinite load-more.
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
        "content-range": `${start}-${end}/${TOTAL}`,
      },
      contentType: "application/json",
      body: JSON.stringify(rows),
    });
  });

  await page.goto("/offers");
  const cards = page.locator('section[aria-label="نتائج البحث"] a[href^="/offers/"]');
  await expect(cards).toHaveCount(PAGE_SIZE);
  const loadMore = page.getByRole("button", { name: "تحميل المزيد" });
  await loadMore.click();
  await expect(cards).toHaveCount(2 * PAGE_SIZE);
  await loadMore.click();
  await expect(cards).toHaveCount(TOTAL);
  await expect(loadMore).toBeHidden();
});
