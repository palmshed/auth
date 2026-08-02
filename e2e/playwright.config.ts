import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://palmshed.github.io";

export default defineConfig({
  testDir: "./auth",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    headless: process.env.HEADED !== "1",
    viewport: { width: 1100, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
