import { resolveMx } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { autoDetectMailServerSettings } from "@/lib/server-settings-autodetect";

vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn(),
}));

const resolveMxMock = vi.mocked(resolveMx);

beforeEach(() => {
  resolveMxMock.mockReset();
});

describe("autoDetectMailServerSettings", () => {
  it("returns a known provider configuration for Gmail", async () => {
    const result = await autoDetectMailServerSettings({ email: "user@gmail.com" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.gmail.com");
    expect(result?.mailPort).toBe(465);
    expect(result?.mailSecure).toBe(true);
    expect(result?.mailUsername).toBe("user@gmail.com");
    expect(result?.confidence).toBe("high");
    expect(resolveMxMock).not.toHaveBeenCalled();
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
    expect(resolveMxMock).not.toHaveBeenCalled();
  });

  it("resolves the MX records when available", async () => {
    resolveMxMock.mockResolvedValueOnce([
      { exchange: "mx1.example.org", priority: 20 },
      { exchange: "mx0.example.org", priority: 10 },
    ]);

    const result = await autoDetectMailServerSettings({ email: "team@example.org" });

    expect(resolveMxMock).toHaveBeenCalledWith("example.org");
    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("mx0.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("medium");
  });

  it("falls back to a generic smtp-domain suggestion when no provider matches", async () => {
    resolveMxMock.mockResolvedValue([]);

    const result = await autoDetectMailServerSettings({ email: "team@example.org" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("low");
  });
});
