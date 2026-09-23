import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  consentFindMany: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    photoConsent: { findMany: mocks.consentFindMany },
  },
}));
vi.mock("@/lib/authentik/sync", () => ({ deactivateMemberInAuthentik: mocks.deactivate }));

import {
  collectRetentionCandidates,
  lastProductionEnd,
  productionEndDate,
  yearsBefore,
} from "../retention";

const now = new Date("2032-06-01T00:00:00Z");
const finished = (year: number, statusChangedAt: string | null = null) => ({
  status: "finished" as const,
  statusChangedAt: statusChangedAt ? new Date(statusChangedAt) : null,
  year,
});

describe("Fristberechnung", () => {
  it("rechnet Jahre zurück", () => {
    expect(yearsBefore(now, 2)).toEqual(new Date("2030-06-01T00:00:00Z"));
  });

  it("nimmt das Ende der Produktion, ersatzweise das Jahresende", () => {
    expect(productionEndDate(finished(2026, "2026-08-15"))).toEqual(new Date("2026-08-15"));
    expect(productionEndDate(finished(2026))).toEqual(new Date(Date.UTC(2026, 11, 31)));
  });

  it("läuft nicht, solange jemand in einer laufenden Produktion ist", () => {
    expect(
      lastProductionEnd(
        [
          {
            status: "active",
            joinedAt: new Date("2031-01-01"),
            leftAt: null,
            show: { status: "planning", statusChangedAt: null, year: 2032 },
          },
        ],
        new Date("2020-01-01"),
      ),
    ).toBeNull();
  });

  it("nimmt das späteste Ende und berücksichtigt früheres Ausscheiden", () => {
    const end = lastProductionEnd(
      [
        {
          status: "left",
          joinedAt: new Date("2026-01-01"),
          leftAt: new Date("2026-08-15"),
          show: finished(2026, "2026-09-01"),
        },
        {
          status: "left",
          joinedAt: new Date("2027-01-01"),
          leftAt: new Date("2027-03-01"),
          show: finished(2027, "2027-09-01"),
        },
      ],
      new Date("2020-01-01"),
    );
    expect(end).toEqual(new Date("2027-03-01"));
  });

  it("nutzt ohne Produktionen das Anlagedatum", () => {
    expect(lastProductionEnd([], new Date("2020-01-01"))).toEqual(new Date("2020-01-01"));
  });
});

function user(overrides: Record<string, unknown>) {
  return {
    id: "u",
    firstName: "Anna",
    lastName: "A",
    name: null,
    email: null,
    createdAt: new Date("2020-01-01"),
    deactivatedAt: new Date("2027-01-01"),
    role: "member",
    roles: [],
    productionMemberships: [],
    _count: { dietaryRestrictions: 1 },
    onboardingProfile: null,
    ...overrides,
  };
}

const membershipEndingIn = (date: string) => ({
  status: "left",
  joinedAt: new Date("2020-01-01"),
  leftAt: null,
  show: finished(Number(date.slice(0, 4)), date),
});

describe("collectRetentionCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consentFindMany.mockResolvedValue([]);
  });

  it("schlägt Allergien nach 2 und Konten nach 6 Jahren vor", async () => {
    mocks.userFindMany.mockResolvedValue([
      user({ id: "vor-3-jahren", productionMemberships: [membershipEndingIn("2029-05-01")] }),
      user({ id: "vor-1-jahr", productionMemberships: [membershipEndingIn("2031-05-01")] }),
      user({ id: "vor-7-jahren", productionMemberships: [membershipEndingIn("2025-05-01")] }),
    ]);

    const result = await collectRetentionCandidates(now);

    expect(result.dietary.map((entry) => entry.id)).toEqual(["vor-7-jahren", "vor-3-jahren"]);
    expect(result.accounts.map((entry) => entry.id)).toEqual(["vor-7-jahren"]);
  });

  it("schlägt geschützte, aktive und bereits bereinigte Konten nicht vor", async () => {
    mocks.userFindMany.mockResolvedValue([
      user({
        id: "vorstand",
        roles: [{ role: "board" }],
        productionMemberships: [membershipEndingIn("2020-05-01")],
      }),
      user({
        id: "aktiv",
        deactivatedAt: null,
        productionMemberships: [membershipEndingIn("2020-05-01")],
      }),
      user({
        id: "ohne-allergien",
        _count: { dietaryRestrictions: 0 },
        productionMemberships: [membershipEndingIn("2029-05-01")],
      }),
    ]);

    const result = await collectRetentionCandidates(now);

    expect(result.accounts).toEqual([]);
    expect(result.dietary.map((entry) => entry.id)).toEqual(["vorstand", "aktiv"]);
    expect(mocks.userFindMany.mock.calls[0][0].where).toEqual({ anonymizedAt: null });
  });

  it("schlägt Fotoerlaubnisse 5 Jahre nach Ende der Produktion vor", async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.consentFindMany.mockResolvedValue([
      {
        id: "alt",
        user: { firstName: "A", lastName: null, name: null, email: null },
        show: {
          title: "Alt",
          year: 2026,
          status: "finished",
          statusChangedAt: new Date("2026-09-01"),
        },
      },
      {
        id: "neu",
        user: { firstName: "B", lastName: null, name: null, email: null },
        show: {
          title: "Neu",
          year: 2028,
          status: "finished",
          statusChangedAt: new Date("2028-09-01"),
        },
      },
    ]);

    const result = await collectRetentionCandidates(now);

    expect(result.photoConsents.map((entry) => entry.id)).toEqual(["alt"]);
  });
});
