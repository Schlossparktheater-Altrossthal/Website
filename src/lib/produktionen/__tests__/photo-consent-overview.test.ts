import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productionMembership: { findMany: mocks.membershipFindMany },
  },
}));

import {
  classifyPhotoPermission,
  loadPhotoConsentOverview,
  photoConsentOverviewToCsv,
} from "../photo-consent-overview";

describe("classifyPhotoPermission", () => {
  it("zeigt die Stufe nur bei freigegebener Erlaubnis", () => {
    expect(classifyPhotoPermission({ status: "approved", level: "all" })).toBe("all");
    expect(classifyPhotoPermission({ status: "approved", level: "internal" })).toBe("internal");
    expect(classifyPhotoPermission({ status: "pending", level: "all" })).toBe("missing");
    expect(classifyPhotoPermission({ status: "rejected", level: "all" })).toBe("missing");
    expect(classifyPhotoPermission(null)).toBe("missing");
  });

  it("wertet „gar nicht“ ohne Freigabe und Altbestand als unbekannt", () => {
    expect(classifyPhotoPermission({ status: "noPhotos", level: null })).toBe("none");
    expect(classifyPhotoPermission({ status: "pending", level: "none" })).toBe("none");
    expect(classifyPhotoPermission({ status: "approved", level: null })).toBe("unknown");
  });
});

const user = (id: string, firstName: string, consent: object | null, minor = false) => ({
  user: {
    id,
    firstName,
    lastName: "X",
    name: null,
    email: null,
    dateOfBirth: minor
      ? new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000)
      : new Date("1990-01-01"),
    photoConsents: consent ? [consent] : [],
  },
});

describe("loadPhotoConsentOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sortiert die restriktivsten nach oben, unbekannt ans Ende", async () => {
    mocks.membershipFindMany.mockResolvedValue([
      user("a", "Anna", { status: "approved", level: "all", exclusionNote: null }),
      user("b", "Ben", null, true),
      user("c", "Cleo", { status: "approved", level: null, exclusionNote: null }),
      user("d", "Dana", { status: "noPhotos", level: "none", exclusionNote: null }),
      user("e", "Emil", { status: "approved", level: "internal", exclusionNote: " " }),
    ]);

    const overview = await loadPhotoConsentOverview("show-1");

    expect(mocks.membershipFindMany.mock.calls[0][0].where).toEqual({
      showId: "show-1",
      status: "active",
    });
    expect(
      overview.rows.map((row) => [row.userId, row.permission, row.isMinor, row.exclusionNote]),
    ).toEqual([
      ["d", "none", false, null],
      ["b", "missing", true, null],
      ["e", "internal", false, null],
      ["a", "all", false, null],
      ["c", "unknown", false, null],
    ]);
  });
});

describe("photoConsentOverviewToCsv", () => {
  it("erzeugt Excel-taugliches CSV und entschärft Formeln", () => {
    const csv = photoConsentOverviewToCsv({
      rows: [
        {
          userId: "a",
          name: '=HYPERLINK("x")',
          status: "approved",
          permission: "internal",
          exclusionNote: 'Keine "Nahaufnahmen"',
          isMinor: false,
        },
      ],
    });

    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe('"Name";"Fotografieren";"Fotoerlaubnis";"Hinweis";"Minderjährig"');
    expect(lines[1]).toBe(
      `"'=HYPERLINK(""x"")";"Nur intern";"Erteilt";"Keine ""Nahaufnahmen""";"nein"`,
    );
  });
});
