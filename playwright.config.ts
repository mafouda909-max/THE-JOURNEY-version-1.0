import { defineConfig, devices } from "@playwright/test";

/**
 * Slice 1 browser E2E (AD-13) — Chromium only, desktop + mobile viewports,
 * plus a dedicated production-hard-guard project against the built app.
 *
 * Servers:
 *  - :3199 `next dev`  (non-production build → NEXT_PUBLIC_DEMO_PREVIEW active;
 *                       discovery flows exercise the staging demo projections)
 *  - :3200 `next start` (production build → hard guard forces canonical views;
 *                       requires `npm run build` beforehand)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    actionTimeout: 30_000,
    navigationTimeout: 180_000,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node node_modules/next/dist/bin/next dev --port 3199",
      url: "http://localhost:3199",
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: { NEXT_PUBLIC_DEMO_PREVIEW: "true" },
    },
    {
      command: "node node_modules/next/dist/bin/next start --port 3200",
      url: "http://localhost:3200/",
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        baseURL: "http://localhost:3199",
      },
      testIgnore: [/prod-guard/, /slice2-mobile/, /slice3-mobile/, /slice3-contact/],
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        baseURL: "http://localhost:3199",
      },
      testIgnore: [/prod-guard/, /slice2-journey/, /slice3/],
    },
    {
      name: "prod-guard",
      testMatch: /prod-guard\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3200",
      },
    },
    // SLICE 3 — conversion loop runs against the PRODUCTION context (:3200):
    // authenticated contact flows read canonical data by design (the dev
    // server intentionally exposes only demo-marked staging previews).
    {
      name: "slice3-desktop",
      testMatch: /slice3-contact\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        baseURL: "http://localhost:3200",
      },
    },
    {
      name: "slice3-mobile",
      testMatch: /slice3-mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        baseURL: "http://localhost:3200",
      },
    },
  ],
});
