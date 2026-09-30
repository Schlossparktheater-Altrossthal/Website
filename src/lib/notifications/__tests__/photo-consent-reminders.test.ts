import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  show: { findMany: vi.fn() },
  productionMembership: { findMany: vi.fn() },
  notification: { findMany: vi.fn() },
}));

const notifyMock = vi.hoisted(() => vi.fn<(input: NotifyInput) => Promise<void>>());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("../notify", () => ({ notify: notifyMock }));

import {
  dispatchPhotoConsentReminders,
  photoConsentReminderGroupKey,
} from "../photo-consent-reminders";
import { NOTIFICATION_TYPES } from "../types";
import type { NotifyInput } from "../notify";

function membership(userId: string, status: string | null, revokedAt: Date | null = null) {
  return {
    userId,
    user: {
      photoConsents: status ? [{ status, revokedAt }] : [],
    },
  };
}

describe("dispatchPhotoConsentReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.show.findMany.mockResolvedValue([{ id: "s1", title: "Stück", year: 2026 }]);
    db.productionMembership.findMany.mockResolvedValue([]);
    db.notification.findMany.mockResolvedValue([]);
    notifyMock.mockResolvedValue(undefined);
  });

  it("erinnert Mitglieder ohne, mit abgelehnter oder widerrufener Erlaubnis", async () => {
    db.productionMembership.findMany.mockResolvedValue([
      membership("u-missing", null),
      membership("u-rejected", "rejected"),
      membership("u-revoked", "approved", new Date("2026-09-01")),
      membership("u-approved", "approved"),
      membership("u-pending", "pending"),
      membership("u-nophotos", "noPhotos"),
    ]);

    const summary = await dispatchPhotoConsentReminders({ now: new Date("2026-10-05T10:00:00Z") });

    expect(summary.sent).toBe(3);
    const recipients = notifyMock.mock.calls.map((call) => call[0].recipients[0]).sort();
    expect(recipients).toEqual(["u-missing", "u-rejected", "u-revoked"].sort());
    expect(notifyMock.mock.calls[0][0].type).toBe(NOTIFICATION_TYPES.PHOTO_CONSENT);
  });

  it("überspringt Personen, die kürzlich schon erinnert wurden", async () => {
    db.productionMembership.findMany.mockResolvedValue([membership("u-missing", null)]);
    db.notification.findMany.mockResolvedValue([
      { groupKey: photoConsentReminderGroupKey("s1", "u-missing") },
    ]);

    const summary = await dispatchPhotoConsentReminders({ now: new Date("2026-10-05T10:00:00Z") });

    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("erinnert nur für aktive oder geplante Produktionen", async () => {
    db.show.findMany.mockResolvedValue([]);

    const summary = await dispatchPhotoConsentReminders({ now: new Date("2026-10-05T10:00:00Z") });

    expect(summary.sent).toBe(0);
    expect(db.productionMembership.findMany).not.toHaveBeenCalled();
  });
});
