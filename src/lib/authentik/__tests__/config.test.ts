import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAuthentikApiConfig,
  isAuthentikLoginEnabled,
  isAuthentikProvisioningEnabled,
  isLegacyPasswordLoginActive,
} from "@/lib/authentik/config";

function enableAuthentik() {
  vi.stubEnv("AUTHENTIK_ISSUER", "https://auth.example.org/application/o/mitgliederbereich/");
  vi.stubEnv("AUTHENTIK_CLIENT_ID", "mitgliederbereich");
  vi.stubEnv("AUTHENTIK_CLIENT_SECRET", "secret");
  vi.stubEnv("AUTHENTIK_API_TOKEN", "token");
}

describe("authentik config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled without configuration and keeps the legacy login", () => {
    vi.stubEnv("AUTHENTIK_ISSUER", "");
    vi.stubEnv("AUTHENTIK_API_TOKEN", "");
    expect(isAuthentikLoginEnabled()).toBe(false);
    expect(isAuthentikProvisioningEnabled()).toBe(false);
    expect(isLegacyPasswordLoginActive()).toBe(true);
  });

  it("allows login only without API token (staging) and keeps the legacy login", () => {
    enableAuthentik();
    vi.stubEnv("AUTHENTIK_API_TOKEN", "");
    vi.stubEnv("AUTHENTIK_LEGACY_LOGIN_UNTIL", "2020-01-01T00:00:00Z");
    expect(isAuthentikLoginEnabled()).toBe(true);
    expect(isAuthentikProvisioningEnabled()).toBe(false);
    expect(isLegacyPasswordLoginActive()).toBe(true);
  });

  it("derives the API base URL from the issuer", () => {
    enableAuthentik();
    expect(isAuthentikProvisioningEnabled()).toBe(true);
    expect(getAuthentikApiConfig()).toMatchObject({
      baseUrl: "https://auth.example.org",
      recoveryEmailStage: "theater-recovery-email",
    });
  });

  it("closes the legacy login after the deadline", () => {
    enableAuthentik();
    vi.stubEnv("AUTHENTIK_LEGACY_LOGIN_UNTIL", "2026-12-31T23:00:00Z");
    expect(isLegacyPasswordLoginActive(new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(isLegacyPasswordLoginActive(new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("keeps the legacy login open without a deadline", () => {
    enableAuthentik();
    vi.stubEnv("AUTHENTIK_LEGACY_LOGIN_UNTIL", "");
    expect(isLegacyPasswordLoginActive(new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });
});
