import { describe, expect, it } from "vitest";

import {
  parseFitsFilter,
  parseSpecFilters,
  parseTagFilter,
  scopeFilterFields,
} from "@/lib/inventory/spec-filters";
import type { FieldDef } from "@/lib/inventory/specs";

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

describe("Merkmal-Filter", () => {
  const fields = [
    field("weight", { type: "measure", unit: "kg" }),
    field("channels", { type: "number" }),
    field("pattern", { type: "select", options: ["Niere", "Kugel"] }),
    field("dmx", { type: "boolean" }),
    field("colors", { type: "multiselect", options: ["rot", "blau"] }),
    field("size", { type: "dimensions", unit: "cm" }),
  ];

  it("liest Bereiche in Basiseinheiten und Werte", () => {
    expect(
      parseSpecFilters(fields, {
        "m.weight": "~10",
        "m.channels": "2~4",
        "m.pattern": "Niere",
        "m.dmx": "ja",
        "m.colors": "rot",
        "m.size": "100x50x20",
      }),
    ).toEqual([
      { key: "weight", op: "lte", value: 10_000 },
      { key: "channels", op: "gte", value: 2 },
      { key: "channels", op: "lte", value: 4 },
      { key: "pattern", op: "equals", value: "Niere" },
      { key: "dmx", op: "equals", value: true },
      { key: "colors", op: "has", value: "rot" },
    ]);
  });

  it("liest „passt in“ sortiert und ohne Höhe als Grundfläche", () => {
    expect(parseFitsFilter("50x130x90")).toEqual({ min: 500, mid: 900, max: 1300 });
    expect(parseFitsFilter("120x80")).toMatchObject({ min: 800, mid: 1200 });
    expect(parseFitsFilter("groß")).toBeNull();
  });

  it("liest Tags ohne Doppelte", () => {
    expect(parseTagFilter("Barock, rot,Barock,")).toEqual(["Barock", "rot"]);
  });

  it("bietet Merkmale der Kategorie oder des ganzen Bereichs an", () => {
    const catalog = [
      {
        id: "t",
        fields: [field("power", { type: "measure", unit: "W" })],
        categories: [
          {
            id: "mic",
            parentId: null,
            name: "Mikrofone",
            fields: [field("pattern")],
            overrides: [],
          },
          {
            id: "kond",
            parentId: "mic",
            name: "Kondensator",
            fields: [],
            overrides: [{ key: "power", hidden: true, required: null }],
          },
        ],
      },
    ];
    expect(scopeFilterFields(catalog, "t", null).map((f) => f.key)).toEqual(["power", "pattern"]);
    expect(scopeFilterFields(catalog, "t", "kond").map((f) => f.key)).toEqual(["pattern"]);
    expect(scopeFilterFields(catalog, null, null)).toEqual([]);
  });
});
