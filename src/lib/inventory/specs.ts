/**
 * Merkmale (Specs) eines Artikeltyps: Definitionen kommen aus Bereich und Kategorienpfad
 * (`InventoryFieldDef`), Werte stehen als JSON in `InventoryProduct.specs`.
 * Ohne Server-Abhängigkeiten – Formulare nutzen dieselbe Prüfung.
 */

export const FIELD_TYPES = [
  "text",
  "number",
  "measure",
  "dimensions",
  "select",
  "multiselect",
  "boolean",
  "date",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Zahl",
  measure: "Messwert mit Einheit",
  dimensions: "Maße (L × B × H)",
  select: "Auswahl",
  multiselect: "Mehrfachauswahl",
  boolean: "Ja/Nein",
  date: "Datum",
};

/** Kategorien dürfen höchstens so viele Ebenen tief sein. */
export const MAX_CATEGORY_DEPTH = 5;

/** Merkmaltypen mit festen Auswahlwerten. */
export function hasOptions(type: FieldType): boolean {
  return type === "select" || type === "multiselect";
}

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit: string | null;
  options: string[];
  placeholder: string | null;
  required: boolean;
};

/**
 * Maße in mm. `min`/`mid`/`max` sind dieselben Werte aufsteigend sortiert – damit lässt sich
 * „passt in A × B × C“ (Drehen erlaubt) direkt in der Datenbank filtern. Ohne Höhe ist `h` null
 * und zählt beim Sortieren als 0.
 */
export type DimensionsValue = {
  l: number;
  w: number;
  h: number | null;
  min: number;
  mid: number;
  max: number;
};

export type SpecValue = string | number | boolean | string[] | DimensionsValue;
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

/** Abweichung eines geerbten Merkmals ab einer Kategorie (gilt auch darunter). */
export type FieldOverride = { key: string; hidden: boolean; required: boolean | null };

export type FieldLevel = {
  fields: readonly FieldDef[];
  overrides?: readonly FieldOverride[];
};

/**
 * Wirksame Merkmale: zuerst die des Bereichs, dann entlang des Kategorienpfads. Ein Schlüssel,
 * den eine Unterkategorie erneut definiert, ersetzt den geerbten. Ausnahmen einer Kategorie
 * blenden geerbte Merkmale aus oder ändern „Pflicht“ – für sie und alle Unterkategorien; eine
 * tiefere Ausnahme mit `hidden: false` blendet wieder ein.
 */
export function effectiveFields(
  areaFields: readonly FieldDef[],
  levels: readonly FieldLevel[],
): FieldDef[] {
  const byKey = new Map<string, FieldDef>();
  const hidden = new Set<string>();
  for (const field of areaFields) byKey.set(field.key, field);
  for (const level of levels) {
    for (const field of level.fields) {
      byKey.set(field.key, field);
      hidden.delete(field.key);
    }
    for (const override of level.overrides ?? []) {
      if (override.hidden) hidden.add(override.key);
      else hidden.delete(override.key);
      const field = byKey.get(override.key);
      if (field && override.required !== null) {
        byKey.set(override.key, { ...field, required: override.required });
      }
    }
  }
  return [...byKey.values()].filter((field) => !hidden.has(field.key));
}

/**
 * Geerbte Merkmale einer Kategorie für die Katalogpflege: alles, was aus Bereich und
 * Oberkategorien ankommt, mit Herkunft und der hier gesetzten Ausnahme.
 */
export function inheritedFields(
  area: { name: string; fields: readonly FieldDef[] },
  path: readonly (CategoryNode & FieldLevel)[],
): { field: FieldDef; origin: string; override: FieldOverride | null; hiddenAbove: boolean }[] {
  const self = path[path.length - 1];
  if (!self) return [];
  const parents = path.slice(0, -1);
  const origins = new Map<string, string>();
  for (const field of area.fields) origins.set(field.key, area.name);
  for (const level of parents) for (const field of level.fields) origins.set(field.key, level.name);
  const visibleAbove = new Set(effectiveFields(area.fields, parents).map((field) => field.key));
  const all = new Map<string, FieldDef>();
  for (const field of area.fields) all.set(field.key, field);
  for (const level of parents) for (const field of level.fields) all.set(field.key, field);
  const ownKeys = new Set(self.fields.map((field) => field.key));
  return [...all.values()]
    .filter((field) => !ownKeys.has(field.key))
    .map((field) => ({
      field,
      origin: origins.get(field.key) ?? area.name,
      override: self.overrides?.find((entry) => entry.key === field.key) ?? null,
      hiddenAbove: !visibleAbove.has(field.key),
    }));
}

