import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEV_DASHBOARD_OVERVIEW_FIXTURE } from "@/lib/dev-dashboard-fixture";

const ORIGINAL_ENV = process.env;

describe("GET /api/dashboard/overview", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URL;
    vi.stubEnv("NODE_ENV", "development");
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns offline fixture when the database is disabled", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual(DEV_DASHBOARD_OVERVIEW_FIXTURE);
  });
});
