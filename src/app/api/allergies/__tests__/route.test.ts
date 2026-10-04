import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  resolveTaxon: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/food/restriction-store", () => ({
  resolveRestrictionTaxonCode: mocks.resolveTaxon,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    dietaryRestriction: {
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import { DELETE, POST } from "../route";

const postRequest = (body: unknown) =>
  new Request("http://localhost/api/allergies", { method: "POST", body: JSON.stringify(body) });

const deleteRequest = (allergen?: string) =>
  new Request(
    `http://localhost/api/allergies${allergen ? `?allergen=${encodeURIComponent(allergen)}` : ""}`,
    { method: "DELETE" },
  );

const validAllergy = { allergen: "Erdnüsse", level: "SEVERE" };

describe("POST /api/allergies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "allergy-1" });
    mocks.update.mockResolvedValue({ id: "allergy-1" });
    mocks.resolveTaxon.mockResolvedValue("en:peanuts");
  });

  it("weist einen unbekannten Schweregrad mit 400 ab und schreibt nichts", async () => {
    const response = await POST(postRequest({ ...validAllergy, level: "HOELLE" }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("weist eine unbekannte Art mit 400 ab", async () => {
    const response = await POST(postRequest({ ...validAllergy, kind: "UNBEKANNT" }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("weist ein zu kurzes Allergen mit 400 und verständlicher Meldung ab", async () => {
    const response = await POST(postRequest({ allergen: "E", level: "MILD" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("Allergen"),
    });
  });

  it("legt einen neuen Eintrag mit Standardwerten an", async () => {
    const response = await POST(postRequest(validAllergy));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        allergen: "Erdnüsse",
        kind: "ALLERGY",
        level: "SEVERE",
        tracesOk: null,
        diagnosed: false,
        symptoms: null,
        treatment: null,
        note: null,
        isActive: true,
        taxonCode: "en:peanuts",
      },
    });
    expect(mocks.resolveTaxon).toHaveBeenCalledWith("Erdnüsse");
  });

  it("aktualisiert einen Eintrag, der sich nur in der Schreibweise unterscheidet", async () => {
    mocks.findMany.mockResolvedValue([{ id: "allergy-1", allergen: "erdnüsse" }]);

    const response = await POST(postRequest({ ...validAllergy, level: "MILD" }));

    expect(response.status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "allergy-1" },
      data: expect.objectContaining({ allergen: "Erdnüsse", level: "MILD", isActive: true }),
    });
  });

  it("nimmt Art, Spuren-Angabe und Bestätigung an", async () => {
    await POST(
      postRequest({
        allergen: "Laktose",
        level: "MILD",
        kind: "INTOLERANCE",
        tracesOk: true,
        diagnosed: true,
      }),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "INTOLERANCE", tracesOk: true, diagnosed: true }),
    });
  });

  it("reaktiviert einen zuvor entfernten Eintrag", async () => {
    mocks.findMany.mockResolvedValue([{ id: "allergy-1", allergen: "Erdnüsse" }]);

    await POST(postRequest(validAllergy));

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "allergy-1" },
      data: expect.objectContaining({ isActive: true }),
    });
  });
});

describe("DELETE /api/allergies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.update.mockResolvedValue({ id: "allergy-1" });
  });

  it("verlangt ein Allergen", async () => {
    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("meldet einen unbekannten Eintrag mit 404 statt mit einem Serverfehler", async () => {
    const response = await DELETE(deleteRequest("Erdnüsse"));

    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deaktiviert den Eintrag auch bei anderer Schreibweise", async () => {
    mocks.findMany.mockResolvedValue([{ id: "allergy-1", allergen: "Erdnüsse" }]);

    const response = await DELETE(deleteRequest("erdnüsse"));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "allergy-1" },
      data: { isActive: false },
    });
  });
});
