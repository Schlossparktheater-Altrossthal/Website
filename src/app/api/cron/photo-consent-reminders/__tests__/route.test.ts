import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/notifications/photo-consent-reminders", () => ({
  dispatchPhotoConsentReminders: mocks.dispatch,
}));
vi.mock("@/lib/logger", () => ({ createLogger: () => mocks.logger }));

import { GET, POST } from "../route";

const URL = "http://localhost/api/cron/photo-consent-reminders";

function call(secret?: string) {
  return new Request(URL, { headers: secret ? { "x-cron-secret": secret } : undefined });
}

describe("cron photo-consent-reminders", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset().mockResolvedValue({ sent: 2, skipped: 1, failed: 0 });
    mocks.logger.info.mockReset();
    mocks.logger.error.mockReset();
    vi.stubEnv("CRON_SECRET", "geheim");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lehnt Aufrufe ohne oder mit falschem Geheimnis ab", async () => {
    expect((await GET(call())).status).toBe(401);
    expect((await POST(call("falsch"))).status).toBe(401);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("versendet mit gültigem Geheimnis und meldet die Zusammenfassung", async () => {
    const response = await POST(call("geheim"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", sent: 2, skipped: 1, failed: 0 });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.logger.info).toHaveBeenCalledTimes(1);
  });

  it("verhält sich bei GET wie bei POST", async () => {
    const response = await GET(call("geheim"));
    expect(response.status).toBe(200);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
