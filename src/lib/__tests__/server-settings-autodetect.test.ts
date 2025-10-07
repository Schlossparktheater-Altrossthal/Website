import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveMx, resolveSrv } from "node:dns/promises";

import { autoDetectMailServerSettings } from "@/lib/server-settings-autodetect";

vi.mock("node:dns/promises", () => ({
  resolveSrv: vi.fn(),
  resolveMx: vi.fn(),
}));

const mockedResolveSrv = vi.mocked(resolveSrv);
const mockedResolveMx = vi.mocked(resolveMx);

function dnsNotFoundError() {
  const error = new Error("not found");
  (error as NodeJS.ErrnoException).code = "ENOTFOUND";
  return error;
}

describe("autoDetectMailServerSettings", () => {
  beforeEach(() => {
    mockedResolveSrv.mockImplementation(async () => {
      throw dnsNotFoundError();
    });
    mockedResolveMx.mockImplementation(async () => {
      throw dnsNotFoundError();
    });
  });

  it("returns a known provider configuration for Gmail", async () => {
    const result = await autoDetectMailServerSettings({ email: "user@gmail.com" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.gmail.com");
    expect(result?.mailPort).toBe(465);
    expect(result?.mailSecure).toBe(true);
    expect(result?.mailUsername).toBe("user@gmail.com");
    expect(result?.confidence).toBe("high");
  });

  it("prefers the provided host and marks the confidence as medium", async () => {
    const result = await autoDetectMailServerSettings({
      host: "mail.custom-domain.test",
      email: "admin@custom-domain.test",
    });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("mail.custom-domain.test");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("medium");
  });

  it("falls back to a generic smtp-domain suggestion when no provider matches", async () => {
    const result = await autoDetectMailServerSettings({ email: "team@example.org" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("low");
  });

  it("uses SRV records when available", async () => {
    mockedResolveSrv.mockImplementation(async (record: string) => {
      if (record === "_submission._tcp.example.org") {
        return [
          { name: "smtp.example.org.", port: 587, priority: 0, weight: 10 },
          { name: "smtp-backup.example.org.", port: 587, priority: 10, weight: 1 },
        ];
      }
      throw dnsNotFoundError();
    });

    const result = await autoDetectMailServerSettings({ email: "info@example.org" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("high");
  });

  it("falls back to MX records when no SRV record is present", async () => {
    mockedResolveMx.mockResolvedValue([
      { exchange: "mx-primary.example.org.", priority: 0 },
      { exchange: "mx-backup.example.org.", priority: 10 },
    ]);

    const result = await autoDetectMailServerSettings({ email: "sender@example.org" });

    expect(mockedResolveSrv).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("mx-primary.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("medium");
  });
});

