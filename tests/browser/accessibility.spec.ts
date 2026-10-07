import axe from "axe-core";
import { expect, test, type Page } from "@playwright/test";

type AxeViolation = {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

async function scan(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status()).toBeLessThan(500);
  await page.addScriptTag({ content: axe.source });

  const violations = await page.evaluate(async () => {
    const runtime = (window as unknown as {
      axe: {
        run: (
          root: Document,
          options: { runOnly: { type: "tag"; values: string[] } },
        ) => Promise<{ violations: AxeViolation[] }>;
      };
    }).axe;

    const result = await runtime.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations;
  });

  expect(
    violations,
    violations
      .map(
        (violation) =>
          `${violation.id} [${violation.impact ?? "unknown"}] ${violation.help}: ` +
          violation.nodes
            .slice(0, 4)
            .map((node) => node.target.join(" > "))
            .join(" | "),
      )
      .join("\n"),
  ).toEqual([]);
}

for (const route of ["/", "/offers", "/agents", "/readiness", "/join"]) {
  test(`${route} has no automated WCAG A/AA violations`, async ({ page }) => {
    await scan(page, route);
  });
}
