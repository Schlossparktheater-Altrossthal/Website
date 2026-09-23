import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { productionMembership: { findMany } } }));

import {
  classifyPhotoPermission,
  loadPhotoConsentOverview,
  photoConsentOverviewToCsv,
} from "../photo-consent-overview";

describe("classifyPhotoPermission", () => {
  it("erlaubt nur freigegebene Einverständnisse", () => {
    expect(
      classifyPhotoPermission({ status: "approved", consentGiven: true, exclusionNote: null }),
    ).toBe("allowed");
    expect(
      classifyPhotoPermission({ status: "pending", consentGiven: true, exclusionNote: null }),
    ).toBe("forbidden");
    expect(
      classifyPhotoPermission({ status: "rejected", consentGiven: true, exclusionNote: null }),
    ).toBe("forbidden");
    expect(
      classifyPhotoPermission({ status: "approved", consentGiven: false, exclusionNote: null }),
    ).toBe("forbidden");
    expect(classifyPhotoPermission(null)).toBe("forbidden");
  });

  it("markiert Ausschlüsse als eingeschränkt", () => {
    expect(
      classifyPhotoPermission({
        status: "approved",
        consentGiven: true,
        exclusionNote: "Keine Nahaufnahmen",
      }),
    ).toBe("restricted");
    expect(
      classifyPhotoPermission({ status: "approved", consentGiven: true, exclusionNote: "  " }),
    ).toBe("allowed");
  });
});

describe("loadPhotoConsentOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sortiert „nicht fotografieren“ nach oben und erkennt Minderjährige", async () => {
    findMany.mockResolvedValue([
      {
        user: {
          id: "a",
          firstName: "Anna",
          lastName: "A",
          name: null,
          email: null,
          dateOfBirth: new Date("1990-01-01"),
          photoConsents: [{ status: "approved", consentGiven: true, exclusionNote: null }],
        },
      },
      {
        user: {
          id: "b",
          firstName: "Ben",
          lastName: "B",
          name: null,
          email: null,
          dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000),
          photoConsents: [],
        },
      },
    ]);

    const rows = await loadPhotoConsentOverview("show-1");

    expect(findMany.mock.calls[0][0].where).toEqual({ showId: "show-1", status: "active" });
    expect(rows.map((row) => [row.userId, row.permission, row.status, row.isMinor])).toEqual([
      ["b", "forbidden", "none", true],
      ["a", "allowed", "approved", false],
    ]);
  });
});

describe("photoConsentOverviewToCsv", () => {
  it("erzeugt Excel-taugliches CSV und entschärft Formeln", () => {
    const csv = photoConsentOverviewToCsv([
      {
        userId: "a",
        name: '=HYPERLINK("x")',
        status: "approved",
        permission: "restricted",
        exclusionNote: 'Keine "Nahaufnahmen"',
        isMinor: false,
      },
    ]);

    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe('"Name";"Fotografieren";"Fotoerlaubnis";"Ausschlüsse";"Minderjährig"');
    expect(lines[1]).toBe(
      '"\'=HYPERLINK(""x"")";"Eingeschränkt";"Erteilt";"Keine ""Nahaufnahmen""";"nein"',
    );
  });
});
