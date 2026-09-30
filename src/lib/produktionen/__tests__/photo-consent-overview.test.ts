import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindMany: vi.fn(),
  purposeFindMany: vi.fn(),
  purposeCount: vi.fn(),
  purposeCreateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productionMembership: { findMany: mocks.membershipFindMany },
    photoConsentPurpose: {
      findMany: mocks.purposeFindMany,
      count: mocks.purposeCount,
      createMany: mocks.purposeCreateMany,
    },
  },
}));

import {
  classifyPhotoPermission,
  loadPhotoConsentOverview,
  photoConsentOverviewToCsv,
} from "../photo-consent-overview";

describe("classifyPhotoPermission", () => {
  it("erlaubt nur freigegebene Einverständnisse", () => {
    expect(classifyPhotoPermission({ status: "approved", exclusionNote: null })).toBe("allowed");
    expect(classifyPhotoPermission({ status: "pending", exclusionNote: null })).toBe("forbidden");
    expect(classifyPhotoPermission({ status: "rejected", exclusionNote: null })).toBe("forbidden");
    expect(classifyPhotoPermission({ status: "noPhotos", exclusionNote: null })).toBe("forbidden");
    expect(classifyPhotoPermission(null)).toBe("forbidden");
  });

  it("markiert Ausschlüsse als eingeschränkt", () => {
    expect(
      classifyPhotoPermission({
        status: "approved",
        exclusionNote: "Keine Nahaufnahmen",
      }),
    ).toBe("restricted");
    expect(classifyPhotoPermission({ status: "approved", exclusionNote: "  " })).toBe("allowed");
  });
});

describe("loadPhotoConsentOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.purposeCount.mockResolvedValue(1);
    mocks.purposeFindMany.mockResolvedValue([]);
  });

  it("sortiert „nicht fotografieren“ nach oben und erkennt Minderjährige", async () => {
    mocks.membershipFindMany.mockResolvedValue([
      {
        user: {
          id: "a",
          firstName: "Anna",
          lastName: "A",
          name: null,
          email: null,
          dateOfBirth: new Date("1990-01-01"),
          photoConsents: [
            {
              status: "approved",
              exclusionNote: null,
              choices: [{ purposeId: "p1", chosen: true }],
            },
          ],
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

    const overview = await loadPhotoConsentOverview("show-1");

    expect(mocks.membershipFindMany.mock.calls[0][0].where).toEqual({
      showId: "show-1",
      status: "active",
    });
    expect(
      overview.rows.map((row) => [row.userId, row.permission, row.status, row.isMinor]),
    ).toEqual([
      ["b", "forbidden", "none", true],
      ["a", "allowed", "approved", false],
    ]);
  });

  it("liefert jeden Zweck in Katalogreihenfolge mit gewähltem Zustand", async () => {
    mocks.purposeFindMany.mockResolvedValue([
      { id: "p1", label: "Private Foto- und Filmaufnahmen" },
      { id: "p2", label: "Programmheft und Werbung" },
    ]);
    mocks.membershipFindMany.mockResolvedValue([
      {
        user: {
          id: "a",
          firstName: "Anna",
          lastName: "A",
          name: null,
          email: null,
          dateOfBirth: new Date("1990-01-01"),
          photoConsents: [
            {
              status: "approved",
              exclusionNote: null,
              choices: [{ purposeId: "p1", chosen: true }],
            },
          ],
        },
      },
    ]);

    const overview = await loadPhotoConsentOverview("show-1");

    expect(overview.purposes).toEqual([
      "Private Foto- und Filmaufnahmen",
      "Programmheft und Werbung",
    ]);
    expect(overview.rows[0].purposes).toEqual([
      { label: "Private Foto- und Filmaufnahmen", chosen: true },
      { label: "Programmheft und Werbung", chosen: false },
    ]);
  });
});

describe("photoConsentOverviewToCsv", () => {
  it("erzeugt Excel-taugliches CSV mit einer Spalte je Zweck und entschärft Formeln", () => {
    const csv = photoConsentOverviewToCsv({
      purposes: ["Private Foto- und Filmaufnahmen", "Programmheft und Werbung"],
      rows: [
        {
          userId: "a",
          name: '=HYPERLINK("x")',
          status: "approved",
          permission: "restricted",
          exclusionNote: 'Keine "Nahaufnahmen"',
          isMinor: false,
          purposes: [
            { label: "Private Foto- und Filmaufnahmen", chosen: true },
            { label: "Programmheft und Werbung", chosen: false },
          ],
        },
      ],
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      '"Name";"Fotografieren";"Fotoerlaubnis";"Private Foto- und Filmaufnahmen";"Programmheft und Werbung";"Ausschlüsse";"Minderjährig"',
    );
    expect(lines[1]).toBe(
      '"\'=HYPERLINK(""x"")";"Eingeschränkt";"Erteilt";"ja";"";"Keine ""Nahaufnahmen""";"nein"',
    );
  });
});