/** Wirksame Merkmale aus einem geladenen Katalog (auch im Browser nutzbar). */
/** Schlüssel aus einer Bezeichnung: „Leistung an 4 Ω“ → „leistungAn4“. */
export function fieldKeyFromLabel(label: string): string {
  const words = label
    .normalize("NFKD")
    .replace(/ß/g, "ss")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const key = words
    .map((word, index) => (index ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join("")
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : `f${key}`;
}

export function catalogFields(
  area:
    | {
        fields: readonly FieldDef[];
        categories: readonly (CategoryNode & FieldLevel)[];
      }
    | undefined,
  categoryId: string | null,
): FieldDef[] {
  if (!area) return [];
  const path = categoryPath(area.categories, categoryId);
  return effectiveFields(area.fields, path);
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/** Einheitenfamilien für Messwerte; der Faktor rechnet in die Basiseinheit (erste) um. */
const UNIT_FAMILIES: Record<string, Record<string, number>> = {
  length: { mm: 1, cm: 10, m: 1000 },
  weight: { g: 1, kg: 1000, t: 1_000_000 },
  power: { w: 1, kw: 1000 },
  volume: { ml: 1, l: 1000 },
};

const LENGTH_UNITS = UNIT_FAMILIES.length!;

/** Einheiten, aus denen beim Anlegen eines Messwerts gewählt wird. */
export const MEASURE_UNITS = ["mm", "cm", "m", "g", "kg", "t", "W", "kW", "ml", "l"] as const;
export const DIMENSION_UNITS = ["mm", "cm", "m"] as const;

function unitInfo(unit: string | null | undefined) {
  const key = (unit ?? "").trim().toLowerCase();
  for (const [family, units] of Object.entries(UNIT_FAMILIES)) {
    if (units[key] !== undefined) return { family, factor: units[key]! };
  }
  return null;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
}

/**
 * Messwert lesen: „500 g“, „0,5“ (in der Merkmal-Einheit), „1,2 kg“. Ergebnis in der
 * Basiseinheit der Familie (mm, g, W, ml); ohne bekannte Einheit unverändert.
 */
export function parseMeasure(text: string, unit: string | null): number | null {
  const match = text
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .match(/^(-?\d+(?:\.\d+)?)([a-zA-Zµ]+)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const target = unitInfo(unit);
  if (!match[2]) return round(value * (target?.factor ?? 1));
  const given = unitInfo(match[2]);
  if (!target) {
    return match[2].toLowerCase() === (unit ?? "").toLowerCase() ? value : null;
  }
  if (!given || given.family !== target.family) return null;
  return round(value * given.factor);
}

/** Basiswert in der Merkmal-Einheit, ohne Einheit („0,5“). */
export function measureInUnit(base: number, unit: string | null): number {
  return round(base / (unitInfo(unit)?.factor ?? 1));
}

export function formatMeasure(base: number, unit: string | null): string {
  const text = formatNumber(measureInUnit(base, unit));
  return unit ? `${text} ${unit}` : text;
}

/**
 * Maße aus einem Feld lesen: „120x80x40“, „120 × 80 × 40 cm“, „1,2m x 80 x 40“, „120*80“.
 * Teile ohne Einheit bekommen die Einheit des letzten Teils, sonst die des Merkmals.
 */
export function parseDimensions(text: string, unit: string | null): DimensionsValue | null {
  const parts = text.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "").split(/[x×*]/);
  if (parts.length < 2 || parts.length > 3) return null;
  const parsed = parts.map((part) => part.match(/^(\d+(?:\.\d+)?)(mm|cm|m)?$/));
  if (parsed.some((match) => !match || Number(match[1]) <= 0)) return null;
  const fallback = parsed[parsed.length - 1]![2] ?? unit ?? "cm";
  const factor = (value: string | undefined) => LENGTH_UNITS[value ?? fallback] ?? 10;
  const [l, w, h = null] = parsed.map((match) => round(Number(match![1]) * factor(match![2])));
  return dimensionsValue(l!, w!, h);
}

export function dimensionsValue(l: number, w: number, h: number | null): DimensionsValue {
  const [min, mid, max] = [l, w, h ?? 0].sort((a, b) => a - b) as [number, number, number];
  return { l, w, h, min, mid, max };
}

/** Längeneinheit für Maße (Standard cm). */
export function dimensionUnit(unit: string | null): string {
  return unit && LENGTH_UNITS[unit] ? unit : "cm";
}

/** Länge in mm als Zahl in der Maß-Einheit, ohne Einheit („1,2“). */
export function formatLength(mm: number, unit: string | null): string {
  return formatNumber(round(mm / LENGTH_UNITS[dimensionUnit(unit)]!));
}

export function formatDimensions(value: DimensionsValue, unit: string | null): string {
  const parts = [value.l, value.w, value.h]
    .filter((part): part is number => part !== null)
    .map((part) => formatLength(part, unit));
  return `${parts.join(" × ")} ${dimensionUnit(unit)}`;
}

function isDimensions(value: unknown): value is DimensionsValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.l === "number" &&
    typeof entry.w === "number" &&
    (entry.h === null || typeof entry.h === "number")
  );
}

function parseDate(text: string): string | null {
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const [year, month, day] = iso
    ? [iso[1], iso[2], iso[3]]
    : german
      ? [german[3], german[2]!.padStart(2, "0"), german[1]!.padStart(2, "0")]
      : [];
  if (!year) return null;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day)
    ? null
    : `${year}-${month}-${day}`;
}

