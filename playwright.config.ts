import { devices, defineConfig } from "@playwright/test";

const baseURL = process.env.SCAN_E2E_BASE_URL ?? "http://127.0.0.1:3000";
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
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(startCommand
    ? {
        webServer: {
          command: startCommand,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 120_000,
        },
      }
    : {}),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
