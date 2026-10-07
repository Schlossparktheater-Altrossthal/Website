import { describe, expect, it } from "vitest";

import { parseScanToken } from "@/lib/inventory/constants";
import { createPublicId, isPublicId, PUBLIC_ID_LENGTH } from "@/lib/inventory/public-id";
import {
  catalogFields,
  describeSpecs,
  formatDimensions,
  formatMeasure,
  formatRange,
  inheritedFields,
  parseDimensions,
  parseMeasure,
  parseRange,
  parseSpecs,
  readSpecs,
  specToInput,
  type FieldDef,
} from "@/lib/inventory/specs";

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
    expect(isPublicId("T-42-3")).toBe(false);
  });

  it("liest QR-URLs mit Kennung und lesbare Codes", () => {
    const id = createPublicId();
    expect(parseScanToken(`https://example.org/i/${id}`)).toBe(id);
    expect(parseScanToken(id)).toBe(id);
    expect(parseScanToken("https://example.org/i/T-42-3")).toBe("T-42-3");
    expect(parseScanToken("t42")).toBe("T-42");
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
      { key: "power", label: "power", value: "750 W", type: "number" },
    ]);
  });
});

describe("Merkmal-Ausnahmen", () => {
  const area = {
    fields: [field("power"), field("plug")],
    categories: [
      { id: "licht", parentId: null, name: "Licht", fields: [field("dmx")], overrides: [] },
      {
        id: "kerze",
        parentId: "licht",
        name: "Kerzen",
        fields: [],
        overrides: [
          { key: "plug", hidden: true, required: null },
          { key: "dmx", hidden: true, required: null },
          { key: "power", hidden: false, required: true },
        ],
      },
      {
        id: "led",
        parentId: "kerze",
        name: "LED-Kerzen",
        fields: [],
        overrides: [{ key: "plug", hidden: false, required: null }],
      },
    ],
  };
  const keys = (id: string) => catalogFields(area, id).map((entry) => entry.key);

  it("blendet geerbte Merkmale ab der Kategorie aus und ändert Pflicht", () => {
    expect(keys("licht")).toEqual(["power", "plug", "dmx"]);
    expect(keys("kerze")).toEqual(["power"]);
    expect(catalogFields(area, "kerze")[0]!.required).toBe(true);
  });

  it("vererbt Ausnahmen weiter und erlaubt Wiedereinblenden", () => {
    expect(keys("led")).toEqual(["power", "plug"]);
  });

  it("listet geerbte Merkmale mit Herkunft", () => {
    const path = [area.categories[0]!, area.categories[1]!];
    const rows = inheritedFields({ name: "Technik", fields: area.fields }, path);
    expect(rows.map((row) => [row.field.key, row.origin, row.override?.hidden ?? null])).toEqual([
      ["power", "Technik", false],
      ["plug", "Technik", true],
      ["dmx", "Licht", true],
    ]);
  });
});

describe("Messwerte und Maße", () => {
  it("rechnet Einheiten in die Basiseinheit um", () => {
    expect(parseMeasure("500 g", "kg")).toBe(500);
    expect(parseMeasure("0,5", "kg")).toBe(500);
    expect(parseMeasure("1,2kW", "W")).toBe(1200);
    expect(parseMeasure("3 m", "kg")).toBeNull();
    expect(formatMeasure(500, "kg")).toBe("0,5 kg");
  });

  it("liest Maße in einem Feld", () => {
    expect(parseDimensions("120x80x40", "cm")).toMatchObject({ l: 1200, w: 800, h: 400 });
    expect(parseDimensions("120 × 80 × 40 cm", "mm")).toMatchObject({ l: 1200, w: 800, h: 400 });
    expect(parseDimensions("1,2m x 80 x 40", "cm")).toMatchObject({ l: 1200, w: 800, h: 400 });
    expect(parseDimensions("120*80", "cm")).toMatchObject({ l: 1200, w: 800, h: null, min: 0 });
    expect(parseDimensions("120 x 80 x 40 x 3", "cm")).toBeNull();
    expect(parseDimensions("groß", "cm")).toBeNull();
    const dims = parseDimensions("40x120x80", "cm")!;
    expect([dims.min, dims.mid, dims.max]).toEqual([400, 800, 1200]);
    expect(formatDimensions(dims, "cm")).toBe("40 × 120 × 80 cm");
    expect(formatDimensions(dims, "m")).toBe("0,4 × 1,2 × 0,8 m");
  });

  it("prüft neue Merkmaltypen", () => {
    const fields = [
      field("size", { type: "dimensions", unit: "cm" }),
      field("weight", { type: "measure", unit: "kg" }),
      field("colors", { type: "multiselect", options: ["rot", "blau"] }),
      field("bought", { type: "date" }),
    ];
    const specs = parseSpecs(fields, {
      size: "100x50x20",
      weight: "2500 g",
      colors: "rot; blau; rot",
      bought: "3.4.2026",
    });
    expect(specs).toMatchObject({ weight: 2500, colors: ["rot", "blau"], bought: "2026-04-03" });
    expect(describeSpecs(fields, readSpecs(specs)).map((row) => row.value)).toEqual([
      "100 × 50 × 20 cm",
      "2,5 kg",
      "rot, blau",
      "03.04.2026",
    ]);
    expect(specToInput(fields[1]!, 2500)).toBe("2,5");
    expect(() => parseSpecs(fields, { colors: "grün" })).toThrow(/nicht vorgesehen/);
    expect(() => parseSpecs(fields, { size: "groß" })).toThrow(/L × B × H/);
    expect(() => parseSpecs(fields, { bought: "31.2.2026" })).toThrow(/Datum/);
  });
});

