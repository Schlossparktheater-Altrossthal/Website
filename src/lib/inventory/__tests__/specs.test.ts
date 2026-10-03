import { describe, expect, it } from "vitest";

import { parseScanToken } from "@/lib/inventory/constants";
import { createPublicId, isPublicId, PUBLIC_ID_LENGTH } from "@/lib/inventory/public-id";
import { catalogFields, describeSpecs, parseSpecs, type FieldDef } from "@/lib/inventory/specs";

const field = (key: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label: key,
  type: "text",
  unit: null,
  options: [],
  placeholder: null,
  required: false,
  ...extra,
});

describe("publicId", () => {
  it("ist zufällig, 12 Zeichen lang und von Codes unterscheidbar", () => {
    const ids = new Set(Array.from({ length: 500 }, createPublicId));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toHaveLength(PUBLIC_ID_LENGTH);
      expect(isPublicId(id)).toBe(true);
    }
    expect(isPublicId("T-0042")).toBe(false);
  });

  it("liest QR-URLs mit Kennung und lesbare Codes", () => {
    const id = createPublicId();
    expect(parseScanToken(`https://example.org/i/${id}`)).toBe(id);
    expect(parseScanToken(id)).toBe(id);
    expect(parseScanToken("https://example.org/i/T-0042")).toBe("T-0042");
    expect(parseScanToken("t42")).toBe("T-0042");
    expect(parseScanToken("Quatsch!")).toBeNull();
  });
});

describe("Merkmale", () => {
  const area = {
    fields: [field("power", { type: "number", unit: "W" })],
    categories: [
      { id: "ton", parentId: null, name: "Ton", fields: [field("brand")] },
      {
        id: "mic",
        parentId: "ton",
        name: "Mikrofone",
        fields: [field("pattern", { type: "select", options: ["Niere", "Kugel"] })],
      },
      { id: "amp", parentId: "ton", name: "Endstufen", fields: [field("channels")] },
    ],
  };

  it("erbt Bereich und Elternkategorien", () => {
    expect(catalogFields(area, "mic").map((entry) => entry.key)).toEqual([
      "power",
      "brand",
      "pattern",
    ]);
    expect(catalogFields(area, null).map((entry) => entry.key)).toEqual(["power"]);
  });

  it("prüft und normalisiert Werte", () => {
    const fields = [
      ...catalogFields(area, "mic"),
      field("phantom", { type: "boolean" }),
      field("note", { required: true }),
    ];
    expect(
      parseSpecs(fields, { power: "1,5", pattern: "Niere", phantom: true, note: " x ", foo: 1 }),
    ).toEqual({ power: 1.5, pattern: "Niere", phantom: true, note: "x" });
    expect(() => parseSpecs(fields, { note: "" })).toThrow(/note/);
    expect(() => parseSpecs(fields, { note: "x", power: "viel" })).toThrow(/Zahl/);
    expect(() => parseSpecs(fields, { note: "x", pattern: "Acht" })).toThrow(/nicht vorgesehen/);
  });

  it("beschreibt Werte mit Einheit", () => {
    expect(describeSpecs(area.fields, { power: 750 })).toEqual([
      { key: "power", label: "power", value: "750 W" },
    ]);
  });
});
