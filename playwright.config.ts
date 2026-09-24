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
  ],
});
