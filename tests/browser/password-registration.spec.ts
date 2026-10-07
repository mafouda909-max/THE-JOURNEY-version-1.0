import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

for (const role of ["traveler", "agent"] as const) {
  test(`${role} registers, enters their account immediately, logs out and logs in`, async ({
    page,
    context,
  }, testInfo) => {
    const email = `browser-${role}-${randomUUID()}@example.invalid`;
    let password = "A safe SILA browser travel phrase 2026";
    await page.goto(
      `/join?mode=${role === "agent" ? "agent" : "new-traveler"}`,
      { waitUntil: "networkidle" },
    );
    await expect(
      page.getByLabel("البريد الإلكتروني", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/password-${role}-${testInfo.project.name}-signup.png`,
      fullPage: true,
    });
    await page
      .getByLabel(role === "agent" ? "اسم الوكالة أو الوكيل" : "اسم المسافر", {
        exact: true,
      })
      .fill("حساب اختبار المتصفح");
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
      .click();
    await expect(
      page.getByLabel("كلمة المرور", { exact: true }),
    ).toHaveAttribute("type", "text");
    await page
      .getByRole("button", { name: "إخفاء كلمة المرور", exact: true })
      .click();
    await expect(
      page.getByLabel("كلمة المرور", { exact: true }),
    ).toHaveAttribute("type", "password");
    await page
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill("A different password phrase");
    await page
      .getByRole("button", { name: "إنشاء الحساب", exact: true })
      .click();
    // Next.js also exposes a route-announcer alert; target the form error itself.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "كلمتا المرور غير متطابقتين." }),
    ).toHaveText("كلمتا المرور غير متطابقتين.");
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "إنشاء الحساب", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { name: "مرحباً، حساب اختبار المتصفح" }),
    ).toBeVisible();
    if (role === "traveler")
      await expect(
        page.getByText("البريد غير موثّق", { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "أمان الحساب وكلمة المرور" }),
    ).toBeVisible();
    const cookie = (await context.cookies()).find(
      (item) => item.name === "tj_sess",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    const session = await context.request.get("/api/auth/session");
    expect(session.status()).toBe(200);
    expect(await session.json()).toEqual({ role });
    if (role === "agent") {
      await expect(page.getByText("حالة التوثيق: لم يبدأ بعد")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "ابدأ التوثيق عندما تكون جاهزًا" }),
      ).toBeVisible();
      await expect(
        page.getByText("لا عروض بعد", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "سجّل كوكيل", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("link", { name: "تعديل الملف المهني", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "الملف المهني", exact: true }),
      ).toBeVisible();
      await page
        .getByLabel("الاسم بالإنجليزية", { exact: true })
        .fill("SILA Pending QA Agent");
      await page.getByLabel("الدولة", { exact: true }).fill("مصر");
      await page.getByLabel("المدينة", { exact: true }).fill("القاهرة");
      await page
        .getByLabel("نبذة عن خبرتك وخدماتك", { exact: true })
        .fill(
          "نبذة مهنية اصطناعية لاختبار إعداد الملف قبل رفع مستندات التوثيق.",
        );
      await page
        .getByRole("button", { name: "حفظ الملف المهني", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "تم حفظ بيانات الملف" }),
      ).toBeVisible();
      const pending = await context.request.get("/api/auth/me");
      const pendingAgent = (await pending.json()).agent;
      expect(pendingAgent.verificationStatus).toBe("pending");
      const publicAgents = await context.request.get("/api/agents");
      expect((await publicAgents.json()).agents.some((agent: { id: number }) => agent.id === pendingAgent.id)).toBe(false);
      expect((await context.request.get(`/api/agents/${pendingAgent.id}`)).status()).toBe(404);
      const documents = await context.request.get("/api/agent-verification");
      expect((await documents.json()).documents).toEqual([]);
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByLabel("المدينة", { exact: true })).toHaveValue(
        "القاهرة",
      );
      await expect(
        page.getByText("اعتماد الوكيل: لم يبدأ بعد", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/workspace-pending-profile-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await page.goto("/account/offers", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", {
          name: "إرسال العروض يبدأ بعد اعتماد الوكيل",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "إنشاء عرض جديد", exact: true }),
      ).toHaveCount(0);
      expect(
        (
          await context.request.post("/api/offers", {
            data: { title: "Pending must not submit" },
          })
        ).status(),
      ).toBe(403);
      await page.goto("/account", { waitUntil: "networkidle" });
    } else {
      await page.goto("/account/travel", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "رحلتك لا تبدأ من الصفر كل مرة." }),
      ).toBeVisible();
      await page
        .getByText("احفظ رحلة جديدة أو سياقًا جديدًا", { exact: true })
        .click();
      await page
        .getByPlaceholder("اسم مختصر للرحلة")
        .fill("رحلة اختبار بصرية إلى إسطنبول");
      await page.getByPlaceholder("مدينة الانطلاق").fill("القاهرة");
      await page.getByPlaceholder("الوجهة *").fill("إسطنبول");
      await page.getByRole("button", { name: "احفظ نية السفر", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "رحلة اختبار بصرية إلى إسطنبول", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("الخطوة التالية", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "ابدأ التحقق", exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/visual-traveler-workspace-${testInfo.project.name}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "ابدأ التحقق", exact: true }).click();
      await expect(page).toHaveURL(/\/readiness\?intentId=/);
      await page.goto("/account", { waitUntil: "networkidle" });
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/password-${role}-${testInfo.project.name}-account.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "أمان الحساب وكلمة المرور" }).click();
    await expect(
      page.getByRole("heading", { name: "أمان الحساب", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "تأكيد البريد واستعادة الحساب بالبريد غير متاحين حاليًا.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "إرسال رابط تأكيد", exact: true }),
    ).toHaveCount(0);
    const nextPassword = "A changed SILA browser travel phrase 2026";
    await page
      .getByLabel("كلمة المرور الحالية", { exact: true })
      .fill(password);
    await page
      .getByLabel("كلمة المرور الجديدة", { exact: true })
      .fill(nextPassword);
    await page
      .getByLabel("تأكيد كلمة المرور الجديدة", { exact: true })
      .fill(nextPassword);
    await page
      .getByRole("button", { name: "تغيير كلمة المرور", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "تم تغيير كلمة المرور" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: /تعذر|reset|currentTarget/ }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("كلمة المرور الحالية", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByLabel("كلمة المرور الجديدة", { exact: true }),
    ).toHaveValue("");
    const changedCookie = (await context.cookies()).find(
      (item) => item.name === "tj_sess",
    );
    expect(changedCookie?.value).not.toBe(cookie?.value);
    const stale = await context.request.get("/api/auth/me", {
      headers: { cookie: `tj_sess=${cookie?.value}` },
    });
    expect(stale.status()).toBe(401);
    password = nextPassword;
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/password-${role}-${testInfo.project.name}-security.png`,
      fullPage: true,
    });
    await page.goto("/account", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/join", { waitUntil: "networkidle" });
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "تسجيل الدخول", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { name: "مرحباً، حساب اختبار المتصفح" }),
    ).toBeVisible();
  });
}

test("unavailable recovery is explained before offering a send action", async ({
  page,
}) => {
  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await expect(
    page.getByText("استعادة الحساب بالبريد غير متاحة حاليًا.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إرسال رابط الاستعادة" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "العودة إلى تسجيل الدخول" }),
  ).toBeVisible();
});

for (const path of ["reset-password", "verify-email"]) {
  test(`${path} scrubs bearer links while keeping the form usable`, async ({
    page,
  }) => {
    const token = "a".repeat(43);
    for (const suffix of [`#token=${token}`, `?token=${token}`]) {
      const response = await page.goto(`/${path}${suffix}`, {
        waitUntil: "networkidle",
      });
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
      await expect(
        page.getByRole("button", {
          name:
            path === "reset-password"
              ? "حفظ كلمة المرور الجديدة"
              : "تأكيد أن هذا بريدي",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.locator('meta[name="referrer"]').getAttribute("content"),
      ).toBe("no-referrer");
    }
  });
}
