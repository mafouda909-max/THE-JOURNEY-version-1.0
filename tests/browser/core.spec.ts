import { expect, test, type Page } from "@playwright/test";

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


test("traveler workspace saves, rechecks and isolates Travel Advisor memory", async ({
  browser,
  page,
}, testInfo) => {
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const suffix = projectSlug + "-" + Date.now().toString(36);
  const travelerAEmail = "traveler-a-" + suffix + "@example.invalid";
  const travelerBEmail = "traveler-b-" + suffix + "@example.invalid";
  const password = "SILA traveler browser proof 2026!";
  const tripLabel = "رحلة ذاكرة " + projectSlug;

  async function signUpTraveler(target: typeof page, email: string, name: string) {
    await target.goto("/join?mode=new-traveler", { waitUntil: "networkidle" });
    await expect(target.getByRole("heading", { name: "حساب مسافر جديد" })).toBeVisible();
    await target.getByLabel("اسم المسافر", { exact: true }).fill(name);
    await target.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await target.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await target.getByLabel("تأكيد كلمة المرور", { exact: true }).fill(password);
    await target.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
    await expect(target).toHaveURL(/\/account\/travel(?:\?|$)/);
    await expect(target.getByRole("heading", { name: "رحلاتك المحفوظة من النية إلى العرض والطلب." })).toBeVisible();
  }

  await signUpTraveler(page, travelerAEmail, "مسافر اختبار A");

  await page.locator('input[name="label"]').fill(tripLabel);
  await page.locator('input[name="originCity"]').fill("Cairo");
  await page.locator('input[name="destination"]').fill("TEST");
  await page.locator('input[name="departureDate"]').fill("2026-12-15");
  await page.locator('input[name="returnDate"]').fill("2026-12-22");
  await page.getByRole("button", { name: "احفظ نية السفر", exact: true }).click();

  const tripCard = page.locator("article").filter({ hasText: tripLabel });
  await expect(tripCard).toBeVisible();
  await expect(tripCard.getByText("لم تُحفظ نتيجة جاهزية لهذه الرحلة بعد.", { exact: false })).toBeVisible();
  const readinessLink = tripCard.getByRole("link", { name: "ابدأ فحص الجاهزية", exact: true });
  const readinessHref = await readinessLink.getAttribute("href");
  expect(readinessHref).toMatch(/^\/readiness\?intentId=\d+$/);
  const intentId = Number(new URL(readinessHref!, "http://localhost:3000").searchParams.get("intentId"));
  expect(intentId).toBeGreaterThan(0);

  await readinessLink.click();
  await expect(page.getByText("فحص الجاهزية مرتبط برحلتك المحفوظة: " + tripLabel + ".", { exact: false })).toBeVisible();
  await expect(page.getByLabel("الوجهة", { exact: true })).toHaveValue("TEST");
  await expect(page.getByLabel("مدينة الانطلاق", { exact: true })).toHaveValue("Cairo");
  await expect(page.getByLabel("تاريخ السفر إن تحدد", { exact: true })).toHaveValue("2026-12-15");

  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  await page.locator('select[name="travelPurpose"]').selectOption("tourism");
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  await page.locator('input[name="advisor.tourism_accommodation"]').fill("مرنة");
  await page.locator('input[name="advisor.tourism_onward"]').fill("نعم");
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();

  await expect(page.getByText("تحديث الرحلة المحفوظة", { exact: true })).toBeVisible();
  await expect(page.getByText("أول فحص محفوظ", { exact: true })).toBeVisible();
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toBeVisible();

  await page.goto("/account/travel", { waitUntil: "networkidle" });
  const firstSavedCard = page.locator("article").filter({ hasText: tripLabel });
  await expect(firstSavedCard.getByText("أول فحص محفوظ", { exact: true })).toBeVisible();
  await expect(firstSavedCard.getByRole("link", { name: "أعد فحص الرحلة", exact: true })).toBeVisible();

  await firstSavedCard.getByRole("link", { name: "أعد فحص الرحلة", exact: true }).click();
  await expect(page.getByLabel("الجنسية", { exact: true })).toHaveValue("QA");
  await expect(page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true })).toHaveValue("12");
  await expect(page.locator('select[name="travelPurpose"]')).toHaveValue("tourism");
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  await expect(page.getByText("لا تغيير في القرار", { exact: true })).toBeVisible();

  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("0");
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  await page.locator('input[name="advisor.tourism_accommodation"]').fill("مرنة");
  await page.locator('input[name="advisor.tourism_onward"]').fill("نعم");
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();
  await expect(page.getByText("القرار تغيّر منذ آخر فحص", { exact: true })).toBeVisible();
  await expect(page.getByText(/تغيّر: .*status/)).toBeVisible();

  await page.goto("/account/travel", { waitUntil: "networkidle" });
  const changedCard = page.locator("article").filter({ hasText: tripLabel });
  await expect(changedCard.getByText("القرار تغيّر", { exact: true })).toBeVisible();
  await expect(changedCard.getByText(/تغيّر: .*status/)).toBeVisible();

  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  const contextB = await browser.newContext({ baseURL });
  const pageB = await contextB.newPage();
  try {
    await signUpTraveler(pageB, travelerBEmail, "مسافر اختبار B");

    const ownIntents = await pageB.context().request.get("/api/traveler/intents");
    expect(ownIntents.status()).toBe(200);
    const ownJson = await ownIntents.json();
    expect(Array.isArray(ownJson.intents)).toBe(true);
    expect(ownJson.intents.some((intent: { id?: number }) => intent.id === intentId)).toBe(false);

    await pageB.goto("/readiness?intentId=" + intentId, { waitUntil: "networkidle" });
    await expect(pageB.getByText(tripLabel, { exact: false })).toHaveCount(0);
    await expect(pageB.getByLabel("الوجهة", { exact: true })).toHaveValue("");

    const forged = await pageB.context().request.post("/api/travel/readiness", {
      data: {
        nationality: "QA",
        destination: "TEST",
        passportValidityMonths: 12,
        travelPurpose: "tourism",
        savedIntentId: intentId,
      },
    });
    expect(forged.status()).toBe(404);
    expect(await forged.json()).toEqual({
      error: "الرحلة المحفوظة غير موجودة أو لا تخص هذا الحساب.",
    });
  } finally {
    await contextB.close();
  }

  await page.goto("/readiness", { waitUntil: "networkidle" });
  await expect(page.getByLabel("الوجهة", { exact: true })).toBeVisible();
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

