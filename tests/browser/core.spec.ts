import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/offers",
  "/compare",
  "/readiness",
  "/join",
  "/community",
];

for (const route of publicRoutes) {
  test(`renders ${route} in Arabic RTL without horizontal overflow`, async ({
    page,
  }) => {
    const pending = new Map<object, string>();
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });
    const requests = new Map<string, number>();
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      pending.set(request, path);
      requests.set(path, (requests.get(path) ?? 0) + 1);
    });
    page.on("requestfinished", (request) => pending.delete(request));
    page.on("requestfailed", (request) => pending.delete(request));
    const response = await page.goto(route, { waitUntil: "networkidle" }).catch((error) => {
      // Paths only: no cookies, query strings, bodies or response payloads.
      console.error("Public navigation did not settle", {
        route,
        pending: [...pending.values()].slice(0, 10),
        frequent: [...requests].sort((a, b) => b[1] - a[1]).slice(0, 10),
      });
      throw error;
    });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    expect(runtimeErrors).toEqual([]);
  });
}

test("join offers the password pilot while Google and email providers remain disabled", async ({
  page,
  request,
}) => {
  await page.goto("/join", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "تسجيل الدخول" }),
  ).toBeVisible();

  const config = await request.get("/api/auth/config");
  expect(config.ok()).toBeTruthy();
  expect(await config.json()).toEqual({
    google: false,
    magic: false,
    password: true,
    recovery: false,
    legacyPassword: false,
  });

  await expect(
    page.getByText("التسجيل العام مخصص للمسافرين والوكلاء", { exact: false }),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(1);
  const session = await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toEqual({ role: null });
  expect(session.headers()["cache-control"]).toBe("private, no-store");
});

test("traveler and agency protected surfaces redirect unauthenticated users to join", async ({
  page,
}) => {
  await page.goto("/account", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/join(?:\?|$)/);

  await page.goto("/account/agency", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/join(?:\?|$)/);
});

test("admin review requires a signed session before fetching the desk", async ({
  page,
}) => {
  await page.goto("/review", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "منطقة فريق الثقة" }),
  ).toBeVisible();
  if (process.env.ADMIN_API_KEY) {
    await expect(page.locator('input[name="key"]')).toBeVisible();
  } else {
    await expect(page.getByText("الصلاحيات غير مهيأة بعد")).toBeVisible();
    await expect(page.locator('input[name="key"]')).toHaveCount(0);
  }
  await expect(page.getByRole("region", { name: "قدرات صلة" })).toHaveCount(0);
});

test("private offers and unapproved agents stay out of public discovery", async ({
  page,
}) => {
  await page.goto("/offers", { waitUntil: "networkidle" });
  await expect(page.getByText("لا توجد عروض منشورة حتى الآن.")).toBeVisible();

  await page.goto("/agents", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "مكتب اختبار 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "مكتب اختبار 2", exact: true }),
  ).toHaveCount(0);
});

test("compare keeps supplier and currency identifiers legible inside RTL UI", async ({
  page,
}) => {
  await page.goto("/compare", { waitUntil: "networkidle" });
  await expect(page.getByText("بحث الرحلات · قراءة فقط")).toBeVisible();
  const currency = page.locator('select[name="currency"]');
  await expect(currency).toBeVisible();
  await expect(currency.locator("option")).toContainText([
    "EGP",
    "SAR",
    "AED",
    "USD",
    "EUR",
  ]);
});

test("readiness begins in an unknown/not-evaluated state and does not invent a visa answer", async ({
  page,
}) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(
    page.getByText("الـChecklist تتكوّن من سياقك أنت."),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("تأشيرتك مؤكدة");
});

test("readiness evaluates submitted inputs and returns a bounded result", async ({
  page,
}) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });

  await page.locator('input[name="nationality"]').fill("Example");
  await page.locator('input[name="destination"]').fill("Sample");
  await page.locator('input[name="passportValidityMonths"]').fill("12");
  await page.getByRole("button", { name: "افحص الجاهزية" }).click();

  await expect(page.getByText("حالة الجاهزية")).toBeVisible();
  await expect(page.getByText(/هذا فحص جاهزية معلوماتي/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("تأشيرتك مؤكدة");
  await expect(page.locator("body")).not.toContainText("دخولك مضمون");
});

test("readiness rejects invalid inputs without empty-month coercion", async ({ request }) => {
  const valid = { nationality: "QA", destination: "TEST", passportValidityMonths: 12 };
  for (const data of [{ ...valid, passportValidityMonths: null },{ ...valid, destination: "a".repeat(65) },{ ...valid, travelDate: "2026-02-30" }]) {
    const response = await request.post("/api/travel/readiness", { data });
    expect(response.status()).toBe(422);
  }
});

test("readiness failures and partial successes cannot show a decision; retry and input changes work", async ({ page }, testInfo) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("وجهة السفر", { exact: true }).fill("TEST");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  let phase: "failure" | "partial" | "real" = "failure";
  await page.route("**/api/travel/readiness", async route => {
    if (phase === "real") { await route.continue(); return; }
    await route.fulfill({ status: phase === "failure" ? 503 : 200, json: phase === "failure" ? { error: "تعذر فحص المصادر حاليًا. لم تصدر نتيجة؛ حاول مجددًا." } : { status: "READY", checklist: [] } });
  });
  await page.getByRole("button", { name: "افحص الجاهزية" }).click();
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("لم تصدر نتيجة");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  phase = "partial";
  await page.getByRole("button", { name: "افحص الجاهزية" }).click();
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("نتيجة مكتملة");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  phase = "real";
  await page.getByRole("button", { name: "افحص الجاهزية" }).click();
  await expect(page.getByRole("heading", { name: "غير معروف بعد", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "شرط التأشيرة غير معروف بعد", exact: true })).toBeVisible();
  await expect(page.getByText("نطاق الدليل:", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("آخر فحص مسجل:", { exact: true }).first()).toBeVisible();
  await expect(page.locator("section[aria-label='نتيجة جاهزية السفر']")).not.toContainText("%");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/readiness-scoped-" + testInfo.project.name + ".png", fullPage: true });
  await page.getByLabel("وجهة السفر", { exact: true }).fill("OTHER");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "افحص الجاهزية" })).toBeEnabled();
});

test("readiness client cancels a stalled request and allows retry", async ({ page }) => {
  await page.clock.install();
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("وجهة السفر", { exact: true }).fill("TEST");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  await page.route("**/api/travel/readiness", () => {});
  await page.getByRole("button", { name: "افحص الجاهزية" }).click();
  await expect(page.getByRole("button", { name: "نفحص المصادر…" })).toBeDisabled();
  await page.clock.fastForward(24_000);
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("استغرق الفحص وقتًا طويلًا");
  await expect(page.getByRole("button", { name: "افحص الجاهزية" })).toBeEnabled();
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
});
