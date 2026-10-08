// Exportiert die Stammdaten für die Demo-Umgebung (docs/demo.md) aus einer bestehenden
// Datenbank (z. B. Staging per port-forward) nach scripts/demo/data/stammdaten.json.gz.
//
//   SOURCE_DATABASE_URL=… node scripts/demo/export-stammdaten.mjs
//
// Nur Tabellen ohne Personenbezug: Rechte/Rollen, Gewerk-Blaupausen, Themes, Sperrlisten-
// Einstellungen, Lager-Struktur (ohne Artikel) und Lebensmittel-Stammdaten
// (Open Food Facts, ODbL; BLS 4.0, CC BY 4.0). Verweise auf Personen werden geleert.

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import pg from "pg";

// Reihenfolge = Import-Reihenfolge (Fremdschlüssel).
const TABLES = [
  { name: "Permission" },
  { name: "AppRole" },
  { name: "AppRolePermission" },
  { name: "DepartmentTemplate" },
  { name: "TemplatePermission" },
  { name: "WebsiteTheme" },
  { name: "WebsiteSettings" },
  { name: "SperrlisteSettings" },
  { name: "InventoryArea", set: { nextNumber: 1 } },
  { name: "InventoryCategory", orderBy: '"parentId" NULLS FIRST' },
  { name: "InventoryFieldDef" },
  { name: "InventoryCategoryFieldOverride" },
  { name: "FoodTaxon" },
  { name: "FoodTaxonAlias", nullify: ["createdById"] },
  { name: "FoodItem", nullify: ["createdById"] },
  { name: "FoodNutrient" },
  { name: "FoodDataImport" },
];

const url = process.env.SOURCE_DATABASE_URL;
if (!url) throw new Error("SOURCE_DATABASE_URL fehlt.");

const client = new pg.Client({ connectionString: url });
await client.connect();
// bytea/json als Text lassen, damit der Import sie 1:1 wieder einlesen kann.
const data = {};
for (const table of TABLES) {
  const order = table.orderBy ? ` ORDER BY ${table.orderBy}` : "";
  const { rows } = await client.query(`SELECT to_jsonb(t) AS row FROM "${table.name}" t${order}`);
  data[table.name] = rows.map(({ row }) => {
    for (const column of table.nullify ?? []) row[column] = null;
    return { ...row, ...(table.set ?? {}) };
  });
  console.log(`${table.name}: ${rows.length}`);
}
await client.end();

const target = new URL("./data/stammdaten.json.gz", import.meta.url);
writeFileSync(
  target,
  gzipSync(JSON.stringify({ exportedAt: new Date().toISOString(), tables: data }), { level: 9 }),
);
console.log(`Geschrieben: ${target.pathname}`);
