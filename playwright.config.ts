import { devices, defineConfig } from "@playwright/test";

import { E2E_BASE_URL } from "./e2e/env";

// Lokal: `pnpm e2e` gegen next dev. Staging: `pnpm e2e:env` einmal, dann
// `E2E_BASE_URL=https://staging.sommertheater-altrossthal.de pnpm e2e` (docs/e2e-tests.md).
const startCommand = process.env.SCAN_E2E_START_COMMAND;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    // Wie die echten Nutzer: deutsche Datumsfelder und Zeiten in Ortszeit.
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(startCommand
    ? {
        webServer: {
          command: startCommand,
          url: E2E_BASE_URL,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 120_000,
        },
      }
    : {}),
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      testMatch: /responsive-overflow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
    {
      name: "tablet-portrait",
      testMatch: /responsive-overflow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1112 },
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
    {
      name: "tablet-landscape",
      testMatch: /responsive-overflow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
  ],
});
