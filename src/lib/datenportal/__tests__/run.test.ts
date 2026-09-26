import { describe, expect, it } from "vitest";

import { portalRowsToCsv } from "../csv";
import { SOURCE_FIELDS, allowedFields } from "../fields";
import { PortalFieldError, ageOn, applyQuery, projectRows, type PortalRow } from "../run";

const fields = SOURCE_FIELDS.participants;
const rows: PortalRow[] = [
  {
    name: "Anna",
    school: "Gymnasium Nord",
    age: 14,
    hasAllergy: true,
    allergies: "Nüsse (schwer)",
  },
  { name: "Ben", school: "Oberschule Süd", age: 16, hasAllergy: false, allergies: "" },
  { name: "Cem", school: null, age: null, hasAllergy: false, allergies: "" },
  { name: "=SUM(A1)", school: "Gymnasium Nord", age: 12, hasAllergy: false, allergies: "" },
];

describe("applyQuery", () => {
  it("filtert Text case-insensitive mit contains", () => {
    const result = applyQuery(
      rows,
      { filters: [{ field: "school", op: "contains", value: "gymnasium" }] },
      fields,
    );
    expect(result.map((row) => row.name)).toEqual(["Anna", "=SUM(A1)"]);
  });

  it("kombiniert Filter mit UND und behandelt boolean und Zahlen", () => {
    const result = applyQuery(
      rows,
      {
        filters: [
          { field: "hasAllergy", op: "equals", value: "true" },
          { field: "age", op: "lt", value: "15" },
        ],
      },
      fields,
    );
    expect(result.map((row) => row.name)).toEqual(["Anna"]);
  });

  it("isEmpty erkennt null und leere Strings", () => {
    const result = applyQuery(rows, { filters: [{ field: "school", op: "isEmpty" }] }, fields);
    expect(result.map((row) => row.name)).toEqual(["Cem"]);
  });

  it("sortiert und stellt leere Werte ans Ende", () => {
    const result = applyQuery(rows, { filters: [], sort: { field: "age", dir: "asc" } }, fields);
    expect(result.map((row) => row.name)).toEqual(["=SUM(A1)", "Anna", "Ben", "Cem"]);
  });

  it("lehnt Filter auf nicht erlaubte Felder ab", () => {
    const allowed = allowedFields("participants", { base: true, education: false, health: false });
    expect(() =>
      applyQuery(rows, { filters: [{ field: "allergies", op: "notEmpty" }] }, allowed),
    ).toThrow(PortalFieldError);
  });
});

describe("projectRows", () => {
  it("wirft bei nicht erlaubter Spalte", () => {
    const allowed = allowedFields("participants", { base: true, education: false, health: false });
    expect(() => projectRows(rows, ["name", "school"], allowed)).toThrow(PortalFieldError);
  });
});

describe("allowedFields", () => {
  it("gibt ohne Gesundheitsrecht keine Gesundheitsfelder frei", () => {
    const keys = allowedFields("participants", { base: true, education: true, health: false }).map(
      (f) => f.key,
    );
    expect(keys).not.toContain("allergies");
    expect(keys).toContain("school");
    expect(allowedFields("allergies", { base: true, education: true, health: false })).toHaveLength(
      0,
    );
  });
});

describe("ageOn", () => {
  it("berücksichtigt den Geburtstag im laufenden Jahr", () => {
    expect(ageOn(new Date(2010, 5, 15), new Date(2026, 5, 14))).toBe(15);
    expect(ageOn(new Date(2010, 5, 15), new Date(2026, 5, 15))).toBe(16);
  });
});

describe("portalRowsToCsv", () => {
  it("escaped Formeln und Anführungszeichen", () => {
    const { columns, rows: projected } = projectRows(rows, ["name"], fields);
    const csv = portalRowsToCsv(columns, projected);
    expect(csv).toContain('"\'=SUM(A1)"');
    expect(csv.startsWith('﻿"Name"')).toBe(true);
  });
});

describe("portalRowsToXlsx", () => {
  it("erzeugt eine lesbare Arbeitsmappe mit Kopfzeile und Textschutz", async () => {
    const { portalRowsToXlsx } = await import("../xlsx");
    const ExcelJS = (await import("exceljs")).default;
    const { columns, rows: projected } = projectRows(rows, ["name", "age"], fields);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await portalRowsToXlsx(columns, projected));
    const sheet = workbook.getWorksheet("Auswertung");
    expect(sheet?.getRow(1).getCell(1).value).toBe("Name");
    expect(sheet?.getRow(2).getCell(2).value).toBe(14);
    expect(sheet?.getRow(5).getCell(1).value).toBe("'=SUM(A1)");
  });
});
