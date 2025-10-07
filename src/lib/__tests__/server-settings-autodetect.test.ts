import { describe, expect, it } from "vitest";

import { autoDetectMailServerSettings } from "@/lib/server-settings-autodetect";

describe("autoDetectMailServerSettings", () => {
  it("returns a known provider configuration for Gmail", () => {
    const result = autoDetectMailServerSettings({ email: "user@gmail.com" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.gmail.com");
    expect(result?.mailPort).toBe(465);
    expect(result?.mailSecure).toBe(true);
    expect(result?.mailUsername).toBe("user@gmail.com");
    expect(result?.confidence).toBe("high");
  });

  it("prefers the provided host and marks the confidence as medium", () => {
    const result = autoDetectMailServerSettings({
      host: "mail.custom-domain.test",
      email: "admin@custom-domain.test",
    });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("mail.custom-domain.test");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("medium");
  });

  it("falls back to a generic smtp-domain suggestion when no provider matches", () => {
    const result = autoDetectMailServerSettings({ email: "team@example.org" });

    expect(result).not.toBeNull();
    expect(result?.mailHost).toBe("smtp.example.org");
    expect(result?.mailPort).toBe(587);
    expect(result?.mailSecure).toBe(false);
    expect(result?.confidence).toBe("low");
  });
});

