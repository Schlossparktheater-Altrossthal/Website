import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMailEnv } from "../config";

const db = {
  id: "default",
  mailHost: "db.example.org",
  mailPort: 587,
  mailSecure: false,
  mailUsername: "db-user",
  mailPassword: "db-pass",
  mailFromAddress: "db@example.org",
  mailFromName: "DB",
  mailReplyTo: null,
  updatedAt: null,
};

describe("applyMailEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lässt ohne MAIL_HOST alles aus der Datenbank", () => {
    vi.stubEnv("MAIL_HOST", "");
    vi.stubEnv("MAIL_FROM_ADDRESS", "");
    vi.stubEnv("MAIL_FROM_NAME", "");
    vi.stubEnv("MAIL_REPLY_TO", "");
    const result = applyMailEnv(db);
    expect(result.source).toBe("database");
    expect(result.settings).toEqual(db);
    expect(result.envSenderFields).toEqual([]);
  });

  it("ersetzt mit MAIL_HOST den ganzen Server-Block, auch leere Zugangsdaten", () => {
    vi.stubEnv("MAIL_HOST", "smtp.secret");
    vi.stubEnv("MAIL_PORT", "465");
    vi.stubEnv("MAIL_SECURE", "");
    vi.stubEnv("MAIL_USERNAME", "");
    vi.stubEnv("MAIL_PASSWORD", "");
    const result = applyMailEnv(db);
    expect(result.source).toBe("env");
    expect(result.settings).toMatchObject({
      mailHost: "smtp.secret",
      mailPort: 465,
      mailSecure: true,
      mailUsername: null,
      mailPassword: null,
      mailFromAddress: "db@example.org",
    });
  });

  it("nimmt Absenderfelder einzeln aus der Umgebung", () => {
    vi.stubEnv("MAIL_HOST", "");
    vi.stubEnv("MAIL_FROM_NAME", "Sommertheater");
    const result = applyMailEnv(db);
    expect(result.settings.mailFromName).toBe("Sommertheater");
    expect(result.settings.mailFromAddress).toBe("db@example.org");
    expect(result.envSenderFields).toEqual(["mailFromName"]);
  });
});
