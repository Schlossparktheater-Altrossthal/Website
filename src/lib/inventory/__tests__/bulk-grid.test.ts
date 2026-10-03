import { describe, expect, it } from "vitest";

import {
  bulkColumns,
  cellDisplay,
  commitCellValue,
  duplicateRow,
  isBlankRow,
  resolveOption,
  validateRow,
  type BulkContext,
  type DraftRow,
} from "@/lib/inventory/bulk-grid";
import { parseClipboardTable, toClipboardTable } from "@/lib/inventory/grid-clipboard";

const ctx: BulkContext = {
  areas: [
    {
      id: "a-t",
      name: "Technik",
      prefix: "T",
      inspectionDefault: true,
      fields: [
        {
          key: "power",
          label: "Leistung",
          type: "text",
          unit: null,
          options: [],
          placeholder: null,
          required: false,
        },
      ],
      categories: [
        { id: "c-licht", parentId: null, name: "Licht", fields: [] },
        { id: "c-kabel", parentId: null, name: "Kabel", fields: [] },
      ],
    },
    {
      id: "a-k",
      name: "Kostüm",
      prefix: "K",
      inspectionDefault: false,
      fields: [
        {
          key: "size",
          label: "Größe",
          type: "text",
          unit: null,
          options: [],
          placeholder: null,
          required: false,
        },
      ],
      categories: [{ id: "c-kleid", parentId: null, name: "Kleider", fields: [] }],
    },
  ],
  placement: {
    locations: [
      { id: "l1", code: "L-0003", path: "Lager › Regal A" },
      { id: "l2", code: "L-0004", path: "Lager › Regal B" },
    ],
    containers: [{ id: "k1", code: "T-0100", name: "Kabelkiste", path: "Lager" }],
  },
  canManage: false,
  mixed: false,
  areaId: "a-t",
};

const row = (cells: Record<string, string>): DraftRow => ({ id: "r", cells });
const column = (key: string, context = ctx) => bulkColumns(context).find((c) => c.key === key)!;

describe("resolveOption", () => {
  const options = [
    { value: "1", label: "Licht" },
    { value: "2", label: "Lichtsteuerung" },
    { value: "3", label: "Kabel" },
  ];
  it("erkennt exakte, eindeutige und mehrdeutige Eingaben", () => {
    expect(resolveOption(options, "licht")?.value).toBe("1");
    expect(resolveOption(options, "kab")?.value).toBe("3");
    expect(resolveOption(options, "steuer")?.value).toBe("2");
    expect(resolveOption(options, "li")).toBeNull();
    expect(resolveOption(options, "3")?.value).toBe("3");
  });
});

describe("Spalten", () => {
  it("zeigt Bereichsfelder des gewählten Bereichs und Bereich nur gemischt", () => {
    const keys = bulkColumns(ctx).map((c) => c.key);
    expect(keys).toContain("attr.power");
    expect(keys).not.toContain("attr.size");
    expect(keys).not.toContain("area");
    expect(keys).not.toContain("acquisitionCost");
    const mixed = bulkColumns({ ...ctx, mixed: true, canManage: true }).map((c) => c.key);
    expect(mixed[0]).toBe("area");
    expect(mixed).toContain("attr.size");
    expect(mixed).toContain("acquisitionCost");
  });

  it("löst Ort per Code, Scan-URL und Kiste auf", () => {
    const placement = column("placement");
    expect(commitCellValue(placement, row({}), "l3")).toBe("location:l1");
    expect(commitCellValue(placement, row({}), "https://x.de/i/T-0100")).toBe("container:k1");
    expect(commitCellValue(placement, row({}), "regal b")).toBe("location:l2");
    expect(cellDisplay(placement, row({ placement: "irgendwo" }))).toEqual({
      text: "irgendwo",
      unresolved: true,
    });
  });
});

describe("validateRow", () => {
  it("baut die Eingabe für ein Einzelstück mit Bereichsvorgaben", () => {
    const result = validateRow(
      row({ name: " PAR 64 ", category: "licht", placement: "L-0003", "attr.power": "575 W" }),
      ctx,
    );
    expect(result.errors).toEqual({});
    expect(result.input).toMatchObject({
      areaId: "a-t",
      categoryId: "c-licht",
      kind: "unique",
      name: "PAR 64",
      condition: "good",
      placement: { type: "location", id: "l1" },
      specs: { power: "575 W" },
      inspectionRequired: true,
      quantity: null,
      unit: null,
    });
  });

  it("Mengenartikel: Menge, Einheit, keine Prüfpflicht", () => {
    const result = validateRow(
      row({ name: "Schuko", kind: "menge", quantity: "24", placement: "L-0003" }),
      ctx,
    );
    expect(result.input).toMatchObject({
      kind: "bulk",
      quantity: 24,
      unit: "Stk.",
      inspectionRequired: false,
    });
    expect(validateRow(row({ name: "x", kind: "bulk", quantity: "3" }), ctx).errors).toHaveProperty(
      "placement",
    );
    expect(
      validateRow(row({ name: "x", kind: "bulk", quantity: "2,5" }), ctx).errors,
    ).toHaveProperty("quantity");
  });

  it("meldet fehlende Namen und nicht erkannte Werte je Spalte", () => {
    const result = validateRow(row({ category: "Möbel", condition: "super" }), ctx);
    expect(result.input).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual(["category", "condition", "name"]);
  });

  it("gemischt: Bereich pro Zeile, Kategorie passend zum Bereich", () => {
    const mixed = { ...ctx, mixed: true };
    expect(
      validateRow(row({ name: "Kleid", area: "K", category: "kleider" }), mixed).input,
    ).toMatchObject({ areaId: "a-k", categoryId: "c-kleid", inspectionRequired: false });
    expect(
      validateRow(row({ name: "Kleid", area: "K", category: "licht" }), mixed).errors,
    ).toHaveProperty("category");
    expect(validateRow(row({ name: "Kleid" }), mixed).errors).toHaveProperty("area");
  });

  it("ignoriert Preise ohne Verwaltungsrecht", () => {
    const result = validateRow(row({ name: "x", acquisitionCost: "12,50" }), ctx);
    expect(result.input).toMatchObject({ acquisitionCost: null });
    const manage = validateRow(row({ name: "x", acquisitionCost: "12,50" }), {
      ...ctx,
      canManage: true,
    });
    expect(manage.input).toMatchObject({ acquisitionCost: 12.5 });
  });
});

describe("Zeilen", () => {
  it("erkennt leere Zeilen trotz Vorgaben und dupliziert ohne Seriennummer", () => {
    expect(isBlankRow(row({ category: "c-licht", name: "" }), { category: "c-licht" })).toBe(true);
    expect(isBlankRow(row({ category: "c-kabel" }), { category: "c-licht" })).toBe(false);
    expect(duplicateRow(row({ name: "A", serialNumber: "123" }), "n").cells).toEqual({ name: "A" });
  });
});

describe("Zwischenablage", () => {
  it("liest TSV aus Tabellenkalkulationen inkl. Anführungszeichen", () => {
    expect(parseClipboardTable('PAR 64\tLicht\r\n"Kabel\t5 m"\t"sagt ""hi"""\n')).toEqual([
      ["PAR 64", "Licht"],
      ["Kabel\t5 m", 'sagt "hi"'],
    ]);
    expect(parseClipboardTable("einzeln")).toEqual([["einzeln"]]);
  });

  it("schreibt TSV zurück", () => {
    const table = [
      ["a", "b\tc"],
      ['d"', ""],
    ];
    expect(parseClipboardTable(toClipboardTable(table))).toEqual(table);
  });
});