function splitList(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map(String) : String(value).split(/[;\n]/);
  return [...new Set(list.map((entry) => entry.trim()).filter(Boolean))];
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
    const empty = Array.isArray(text) ? text.length === 0 : text === "";
    if (text === undefined || text === null || empty) {
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
      case "measure": {
        const number =
          typeof text === "number"
            ? round(text * (unitInfo(field.unit)?.factor ?? 1))
            : parseMeasure(String(text), field.unit);
        if (number === null) {
          throw new Error(
            `„${field.label}“ bitte als Zahl${field.unit ? ` in ${field.unit} oder mit passender Einheit` : ""} angeben.`,
          );
        }
        result[field.key] = number;
        break;
      }
      case "dimensions": {
        const dims = isDimensions(text)
          ? dimensionsValue(text.l, text.w, text.h)
          : parseDimensions(String(text), field.unit);
        if (!dims) {
          throw new Error(`„${field.label}“ bitte als L × B × H angeben, z. B. 120x80x40.`);
        }
        result[field.key] = dims;
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
      case "multiselect": {
        const list = splitList(text);
        const unknown = list.find(
          (entry) => field.options.length && !field.options.includes(entry),
        );
        if (unknown) throw new Error(`„${unknown}“ ist für „${field.label}“ nicht vorgesehen.`);
        if (list.length) result[field.key] = list;
        break;
      }
      case "date": {
        const date = parseDate(String(text));
        if (!date) throw new Error(`„${field.label}“ ist kein gültiges Datum.`);
        result[field.key] = date;
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
    } else if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      if (entry.length) result[key] = entry as string[];
    } else if (isDimensions(entry)) {
      result[key] = dimensionsValue(entry.l, entry.w, entry.h);
    }
  }
  return result;
}

export function formatSpecValue(field: Pick<FieldDef, "type" | "unit">, value: SpecValue): string {
  if (field.type === "boolean") return value ? "Ja" : "Nein";
  if (isDimensions(value)) return formatDimensions(value, field.unit);
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "measure" && typeof value === "number")
    return formatMeasure(value, field.unit);
  if (field.type === "date" && typeof value === "string") {
    const date = parseDate(value);
    return date ? date.split("-").reverse().join(".") : value;
  }
  const text = typeof value === "number" ? formatNumber(value) : String(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

/** Gespeicherter Wert als Formulareingabe (Text bzw. Schalter). */
export function specToInput(
  field: Pick<FieldDef, "type" | "unit">,
  value: SpecValue,
): string | boolean {
  if (typeof value === "boolean") return value;
  if (isDimensions(value)) return formatDimensions(value, field.unit);
  if (Array.isArray(value)) return value.join("; ");
  if (field.type === "measure" && typeof value === "number") {
    return formatNumber(measureInUnit(value, field.unit)).replace(/\./g, "");
  }
  return String(value);
}

/**
 * Merkmale als Liste für Anzeigen. Werte ohne (noch) gültige Definition – Merkmal gelöscht oder
 * Kategorie gewechselt – bleiben gespeichert, werden aber nicht angezeigt.
 */
export function describeSpecs(
  fields: readonly FieldDef[],
  specs: Specs,
): { key: string; label: string; value: string }[] {
  return fields
    .filter((field) => specs[field.key] !== undefined)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatSpecValue(field, specs[field.key]!),
    }));
}
