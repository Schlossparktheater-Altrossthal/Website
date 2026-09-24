import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";

import { onboardingSessionNotice } from "../session-notice";

function session(user: Partial<Session["user"]>, extra: Partial<Session> = {}): Session {
  return { expires: "2099-01-01", user: { id: "u1", ...user }, ...extra } as Session;
}

describe("onboardingSessionNotice", () => {
  it("zeigt nichts ohne Anmeldung", () => {
    expect(onboardingSessionNotice(null)).toBeNull();
  });

  it("nennt das angemeldete Konto samt Authentik-Abmeldung", () => {
    expect(
      onboardingSessionNotice(
        session(
          { firstName: "Max", lastName: "Muster", email: "max@example.org" },
          { authentikLogoutUrl: "https://auth.example.org/logout/" },
        ),
      ),
    ).toEqual({
      name: "Max Muster",
      email: "max@example.org",
      authentikLogoutUrl: "https://auth.example.org/logout/",
    });
  });

  it("fällt ohne Namen auf die E-Mail zurück", () => {
    expect(onboardingSessionNotice(session({ email: "anna@example.org" }))?.name).toBe(
      "anna@example.org",
    );
  });
});
