import { defineConfig, devices } from "@playwright/test";

// An isolated, anonymous production smoke suite. No seed, database connection,
// authentication, offer publication or provider overrides.
export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 25_000 },
  reporter: [["list"], ["html", { outputFolder: "production-playwright-report", open: "never" }]],
  outputDir: "production-test-results",
  use: {
    baseURL: "https://the-journey-version-1-0.vercel.app",
    locale: "ar-EG",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 25_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "production-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "production-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
