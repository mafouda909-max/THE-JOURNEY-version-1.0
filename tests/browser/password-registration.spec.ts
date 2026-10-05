import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

for (const role of ["traveler", "agent"] as const) {
  test(`${role} registers, enters their account immediately, logs out and logs in`, async ({ page, context }, testInfo) => {
    const email = `browser-${role}-${randomUUID()}@example.invalid`;
    const password = "A safe SILA browser travel phrase 2026";
    await page.goto(`/join?mode=${role === "agent" ? "agent" : "new-traveler"}`, { waitUntil: "networkidle" });
    await expect(page.getByLabel("البريد الإلكتروني", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/password-${role}-${testInfo.project.name}-signup.png`, fullPage: true });
    await page.getByLabel(role === "agent" ? "اسم الوكالة أو الوكيل" : "اسم المسافر", { exact: true }).fill("حساب اختبار المتصفح");
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "إظهار كلمة المرور", exact: true }).click();
    await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "إخفاء كلمة المرور", exact: true }).click();
    await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute("type", "password");
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill("A different password phrase");
    await page.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
    // Next.js also exposes a route-announcer alert; target the form error itself.
    await expect(page.getByRole("alert").filter({ hasText: "كلمتا المرور غير متطابقتين." })).toHaveText("كلمتا المرور غير متطابقتين.");
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "مرحباً، حساب اختبار المتصفح" })).toBeVisible();
    await expect(page.getByText("البريد غير موثّق", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "أمان الحساب وكلمة المرور" })).toBeVisible();
    const cookie = (await context.cookies()).find((item) => item.name === "tj_sess");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    if (role === "agent") {
      await expect(page.getByText("حالة التوثيق: لم يبدأ بعد")).toBeVisible();
      await expect(page.getByRole("link", { name: "ابدأ التوثيق عندما تكون جاهزًا" })).toBeVisible();
      await expect(page.getByText("نشر العروض يتاح بعد اعتماد التوثيق")).toBeVisible();
    } else {
      await page.getByRole("link", { name: "افحص جاهزية سفرك", exact: true }).click();
      await expect(page).toHaveURL(/\/readiness$/);
      await page.goto("/account", { waitUntil: "networkidle" });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/password-${role}-${testInfo.project.name}-account.png`, fullPage: true });
    await page.getByRole("button", { name: "خروج" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/join", { waitUntil: "networkidle" });
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "مرحباً، حساب اختبار المتصفح" })).toBeVisible();
  });
}
