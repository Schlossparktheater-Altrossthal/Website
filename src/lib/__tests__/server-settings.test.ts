import type { ServerSettings } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAIL_PORT,
  MAX_MAIL_PORT,
  MIN_MAIL_PORT,
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

function createRecord(overrides: Partial<ServerSettings> = {}): ServerSettings {
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
    createdAt: new Date("2025-01-01T12:00:00Z"),
    updatedAt: new Date("2025-01-01T12:00:00Z"),
    parentalConsentData: null,
    parentalConsentName: null,
    parentalConsentMime: null,
    parentalConsentSize: null,
    parentalConsentUploadedAt: null,
    parentalConsentUploadedById: null,
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
      parentalConsentData: null,
      parentalConsentName: null,
      parentalConsentMime: null,
      parentalConsentSize: null,
      parentalConsentUploadedAt: null,
      parentalConsentUploadedById: null,
    });

    expect(resolved.mailFromAddress).toBeNull();
    expect(resolved.mailFromName).toBe("Sender");
    expect(resolved.mailReplyTo).toBeNull();
  });

  it("keeps a valid sender address", () => {
    const resolved = resolveServerSettings(createRecord({ mailFromAddress: "valid@example.org" }));
    expect(resolved.mailFromAddress).toBe("valid@example.org");
  });

  it("clamps out-of-range and invalid mail ports", () => {
    expect(resolveServerSettings(createRecord({ mailPort: 0 })).mailPort).toBe(MIN_MAIL_PORT);
    expect(resolveServerSettings(createRecord({ mailPort: 99_999 })).mailPort).toBe(MAX_MAIL_PORT);
    expect(resolveServerSettings(createRecord({ mailPort: Number.NaN })).mailPort).toBe(
      DEFAULT_MAIL_PORT,
    );
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

  it("returns null updatedAt when missing", () => {
    const client = toClientServerSettings(createResolved({ updatedAt: null }));
    expect(client.updatedAt).toBeNull();
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

  it("keeps base port when patch port is null", () => {
    const patched = applyServerSettingsPatch(createResolved(), { mailPort: null });
    expect(patched.mailPort).toBe(DEFAULT_MAIL_PORT);
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

  it("trims whitespace from the display name", () => {
    const resolved = createResolved({ mailFromName: "  Mailer  " });
    expect(formatSenderAddress(resolved)).toBe("Mailer <mailer@example.org>");
  });
});
