import { test, expect } from "@playwright/test";
import { isReadinessQuestionsResponse, isReadinessResponse } from "../../src/lib/readiness-contract";

test("production health and strict readiness validation", async ({ request }) => {
  const health = await request.get("/api/health", { timeout: 25_000 });
  expect(health.status()).toBe(200);
  const state = await health.json();
  expect(state.ok).toBe(true);
  expect(state.database.status).toBe("HEALTHY");
  expect(state.deployment.commit).toBe(process.env.EXPECTED_PRODUCTION_SHA);

  const memory = await request.get("/api/health/traveler-memory", { timeout: 25_000 });
  expect(memory.status()).toBe(200);
  const memoryState = await memory.json();
  expect(memoryState.status).toBe("READY");
  expect(memoryState.safeToEnable).toBe(true);
  expect(memoryState.database.connected).toBe(true);
  expect(memoryState.database.managedNeon).toBe(true);
  expect(memoryState.database.branchIdentityPresent).toBe(true);
  expect(memoryState.database.notLegacy).toBe(true);
  expect(memoryState.schema.ready).toBe(true);

  for (const invalid of [
    { nationality: "مصر", destination: "تركيا", passportValidityMonths: null },
    { nationality: "مصر", destination: "تركيا", passportValidityMonths: 12, travelDate: "2026-02-30" },
    { nationality: "مصر", destination: "x".repeat(65), passportValidityMonths: 12 },
  ]) {
    const response = await request.post("/api/travel/readiness", { data: invalid, timeout: 25_000 });
    expect(response.status()).toBe(422);
    expect((await response.json()).status).toBeUndefined();
  }
});

