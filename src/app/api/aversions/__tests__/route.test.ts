import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    dietaryAversion: {
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import { DELETE, POST } from "../route";

const postRequest = (body: unknown) =>
  new Request("http://localhost/api/aversions", { method: "POST", body: JSON.stringify(body) });

const deleteRequest = (label?: string) =>
  new Request(
    `http://localhost/api/aversions${label ? `?label=${encodeURIComponent(label)}` : ""}`,
    { method: "DELETE" },
  );

describe("POST /api/aversions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "aversion-1" });
    mocks.update.mockResolvedValue({ id: "aversion-1" });
  });

  it("weist eine zu kurze Bezeichnung mit 400 ab", async () => {
    const response = await POST(postRequest({ label: "x" }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("legt eine Besonderheit mit Notiz an", async () => {
    const response = await POST(postRequest({ label: "Keine Pilze", note: "auch keine Trüffel" }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        label: "Keine Pilze",
        note: "auch keine Trüffel",
        isActive: true,
      },
    });
  });

  it("behandelt eine leere Notiz als nicht angegeben", async () => {
    await POST(postRequest({ label: "Keine Innereien", note: "   " }));

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: null }),
    });
  });

  it("aktualisiert einen Eintrag, der sich nur in der Schreibweise unterscheidet", async () => {
    mocks.findMany.mockResolvedValue([{ id: "aversion-1", label: "keine pilze" }]);

    const response = await POST(postRequest({ label: "Keine Pilze" }));

    expect(response.status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "aversion-1" },
      data: { label: "Keine Pilze", note: null, isActive: true },
    });
  });

  it("reaktiviert einen zuvor entfernten Eintrag", async () => {
    mocks.findMany.mockResolvedValue([{ id: "aversion-1", label: "Keine Pilze" }]);

    await POST(postRequest({ label: "Keine Pilze" }));

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "aversion-1" },
      data: expect.objectContaining({ isActive: true }),
    });
  });
});

describe("DELETE /api/aversions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.update.mockResolvedValue({ id: "aversion-1" });
  });

  it("verlangt eine Bezeichnung", async () => {
    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("meldet einen unbekannten Eintrag mit 404", async () => {
    const response = await DELETE(deleteRequest("Keine Pilze"));

    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deaktiviert den Eintrag (soft delete)", async () => {
    mocks.findMany.mockResolvedValue([{ id: "aversion-1", label: "Keine Pilze" }]);

    const response = await DELETE(deleteRequest("keine pilze"));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "aversion-1" },
      data: { isActive: false },
    });
  });
});
