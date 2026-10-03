/**
 * Merkmale (Specs) eines Artikeltyps: Definitionen kommen aus Bereich und Kategorienpfad
 * (`InventoryFieldDef`), Werte stehen als JSON in `InventoryProduct.specs`.
 * Ohne Server-Abhängigkeiten – Formulare nutzen dieselbe Prüfung.
 */

export const FIELD_TYPES = ["text", "number", "select", "boolean"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Zahl",
  select: "Auswahl",
  boolean: "Ja/Nein",
};

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit: string | null;
  options: string[];
  placeholder: string | null;
  required: boolean;
};

export type SpecValue = string | number | boolean;
export type Specs = Record<string, SpecValue>;

export type CategoryNode = { id: string; parentId: string | null; name: string };

/** Pfad von der Wurzel bis zur Kategorie (inklusive). */
export function categoryPath<T extends CategoryNode>(
  categories: readonly T[],
  categoryId: string | null | undefined,
): T[] {
  if (!categoryId) return [];
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function categoryPathLabel(
  categories: readonly CategoryNode[],
  categoryId: string | null | undefined,
): string | null {
  const path = categoryPath(categories, categoryId);
  return path.length ? path.map((category) => category.name).join(" › ") : null;
}

/**
 * Wirksame Merkmale: zuerst die des Bereichs, dann entlang des Kategorienpfads. Ein Schlüssel,
 * den eine Unterkategorie erneut definiert, ersetzt den geerbten.
 */
export function effectiveFields(
  areaFields: readonly FieldDef[],
  pathFields: readonly (readonly FieldDef[])[],
): FieldDef[] {
  const byKey = new Map<string, FieldDef>();
  for (const field of areaFields) byKey.set(field.key, field);
  for (const level of pathFields) {
    for (const field of level) byKey.set(field.key, field);
  }
  return [...byKey.values()];
}

/** Wirksame Merkmale aus einem geladenen Katalog (auch im Browser nutzbar). */
export function catalogFields(
  area:
    | {
        fields: readonly FieldDef[];
        categories: readonly (CategoryNode & { fields: FieldDef[] })[];
      }
    | undefined,
  categoryId: string | null,
): FieldDef[] {
  if (!area) return [];
  const path = categoryPath(area.categories, categoryId);
  return effectiveFields(
    area.fields,
    path.map((category) => category.fields),
  );
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/**
 * Prüft und normalisiert Merkmalswerte. Unbekannte Schlüssel werden verworfen, leere Werte
 * weggelassen. Wirft bei Pflichtfeldern ohne Wert oder ungültigen Werten.
 */
export function parseSpecs(fields: readonly FieldDef[], raw: unknown): Specs {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const result: Specs = {};
  for (const field of fields) {
    const value = input[field.key];
    const text = typeof value === "string" ? value.trim() : value;
    if (text === undefined || text === null || text === "") {
      if (field.required && field.type !== "boolean") {
        throw new Error(`Bitte „${field.label}“ angeben.`);
      }
      continue;
    }
    switch (field.type) {
      case "number": {
        const number = typeof text === "number" ? text : parseNumber(String(text));
        if (number === null) throw new Error(`„${field.label}“ muss eine Zahl sein.`);
        result[field.key] = number;
        break;
      }
      case "boolean": {
        const flag = text === true || text === "true" || text === "ja" || text === "1";
        if (flag) result[field.key] = true;
        break;
      }
      case "select": {
        const option = String(text);
        if (field.options.length && !field.options.includes(option)) {
          throw new Error(`„${option}“ ist für „${field.label}“ nicht vorgesehen.`);
        }
        result[field.key] = option;
        break;
      }
      default: {
        const string = String(text).slice(0, 200);
        result[field.key] = string;
      }
    }
  }
  return result;
}

/** Liest gespeicherte Specs tolerant (z. B. für Anzeigen). */
export function readSpecs(value: unknown): Specs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Specs = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" ? entry.trim() : typeof entry === "number" || entry === true) {
      result[key] = entry as SpecValue;
    }
  }
  return result;
}

export function formatSpecValue(field: Pick<FieldDef, "type" | "unit">, value: SpecValue): string {
  if (field.type === "boolean") return value ? "Ja" : "Nein";
  const text =
    typeof value === "number" ? new Intl.NumberFormat("de-DE").format(value) : String(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

/** Merkmale als Liste für Anzeigen; unbekannte Schlüssel erscheinen mit ihrem Schlüssel. */
export function describeSpecs(
  fields: readonly FieldDef[],
  specs: Specs,
): { key: string; label: string; value: string }[] {
  const known = new Set(fields.map((field) => field.key));
  const rows = fields
    .filter((field) => specs[field.key] !== undefined)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatSpecValue(field, specs[field.key]!),
    }));
  for (const [key, value] of Object.entries(specs)) {
    if (!known.has(key)) rows.push({ key, label: key, value: String(value) });
  }
  return rows;
}