describe("Bereich, Bewertung, Farbe, Link, Text und Zeitraum", () => {
  const fields = [
    field("zoom", { type: "range", unit: "mm" }),
    field("saal", { type: "daterange" }),
    field("rating", { type: "scale" }),
    field("farbe", { type: "color" }),
    field("blatt", { type: "url" }),
    field("notiz", { type: "note" }),
    field("motiv", { type: "combo", options: ["rot", "blau"] }),
  ];

  it("prüft und normalisiert einen Zahlbereich", () => {
    expect(parseSpecs(fields, { zoom: "4~16" })).toEqual({ zoom: { from: 4, to: 16 } });
    expect(parseSpecs(fields, { zoom: "4" })).toEqual({ zoom: { from: 4, to: 4 } });
    expect(parseSpecs(fields, { zoom: "~16" })).toEqual({ zoom: { from: null, to: 16 } });
    expect(() => parseSpecs(fields, { zoom: "16~4" })).toThrow(/bitte als/);
    expect(() => parseSpecs(fields, { zoom: "viel" })).toThrow(/bitte als/);
    expect(parseRange("abc")).toBeNull();
    expect(formatRange({ from: 4, to: 16 }, "mm")).toBe("4 – 16 mm");
    expect(formatRange({ from: 4, to: null }, "mm")).toBe("ab 4 mm");
    expect(formatRange({ from: null, to: 16 }, "mm")).toBe("bis 16 mm");
    expect(specToInput(fields[0]!, { from: 4, to: 16 })).toBe("4~16");
    expect(() => parseSpecs([field("zoom", { type: "range", required: true })], {})).toThrow(
      /zoom/,
    );
  });

  it("prüft Bewertung, Farbe, Link und Freitext-Auswahl", () => {
    expect(parseSpecs(fields, { rating: 3, farbe: "#ABC", blatt: "example.org/x" })).toMatchObject({
      rating: 3,
      farbe: "#aabbcc",
      blatt: "example.org/x",
    });
    expect(() => parseSpecs(fields, { rating: 9 })).toThrow(/1 bis 5/);
    expect(() => parseSpecs(fields, { farbe: "blau" })).toThrow(/Farbwert/);
    expect(() => parseSpecs(fields, { blatt: "kein link" })).toThrow(/Link/);
    // Auswahl mit Freitext: auch ein nicht gelisteter Wert ist erlaubt.
    expect(parseSpecs(fields, { motiv: "grün" })).toEqual({ motiv: "grün" });
  });

  it("liest einen Datums-Zeitraum und zeigt Werte typtreu an", () => {
    const specs = parseSpecs(fields, {
      zoom: "4~16",
      saal: "2026-01-01~2026-03-31",
      notiz: "Zeile 1",
      farbe: "#1e40af",
    });
    const rows = describeSpecs(fields, readSpecs(specs));
    expect(rows.map((row) => row.value)).toEqual([
      "4 – 16 mm",
      "01.01.2026 – 31.03.2026",
      "#1e40af",
      "Zeile 1",
    ]);
    expect(rows[2]!.type).toBe("color");
    expect(specToInput(fields[1]!, { from: "2026-01-01", to: "2026-03-31" })).toBe(
      "2026-01-01~2026-03-31",
    );
  });
});
