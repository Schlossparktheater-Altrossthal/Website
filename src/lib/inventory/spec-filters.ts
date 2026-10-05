/**
 * Merkmal-Filter der Bestandsübersicht (docs/Plan/lager-kategorien-plan.md, Phase 5) – ohne
 * Server-Abhängigkeiten. In der URL stehen sie lesbar in der Einheit des Merkmals:
 *
 *   m.gewicht=~10         höchstens 10 (kg)      m.leistung=500~   mindestens 500 (W)
 *   m.farbe=rot           Auswahl/Text/Mehrfach  m.dmx=ja          Ja/Nein
 *   passt=120x80x40       Maße passen hinein (Drehen erlaubt)
 *   tag=Barock,rot        alle Tags
 */

import {
  catalogFields,
  dimensionsValue,
  parseDimensions,
  parseMeasure,
  type CategoryNode,
  type FieldDef,
  type FieldLevel,
} from "@/lib/inventory/specs";

export const SPEC_PARAM_PREFIX = "m.";
export const FITS_PARAM = "passt";
export const TAG_PARAM = "tag";

export type SpecCondition =
  | { key: string; op: "gte" | "lte"; value: number }
  | { key: string; op: "equals"; value: string | boolean }
  | { key: string; op: "contains"; value: string }
  | { key: string; op: "has"; value: string };

/** Größte zulässige Maße (mm, aufsteigend) für „passt in“. */
export type FitsFilter = { min: number; mid: number; max: number };

/** Merkmale, nach denen sich filtern lässt (Maße laufen über „passt in“). */
export function filterableFields(fields: readonly FieldDef[]): FieldDef[] {
  return fields.filter((field) => field.type !== "dimensions" && field.type !== "date");
}

type CatalogScopeArea = {
  id: string;
  fields: readonly FieldDef[];
  categories: readonly (CategoryNode & FieldLevel)[];
};

/**
 * Merkmale, nach denen im gewählten Ausschnitt gefiltert werden kann: die wirksamen der
 * Kategorie, sonst alle des Bereichs (samt Kategorien), ohne Bereich keine.
 */
export function scopeFilterFields(
  catalog: readonly CatalogScopeArea[],
  areaId: string | null | undefined,
  categoryId: string | null | undefined,
): FieldDef[] {
  const area = catalog.find((entry) => entry.id === areaId);
  if (!area) return [];
  if (categoryId && area.categories.some((category) => category.id === categoryId)) {
    return filterableFields(catalogFields(area, categoryId));
  }
  const all = [...area.fields, ...area.categories.flatMap((category) => category.fields)];
  return filterableFields([...new Map(all.map((field) => [field.key, field])).values()]);
}

function parseBound(field: FieldDef, text: string): number | null {
  if (!text.trim()) return null;
  if (field.type === "measure") return parseMeasure(text, field.unit);
  const number = Number(text.trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** Liest Merkmal-Filter aus den URL-Parametern; Unbekanntes wird ignoriert. */
export function parseSpecFilters(
  fields: readonly FieldDef[],
  params: Record<string, string | undefined>,
): SpecCondition[] {
  const conditions: SpecCondition[] = [];
  for (const field of filterableFields(fields)) {
    const raw = params[`${SPEC_PARAM_PREFIX}${field.key}`]?.trim();
    if (!raw) continue;
    switch (field.type) {
      case "number":
      case "measure": {
        const [from = "", to = ""] = raw.includes("~") ? raw.split("~") : [raw, raw];
        const min = parseBound(field, from);
        const max = parseBound(field, to);
        if (min !== null) conditions.push({ key: field.key, op: "gte", value: min });
        if (max !== null) conditions.push({ key: field.key, op: "lte", value: max });
        break;
      }
      case "boolean":
        if (raw === "ja") conditions.push({ key: field.key, op: "equals", value: true });
        break;
      case "select":
        conditions.push({ key: field.key, op: "equals", value: raw });
        break;
      case "multiselect":
        conditions.push({ key: field.key, op: "has", value: raw });
        break;
      default:
        conditions.push({ key: field.key, op: "contains", value: raw });
    }
  }
  return conditions;
}

export function parseFitsFilter(raw: string | undefined): FitsFilter | null {
  if (!raw?.trim()) return null;
  const dims = parseDimensions(raw, "cm");
  if (!dims) return null;
  // Ohne Höhe: flache Fläche – die Höhe ist dann nicht begrenzt.
  const value = dims.h === null ? dimensionsValue(dims.l, dims.w, Number.MAX_SAFE_INTEGER) : dims;
  return { min: value.min, mid: value.mid, max: value.max };
}

export function parseTagFilter(raw: string | undefined): string[] {
  return [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);
}