test("production browser follows live scoped evidence, clears edits and reevaluates clean states", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const initial = await page.goto("/readiness", { waitUntil: "networkidle" });
  expect(initial?.status()).toBe(200);
  const detailed = page.getByText("افتح الفحص التفصيلي والمصادر والعروض", { exact: true });
  await detailed.scrollIntoViewIfNeeded();
  await detailed.click();
  await expect(page.getByText("هنبني لك صورة الرحلة، مش مجرد نسبة.")).toBeVisible();
  const nationality = page.getByLabel("الجنسية", { exact: true });
  const destination = page.getByLabel("الوجهة", { exact: true });
  const months = page.getByLabel("صلاحية الجواز المتبقية بالأشهر", { exact: true });
  await nationality.fill("مصر");
  await destination.fill("تركيا");
  await months.fill("12");
  await page.getByLabel("الغرض من السفر", { exact: true }).selectOption("tourism");
  await page.getByLabel("تاريخ السفر إن تحدد", { exact: true }).fill("2026-12-01");
  await page.getByText("تفاصيل إضافية لنتيجة أدق", { exact: true }).click();
  const transitCountry = page.getByLabel("دولة الترانزيت إن وجدت", { exact: true });
  await transitCountry.fill("إيطاليا");
  const questionsResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/travel/readiness") && response.request().method() === "POST", { timeout: 25_000 });
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  const questionsResponse = await questionsResponsePromise;
  expect(questionsResponse.status()).toBe(200);
  const questionsResult: unknown = await questionsResponse.json();
  expect(isReadinessQuestionsResponse(questionsResult)).toBe(true);
  if (!isReadinessQuestionsResponse(questionsResult)) throw new Error("Production did not request material trip context first");
  await page.getByLabel("هل حجزت الإقامة أم ما زالت مرنة؟", { exact: true }).fill("مرنة");
  await page.getByLabel("هل لديك تذكرة عودة أو سفر لاحق؟", { exact: true }).fill("غير متأكد");

  const routeQuestionsResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/travel/readiness") && response.request().method() === "POST", { timeout: 25_000 });
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();
  const routeQuestionsResponse = await routeQuestionsResponsePromise;
  expect(routeQuestionsResponse.status()).toBe(200);
  const routeQuestionsResult: unknown = await routeQuestionsResponse.json();
  expect(isReadinessQuestionsResponse(routeQuestionsResult)).toBe(true);
  if (!isReadinessQuestionsResponse(routeQuestionsResult)) throw new Error("Production did not request route structure before research");
  expect(routeQuestionsResult.questions.map(question => question.id)).toEqual([
    "decision_transit_route",
    "decision_transit_connection",
    "decision_transit_baggage",
    "decision_transit_airside",
    "decision_transit_layover_minutes",
  ]);

  await page.locator('input[name="advisor.decision_transit_route"]').fill("CAI → FCO → IST على نفس شركة الطيران");
  await page.locator('select[name="advisor.decision_transit_connection"]').selectOption("same_terminal");
  await page.locator('select[name="advisor.decision_transit_baggage"]').selectOption("through");
  await page.locator('select[name="advisor.decision_transit_airside"]').selectOption("airside");
  await page.locator('input[name="advisor.decision_transit_layover_minutes"]').fill("180");

  const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/travel/readiness") && response.request().method() === "POST", { timeout: 25_000 });
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result: unknown = await response.json();
  expect(isReadinessResponse(result)).toBe(true);
  if (!isReadinessResponse(result)) throw new Error("Production returned an invalid decision contract");
  expect(result.advisor?.routeIntelligence.complexity).toBe("LOW");
  expect(result.decisionDossier?.groups.some(group => group.topic === "transit_route")).toBe(true);
  expect(result.status).not.toBe("READY");
  expect(result.checklist.find(item => item.category === "PASSPORT")?.status).toBe("PENDING_CONFIRMATION");
  const region = page.getByRole("region", { name: "نتيجة جاهزية السفر" });
  await expect(region.getByText("حالة الجاهزية", { exact: true })).toBeVisible();
  await expect(region).not.toContainText("%");
  await expect(region.getByText("نطاق الدليل:", { exact: true }).first()).toBeVisible();
  await expect(region.getByText("آخر فحص مسجل:", { exact: true }).first()).toBeVisible();
  await expect(region.getByText("المصدر:", { exact: true }).first()).toBeVisible();
  await expect(region.getByText(/الخطوة التالية:/).first()).toBeVisible();
  await expect(region.getByText("تحليل مسار الترانزيت", { exact: true })).toBeVisible();
  await expect(region.getByRole("heading", { name: "تعقيد تشغيلي أقل حسب وصفك", exact: true })).toBeVisible();
  await region.getByText("حدود تحليل المسار", { exact: true }).click();
  await expect(region.getByText(/لم تتم مقارنة مدة التوقف بحد Minimum Connection Time رسمي/)).toBeVisible();
  await expect(region).not.toContainText("دخولك مضمون");
  await expect(region).not.toContainText("تأشيرتك مؤكدة");
  await expect(page.getByRole("alert", { name: "خطأ فحص الجاهزية" })).toHaveCount(0);
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "production-test-results/readiness-" + testInfo.project.name + ".png", fullPage: true });
  await testInfo.attach("production-readiness-result", { body: JSON.stringify({ status: result.status, routeComplexity: result.advisor?.routeIntelligence.complexity ?? null, checklist: result.checklist.map(item => ({ category: item.category, status: item.status, evidenceStatus: item.evidence.status })), evaluatedAt: result.evaluatedAt }), contentType: "application/json" });

  await transitCountry.fill("");
  await destination.fill("مصر");
  await expect(region.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  await page.getByLabel("هل حجزت الإقامة أم ما زالت مرنة؟", { exact: true }).fill("مرنة");
  await page.getByLabel("هل لديك تذكرة عودة أو سفر لاحق؟", { exact: true }).fill("نعم");
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();
  await expect(region.getByText("حالة الجاهزية", { exact: true })).toBeVisible();
  await expect(region).not.toContainText("%");
  await months.fill("0");
  await expect(region.getByText("حالة الجاهزية", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ابدأ مع صلة", exact: true }).click();
  await page.getByLabel("هل حجزت الإقامة أم ما زالت مرنة؟", { exact: true }).fill("مرنة");
  await page.getByLabel("هل لديك تذكرة عودة أو سفر لاحق؟", { exact: true }).fill("نعم");
  await page.getByRole("button", { name: "كمّل البحث", exact: true }).click();
  await expect(region.getByRole("heading", { name: "يوجد مانع حسب البيانات المدخلة", exact: true })).toBeVisible();
  await expect(region.getByText(/نتيجة مبنية على إدخالك فقط/)).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  expect(errors).toEqual([]);
});
