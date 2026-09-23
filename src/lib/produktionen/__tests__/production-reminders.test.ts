import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ showFind: vi.fn(), membershipFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    show: { findUniqueOrThrow: mocks.showFind },
    productionMembership: { findMany: mocks.membershipFindMany },
  },
}));
vi.mock("@/lib/app-url", () => ({ getAppBaseUrl: () => "https://m.example.org" }));

import {
  buildPhotoConsentReminderMail,
  findOpenOnboardingUserIds,
  formatReminderSummary,
  sendPhotoConsentReminders,
} from "../production-reminders";

const member = (email: string | null, status?: "rejected") => ({
  user: {
    firstName: "Anna",
    lastName: null,
    name: null,
    email,
    photoConsents: status ? [{ status }] : [],
  },
});

describe("Fotoerlaubnis-Erinnerungen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showFind.mockResolvedValue({ title: "Momo", year: 2027 });
  });

  it("fragt nur aktive Mitglieder ohne ausstehende oder erteilte Erlaubnis ab", async () => {
    mocks.membershipFindMany.mockResolvedValue([]);

    await sendPhotoConsentReminders({ showId: "show-1", sender: vi.fn() });

    expect(mocks.membershipFindMany.mock.calls[0][0].where).toEqual({
      showId: "show-1",
      status: "active",
      user: {
        deactivatedAt: null,
        photoConsents: {
          none: { showId: "show-1", revokedAt: null, status: { in: ["pending", "approved"] } },
        },
      },
    });
  });

  it("zählt verschickte, fehlende und fehlgeschlagene Mails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.membershipFindMany.mockResolvedValue([
      member("a@example.org"),
      member(null),
      member("c@example.org", "rejected"),
    ]);
    const sender = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SMTP"));

    const summary = await sendPhotoConsentReminders({ showId: "show-1", sender });

    expect(summary).toEqual({ sent: 1, noEmail: 1, failed: 1 });
    expect(sender.mock.calls[1][0].text).toContain("abgelehnt");
    expect(formatReminderSummary(summary)).toBe(
      "1 Erinnerungen verschickt, 1 ohne E-Mail-Adresse, 1 fehlgeschlagen.",
    );
  });

  it("verlinkt das Profil", () => {
    const mail = buildPhotoConsentReminderMail({
      to: "a@example.org",
      name: "Anna",
      showTitle: "Momo",
      rejected: false,
    });
    expect(mail.subject).toBe("Fotoerlaubnis für „Momo“");
    expect(mail.text).toContain("https://m.example.org/mitglieder/profil");
  });
});

describe("findOpenOnboardingUserIds", () => {
  it("liefert Eingeladene und Personen im Onboarding", async () => {
    mocks.membershipFindMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }]);

    expect(await findOpenOnboardingUserIds("show-1")).toEqual(["a", "b"]);
    expect(mocks.membershipFindMany).toHaveBeenCalledWith({
      where: { showId: "show-1", status: { in: ["invited", "onboarding"] } },
      select: { userId: true },
    });
  });
});
