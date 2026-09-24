import { afterEach, describe, expect, it, vi } from "vitest";

import { createTransporterFromSettings, isMailDisabled } from "../transporter";

const settings = {
  id: "default",
  mailHost: "mail.example.org",
  mailPort: 587,
  mailSecure: false,
  mailUsername: null,
  mailPassword: null,
  mailFromAddress: "theater@example.org",
  mailFromName: null,
  mailReplyTo: null,
  updatedAt: null,
} as unknown as Parameters<typeof createTransporterFromSettings>[0];

describe("MAIL_DISABLED", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["1", "true", " TRUE ", "yes"])("erkennt %j als deaktiviert", (value) => {
    vi.stubEnv("MAIL_DISABLED", value);
    expect(isMailDisabled()).toBe(true);
  });

  it.each(["", "0", "false"])("lässt Versand bei %j zu", (value) => {
    vi.stubEnv("MAIL_DISABLED", value);
    expect(isMailDisabled()).toBe(false);
  });

  it("blockiert auch direkte Transporter (z. B. Test-Mail der Server-Einstellungen)", () => {
    vi.stubEnv("MAIL_DISABLED", "true");
    expect(() => createTransporterFromSettings(settings)).toThrow(/deaktiviert/);
  });
});
