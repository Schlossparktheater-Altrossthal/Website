import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../route";
import { GET as ADMIN_GET } from "../admin/route";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
  getActiveProductionId: vi.fn(),
  userFindUnique: vi.fn(),
  consentUpsert: vi.fn(),
  consentFindMany: vi.fn(),
  consentFindUnique: vi.fn(),
  consentUpdate: vi.fn(),
  versionFindFirst: vi.fn(),
  versionCreate: vi.fn(),
  consentFindFirst: vi.fn(),
  showFindMany: vi.fn(),
  showFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/active-production", () => ({
  getActiveProductionId: mocks.getActiveProductionId,
}));
vi.mock("@/lib/photo-consent-notifications", () => ({
  createPhotoConsentBoardNotification: mocks.createNotification,
  dispatchPhotoConsentBoardNotification: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    photoConsent: { upsert: mocks.consentUpsert, update: mocks.consentUpdate },
    photoConsentVersion: { findFirst: mocks.versionFindFirst, create: mocks.versionCreate },
  };
  return {
    prisma: {
      user: { findUnique: mocks.userFindUnique },
      photoConsent: {
        findMany: mocks.consentFindMany,
        findUnique: mocks.consentFindUnique,
        findFirst: mocks.consentFindFirst,
      },
      productionMembership: { findMany: mocks.membershipFindMany },
      show: { findMany: mocks.showFindMany, findUnique: mocks.showFindUnique },
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

const jsonRequest = (body: unknown) =>
  ({
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  }) as NextRequest;

const adminRequest = (query = "") =>
  ({
    nextUrl: new URL(`http://localhost/api/photo-consents/admin${query}`),
  }) as NextRequest;

const signature = {
  version: "velocity.v1",
  width: 300,
  height: 120,
  duration: 100,
  startedAt: "2026-10-03T10:00:00.000Z",
  endedAt: "2026-10-03T10:00:00.100Z",
  boundingBox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  strokes: [{ points: [{ x: 0, y: 0, time: 0 }] }],
};

const consentRecord = {
  id: "consent-1",
  status: "pending",
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  approvedAt: null,
  rejectionReason: null,
  exclusionNote: null,
  documentUploadedAt: null,
  documentName: null,
  documentMime: null,
  signatureVersion: null,
  signatureCapturedAt: null,
  signaturePayload: null,
  approvedBy: null,
};

describe("Fotoerlaubnis pro Produktion (Mitglied)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getActiveProductionId.mockResolvedValue("show-2027");
    mocks.createNotification.mockResolvedValue(null);
    mocks.showFindUnique.mockResolvedValue({ title: "Faust", year: 2027 });
    mocks.consentFindFirst.mockResolvedValue(null);
  });

  it("liest nur die Erlaubnis der aktuellen Produktion", async () => {
    mocks.userFindUnique.mockResolvedValue({
      dateOfBirth: new Date("1990-01-01"),
      photoConsents: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(data.consent.status).toBe("none");
    expect(data.consent.showTitle).toBe("Faust");
    const select = mocks.userFindUnique.mock.calls[0][0].select;
    expect(select.photoConsents.where).toEqual({ showId: "show-2027" });
  });

  it("lehnt eine Erlaubnis ohne Produktionszuordnung ab", async () => {
    mocks.getActiveProductionId.mockResolvedValue(null);

    const response = await POST(jsonRequest({ level: "all", signaturePayload: signature }));

    expect(response.status).toBe(409);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
  });

  it("speichert die Erlaubnis für die aktuelle Produktion und setzt sie auf ausstehend", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "A",
      name: null,
      email: "anna@example.org",
      dateOfBirth: new Date("1990-01-01"),
      photoConsents: [],
    });
    mocks.consentUpsert.mockResolvedValue(consentRecord);

    const response = await POST(
      jsonRequest({
        level: "internal",
        exclusionNote: "keine Nahaufnahmen",
        signaturePayload: signature,
      }),
    );

    expect(response.status).toBe(200);
    const args = mocks.consentUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_showId: { userId: "user-1", showId: "show-2027" } });
    expect(args.create).toMatchObject({
      userId: "user-1",
      showId: "show-2027",
      status: "pending",
      level: "internal",
      exclusionNote: "keine Nahaufnahmen",
      documentData: null,
    });
    expect(args.update).toMatchObject({ status: "pending", approvedAt: null, revokedAt: null });
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ level: "internal", signatureVersion: "velocity.v1" }),
    });
  });

  it("verlangt auch von Volljährigen eine Unterschrift je Produktion", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "A",
      name: null,
      email: null,
      dateOfBirth: new Date("1990-01-01"),
      photoConsents: [],
    });

    const response = await POST(jsonRequest({ level: "all" }));

    expect(response.status).toBe(400);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
  });

  it("speichert „gar nicht“ sofort und ohne Nachweis", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "A",
      name: null,
      email: null,
      dateOfBirth: null,
      photoConsents: [],
    });
    mocks.consentUpsert.mockResolvedValue({ ...consentRecord, status: "noPhotos" });

    const response = await POST(jsonRequest({ level: "none" }));

    expect(response.status).toBe(200);
    expect(mocks.consentUpsert.mock.calls[0][0].create).toMatchObject({
      status: "noPhotos",
      level: "none",
    });
  });

  it("widerruft die aktive Einwilligung mit Datum und Versionshistorie", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "A",
      name: null,
      email: "anna@example.org",
    });
    mocks.consentFindUnique.mockResolvedValue({
      id: "consent-1",
      revokedAt: null,
      exclusionNote: null,
    });
    mocks.versionFindFirst.mockResolvedValue(null);
    mocks.versionCreate.mockResolvedValue({ version: 1 });

    const response = await POST(jsonRequest({ revoke: true }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.revoked).toBe(true);
    expect(typeof data.revokedAt).toBe("string");
    expect(mocks.consentUpdate).toHaveBeenCalledWith({
      where: { id: "consent-1" },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "revocation", status: "noPhotos" }),
    });
  });

  it("verlangt bei Minderjährigen ein Dokument für die neue Produktion", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Ben",
      lastName: "B",
      name: null,
      email: null,
      dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000),
      photoConsents: [],
    });

    const response = await POST(jsonRequest({ level: "all" }));

    expect(response.status).toBe(400);
    expect(mocks.consentUpsert).not.toHaveBeenCalled();
  });

  it("bietet Minderjährigen keine Rückfrage-Stufe an", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Ben",
      lastName: "B",
      name: null,
      email: null,
      dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000),
      photoConsents: [],
    });

    const response = await POST(
      jsonRequest({ level: "promoOnRequest", signaturePayload: signature }),
    );

    expect(response.status).toBe(400);
  });

  it("lässt Minderjährige den Eltern-Nachweis nachreichen", async () => {
    mocks.userFindUnique.mockResolvedValue({
      firstName: "Ben",
      lastName: "B",
      name: null,
      email: null,
      dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000),
      photoConsents: [],
    });
    mocks.consentUpsert.mockResolvedValue(consentRecord);

    const response = await POST(jsonRequest({ level: "all", deferProof: true }));

    expect(response.status).toBe(200);
  });
});

describe("Fotoerlaubnis-Verwaltung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.consentFindMany.mockResolvedValue([]);
    mocks.showFindMany.mockResolvedValue([
      { id: "show-2027", title: null, year: 2027, status: "planning" },
    ]);
    mocks.membershipFindMany.mockResolvedValue([]);
  });

  it("zeigt standardmäßig die aktuell ausgewählte Produktion", async () => {
    mocks.getActiveProductionId.mockResolvedValue("show-2027");

    const data = await (await ADMIN_GET(adminRequest())).json();

    expect(mocks.consentFindMany.mock.calls[0][0].where).toEqual({ showId: "show-2027" });
    expect(data.showId).toBe("show-2027");
    expect(data.shows).toEqual([
      { id: "show-2027", title: "Produktion 2027", year: 2027, status: "planning" },
    ]);
  });

  it("zeigt mit showId=all alle Produktionen", async () => {
    await ADMIN_GET(adminRequest("?showId=all"));

    expect(mocks.consentFindMany.mock.calls[0][0].where).toEqual({});
    expect(mocks.getActiveProductionId).not.toHaveBeenCalled();
  });

  it("verweigert ohne Berechtigung", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect((await ADMIN_GET(adminRequest())).status).toBe(403);
  });
});