async function openDetailedReadiness(page: Page) {
  await expect(page.getByText("مستشار صلة داخل المنصة", { exact: true })).toBeVisible();
  const detailed = page.getByText("افتح الفحص التفصيلي والمصادر والعروض", { exact: true });
  await detailed.scrollIntoViewIfNeeded();
  await detailed.click();
  await expect(page.getByText("هنبني لك صورة الرحلة، مش مجرد نسبة.")).toBeVisible();
}

test("readiness begins in an unknown/not-evaluated state and does not invent a visa answer", async ({
  page,
}) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await openDetailedReadiness(page);
  await expect(page.locator("body")).not.toContainText("تأشيرتك مؤكدة");
});

test("readiness evaluates submitted inputs and returns a bounded result", async ({
  page,
}) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await openDetailedReadiness(page);

  await page.locator('input[name="nationality"]').fill("Example");
  await page.locator('input[name="destination"]').fill("Sample");
  await page.locator('input[name="passportValidityMonths"]').fill("12");
  await page.locator('select[name="travelPurpose"]').selectOption("tourism");
  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();

  await expect(page.getByText("قبل ما نبحث", { exact: true })).toBeVisible();
  await page.locator('input[name="advisor.tourism_accommodation"]').fill("مرنة");
  await page.locator('input[name="advisor.tourism_onward"]').fill("غير متأكد");
  await page.getByRole("button", { name: "كمّل البحث" }).click();

  await expect(page.getByText("حالة الجاهزية")).toBeVisible();
  await expect(page.getByText(/صلة تجمع بين الأدلة المنظمة/)).toBeVisible();
  await expect(page.getByText("ملف التجهيز", { exact: true })).toBeVisible();
  await expect(page.getByText("الإقامة وإثبات مكان السكن", { exact: true })).toBeVisible();
  await expect(page.getByText("يحتاج تأكيدًا رسميًا", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("يحتاج إجراء منك", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("البحث المباشر غير مفعّل في بيئة التشغيل الحالية؛ لا نحوله إلى إجابة متخيلة.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("تأشيرتك مؤكدة");
  await expect(page.locator("body")).not.toContainText("دخولك مضمون");
});

test("readiness can ask a second decision question and preserve earlier answers", async ({ page }) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await openDetailedReadiness(page);
  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("الوجهة", { exact: true }).fill("TEST");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  await page.locator('select[name="travelPurpose"]').selectOption("tourism");
  await page.getByText("تفاصيل إضافية لنتيجة أدق", { exact: true }).click();
  await page.getByLabel("دولة الترانزيت إن وجدت", { exact: true }).fill("OTHER");

  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();
  await page.locator('input[name="advisor.tourism_accommodation"]').fill("مرنة");
  await page.locator('input[name="advisor.tourism_onward"]').fill("نعم");
  await page.getByRole("button", { name: "كمّل البحث" }).click();

  await expect(page.locator('input[name="advisor.decision_transit_route"]')).toBeVisible();
  await page.locator('input[name="advisor.decision_transit_route"]').fill(
    "CAI → FCO → MAD على نفس شركة الطيران",
  );
  await page.locator('select[name="advisor.decision_transit_connection"]').selectOption("same_terminal");
  await page.locator('select[name="advisor.decision_transit_baggage"]').selectOption("through");
  await page.locator('select[name="advisor.decision_transit_airside"]').selectOption("airside");
  await page.locator('input[name="advisor.decision_transit_layover_minutes"]').fill("180");
  await page.getByRole("button", { name: "كمّل البحث" }).click();

  await expect(page.getByText("حالة الجاهزية", { exact: true })).toBeVisible();
  await expect(page.getByText("صورة القرار", { exact: true })).toBeVisible();
  await expect(page.getByText("بنية مسار الترانزيت", { exact: true })).toBeVisible();
  await expect(page.getByText("تحليل مسار الترانزيت", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تعقيد تشغيلي أقل حسب وصفك", exact: true })).toBeVisible();
  await page.getByText("حدود تحليل المسار", { exact: true }).click();
  await expect(page.getByText(/لم تتم مقارنة مدة التوقف بحد Minimum Connection Time رسمي/)).toBeVisible();
  await expect(page.locator('input[name="advisor.tourism_accommodation"]')).toHaveCount(0);
  await expect(page.locator('input[name="advisor.decision_transit_route"]')).toHaveCount(0);
});

test("readiness rejects invalid inputs and malformed structured route answers", async ({ request }) => {
  const valid = { nationality: "QA", destination: "TEST", passportValidityMonths: 12, travelPurpose: "tourism" };
  for (const data of [
    { ...valid, passportValidityMonths: null },
    { ...valid, destination: "a".repeat(65) },
    { ...valid, travelDate: "2026-02-30" },
    { ...valid, advisorAnswers: { transit_country: "x" } },
    { ...valid, advisorAnswers: { decision_transit_connection: "banana" } },
    { ...valid, advisorAnswers: { decision_transit_baggage: "maybe" } },
    { ...valid, advisorAnswers: { decision_transit_airside: "external" } },
    { ...valid, advisorAnswers: { decision_transit_layover_minutes: "1441" } },
    { ...valid, advisorAnswers: { decision_transit_layover_minutes: "maybe" } },
  ]) {
    const response = await request.post("/api/travel/readiness", { data });
    expect(response.status()).toBe(422);
  }
});

test("readiness failures and partial successes cannot show a decision; retry and input changes work", async ({ page }, testInfo) => {
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await openDetailedReadiness(page);
  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("الوجهة", { exact: true }).fill("TEST");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  await page.locator('select[name="travelPurpose"]').selectOption("tourism");
  let phase: "failure" | "partial" | "real" = "failure";
  await page.route("**/api/travel/readiness", async route => {
    if (phase === "real") { await route.continue(); return; }
    await route.fulfill({ status: phase === "failure" ? 503 : 200, json: phase === "failure" ? { error: "تعذر فحص المصادر حاليًا. لم تصدر نتيجة؛ حاول مجددًا." } : { status: "READY", checklist: [] } });
  });
  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("لم تصدر نتيجة");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  phase = "partial";
  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("نتيجة مكتملة");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  phase = "real";
  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();
  await expect(page.getByText("قبل ما نبحث", { exact: true })).toBeVisible();
  await page.locator('input[name="advisor.tourism_accommodation"]').fill("مرنة");
  await page.locator('input[name="advisor.tourism_onward"]').fill("غير متأكد");
  await page.getByRole("button", { name: "كمّل البحث" }).click();
  await expect(page.getByRole("heading", { name: "غير معروف بعد", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "شرط التأشيرة غير معروف بعد", exact: true })).toBeVisible();
  await expect(page.getByText("نطاق الدليل:", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("آخر فحص مسجل:", { exact: true }).first()).toBeVisible();
  await expect(page.locator("section[aria-label='نتيجة جاهزية السفر']")).not.toContainText("%");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/readiness-scoped-" + testInfo.project.name + ".png", fullPage: true });
  await page.getByLabel("الوجهة", { exact: true }).fill("OTHER");
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ابدأ مع صلة" })).toBeEnabled();
});

test("readiness client cancels a stalled request and allows retry", async ({ page }) => {
  await page.clock.install();
  await page.goto("/readiness", { waitUntil: "networkidle" });
  await openDetailedReadiness(page);
  await page.getByLabel("الجنسية", { exact: true }).fill("QA");
  await page.getByLabel("الوجهة", { exact: true }).fill("TEST");
  await page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true }).fill("12");
  await page.locator('select[name="travelPurpose"]').selectOption("tourism");
  await page.route("**/api/travel/readiness", () => {});
  await page.getByRole("button", { name: "ابدأ مع صلة" }).click();
  await expect(page.getByRole("button", { name: "نراجع ونبحث…" })).toBeDisabled();
  await page.clock.fastForward(24_000);
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toContainText("استغرق الفحص وقتًا طويلًا");
  await expect(page.getByRole("button", { name: "ابدأ مع صلة" })).toBeEnabled();
  await expect(page.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
});

test("real readiness database timeout returns 503 and the HTTP server recovers", async ({ request }) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  expect(url.pathname).toBe("/journey_browser");
  const { Client } = await import("pg");
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  const input = {
    nationality: "QA",
    destination: "TEST",
    passportValidityMonths: 12,
    travelPurpose: "tourism",
    advisorAnswers: {
      tourism_accommodation: "مرنة",
      tourism_onward: "غير متأكد",
    },
  };
  try {
    await lock.query("BEGIN");
    await lock.query("LOCK TABLE travel_knowledge IN ACCESS EXCLUSIVE MODE");
    const started = Date.now();
    const failed = await request.post("/api/travel/readiness", { data: input, timeout: 15_000 });
    expect(failed.status()).toBe(503);
    const response = await failed.json();
    expect(response.code).toBe("DATA_UNAVAILABLE");
    expect(response.status).toBeUndefined();
    expect(response.checklist).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(12_000);
  } finally {
    await lock.query("ROLLBACK").catch(() => {});
    await lock.end();
  }
  const recovered = await request.post("/api/travel/readiness", { data: input, timeout: 15_000 });
  expect(recovered.status()).toBe(200);
  const result = await recovered.json();
  expect(result.status).toBe("UNKNOWN");
  expect(result.checklist.some((item: { category: string; status: string }) => item.category === "VISA" && item.status === "UNKNOWN")).toBe(true);
});
