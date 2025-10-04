import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAIL_PORT,
  applyServerSettingsPatch,
  formatSenderAddress,
  resolveServerSettings,
  toClientServerSettings,
  type ResolvedServerSettings,
} from "@/lib/server-settings";

function createResolved(overrides: Partial<ResolvedServerSettings> = {}): ResolvedServerSettings {
  return {
    id: "default",
    mailHost: "smtp.example.org",
    mailPort: DEFAULT_MAIL_PORT,
    mailSecure: false,
    mailUsername: "user",
    mailPassword: "secret",
    mailFromAddress: "mailer@example.org",
    mailFromName: "Mailer",
    mailReplyTo: null,
    updatedAt: new Date("2025-01-01T12:00:00Z"),
    ...overrides,
  };
}

describe("resolveServerSettings", () => {
  it("returns defaults for null record", () => {
    const resolved = resolveServerSettings(null);
    expect(resolved.id).toBe("default");
    expect(resolved.mailHost).toBeNull();
    expect(resolved.mailPort).toBe(DEFAULT_MAIL_PORT);
    expect(resolved.mailSecure).toBe(false);
    expect(resolved.mailUsername).toBeNull();
    expect(resolved.mailPassword).toBeNull();
  });

  it("sanitises invalid email fields", () => {
    const resolved = resolveServerSettings({
      id: "default",
      mailHost: "smtp.local",
      mailPort: 25,
      mailSecure: true,
      mailUsername: "mailer",
      mailPassword: "pw",
      mailFromAddress: "invalid",
      mailFromName: "  Sender  ",
      mailReplyTo: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(resolved.mailFromAddress).toBeNull();
    expect(resolved.mailFromName).toBe("Sender");
    expect(resolved.mailReplyTo).toBeNull();
  });
});

describe("toClientServerSettings", () => {
  it("converts resolved settings for the client", () => {
    const resolved = createResolved({ updatedAt: new Date("2025-05-05T10:00:00Z") });
    const client = toClientServerSettings(resolved);

    expect(client.mailHost).toBe("smtp.example.org");
    expect(client.mailPasswordSet).toBe(true);
    expect(client.updatedAt).toBe("2025-05-05T10:00:00.000Z");
  });

  it("marks missing password correctly", () => {
    const resolved = createResolved({ mailPassword: null });
    const client = toClientServerSettings(resolved);
    expect(client.mailPasswordSet).toBe(false);
  });
});

describe("applyServerSettingsPatch", () => {
  it("merges overrides with base settings", () => {
    const base = createResolved();
    const patched = applyServerSettingsPatch(base, {
      mailHost: "smtp.other.org",
      mailPort: 465,
      mailSecure: true,
      mailPassword: null,
      mailReplyTo: "reply@example.org",
    });

    expect(patched.mailHost).toBe("smtp.other.org");
    expect(patched.mailPort).toBe(465);
    expect(patched.mailSecure).toBe(true);
    expect(patched.mailPassword).toBeNull();
    expect(patched.mailReplyTo).toBe("reply@example.org");
  });

  it("keeps base values when patch is undefined", () => {
    const base = createResolved();
    const patched = applyServerSettingsPatch(base, {});
    expect(patched.mailHost).toBe(base.mailHost);
    expect(patched.mailPort).toBe(base.mailPort);
  });
});

describe("formatSenderAddress", () => {
  it("combines name and address when both are present", () => {
    const resolved = createResolved();
    expect(formatSenderAddress(resolved)).toBe("Mailer <mailer@example.org>");
  });

  it("falls back to username when address is missing", () => {
    const resolved = createResolved({ mailFromAddress: null });
    expect(formatSenderAddress(resolved)).toBe("user");
  });

  it("returns null when no sender information is available", () => {
    const resolved = createResolved({ mailUsername: null, mailFromAddress: null });
    expect(formatSenderAddress(resolved)).toBeNull();
  });
});
