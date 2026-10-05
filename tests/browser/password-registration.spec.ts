import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

for (const role of ["traveler", "agent"] as const) {
  test(`${role} registers, enters their account immediately, logs out and logs in`, async ({ page, context }, testInfo) => {
    const email = `browser-${role}-${randomUUID()}@example.invalid`;
    let password = "A safe SILA browser travel phrase 2026";
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
    await page.getByRole("link", { name: "أمان الحساب وكلمة المرور" }).click();
    await expect(page.getByRole("heading", { name: "أمان الحساب", exact: true })).toBeVisible();
    await expect(page.getByText("تأكيد البريد واستعادة الحساب بالبريد غير متاحين حاليًا.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "إرسال رابط تأكيد", exact: true })).toHaveCount(0);
    const nextPassword = "A changed SILA browser travel phrase 2026";
    await page.getByLabel("كلمة المرور الحالية", { exact: true }).fill(password);
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill(nextPassword);
    await page.getByLabel("تأكيد كلمة المرور الجديدة", { exact: true }).fill(nextPassword);
    await page.getByRole("button", { name: "تغيير كلمة المرور", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "تم تغيير كلمة المرور" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /تعذر|reset|currentTarget/ })).toHaveCount(0);
    await expect(page.getByLabel("كلمة المرور الحالية", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toHaveValue("");
    const changedCookie = (await context.cookies()).find((item) => item.name === "tj_sess");
    expect(changedCookie?.value).not.toBe(cookie?.value);
    const stale = await context.request.get("/api/auth/me", { headers: { cookie: `tj_sess=${cookie?.value}` } });
    expect(stale.status()).toBe(401);
    password = nextPassword;
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/password-${role}-${testInfo.project.name}-security.png`, fullPage: true });
    await page.goto("/account", { waitUntil: "networkidle" });
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

test("unavailable recovery is explained before offering a send action", async ({ page }) => {
  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await expect(page.getByText("استعادة الحساب بالبريد غير متاحة حاليًا.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "إرسال رابط الاستعادة" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "العودة إلى تسجيل الدخول" })).toBeVisible();
});

for (const path of ["reset-password", "verify-email"]) {
  test(`${path} scrubs bearer links while keeping the form usable`, async ({ page }) => {
    const token = "a".repeat(43);
    for (const suffix of [`#token=${token}`, `?token=${token}`]) {
      await page.goto(`/${path}${suffix}`, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
      await expect(page.getByRole("button", { name: path === "reset-password" ? "حفظ كلمة المرور الجديدة" : "تأكيد أن هذا بريدي", exact: true })).toBeVisible();
      expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
    }
  });
}
