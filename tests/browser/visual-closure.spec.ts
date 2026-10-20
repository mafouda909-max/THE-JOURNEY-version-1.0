import { expect, test, type Page } from "@playwright/test";

async function assertVisualClosure(page: Page, route: string) {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const geometry = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const focusActions = [...document.querySelectorAll<HTMLElement>(".focus-action")];
    const decisionBoards = [...document.querySelectorAll<HTMLElement>(".decision-board")];
    const readingBlocks = [...document.querySelectorAll<HTMLElement>(".sila-reading")];
    return {
      touchToken: root.getPropertyValue("--sila-touch-target").trim(),
      readingToken: root.getPropertyValue("--sila-reading-max").trim(),
      decisionToken: root.getPropertyValue("--sila-decision-max").trim(),
      bodyFont: body.fontFamily,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      focusHeights: focusActions.map((node) => node.getBoundingClientRect().height),
      decisionWidths: decisionBoards.map((node) => node.getBoundingClientRect().width),
      readingWidths: readingBlocks.map((node) => node.getBoundingClientRect().width),
    };
  });

  expect(geometry.touchToken).toBe("52px");
  expect(geometry.readingToken).toBe("680px");
  expect(geometry.decisionToken).toBe("880px");
  expect(geometry.bodyFont).toContain("IBM Plex Sans Arabic");
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.focusHeights.length).toBeGreaterThan(0);
  for (const height of geometry.focusHeights) expect(height).toBeGreaterThanOrEqual(51);
  for (const width of geometry.readingWidths) expect(width).toBeLessThanOrEqual(681);
  expect(runtimeErrors).toEqual([]);
}

test("home keeps SILA decision hierarchy visually bounded", async ({ page }, testInfo) => {
  await assertVisualClosure(page, "/");
  await expect(page.locator(".decision-board").first()).toBeVisible();
  await expect(page.locator(".focus-action").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/visual-closure-home-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("readiness keeps one primary decision action without horizontal overflow", async ({ page }, testInfo) => {
  await assertVisualClosure(page, "/readiness");
  await expect(page.getByText("مستشار صلة", { exact: true })).toBeVisible();
  await expect(page.locator(".decision-board").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/visual-closure-readiness-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
