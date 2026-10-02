import type { AssetFormArea } from "@/lib/inventory/asset-form-values";
import {
  AREA_ATTRIBUTE_FIELDS,
  ASSET_KIND_LABELS,
  ASSET_KINDS,
  attributeFieldsFor,
  CONDITION_LABELS,
  CONDITIONS,
  parseInventoryCode,
  type AssetKind,
} from "@/lib/inventory/constants";

/**
 * Sammelerfassung als Tabelle: Spalten, Auflösen getippter/eingefügter Werte und Umwandeln
 * einer Zeile in die Eingabe von `bulkCreateAssetsAction`. Ohne React, damit testbar.
 *
 * Zellen speichern immer Text. Auswahlspalten speichern den Optionswert (z. B. Kategorie-ID);
 * getippter oder eingefügter Text wird erst beim Anzeigen und Speichern aufgelöst – so bleibt
 * ein nicht erkannter Wert sichtbar und lässt sich korrigieren.
 */

export type GridOption = { value: string; label: string; hint?: string; keywords?: string[] };

export type DraftRow = {
  id: string;
  cells: Record<string, string>;
  /** Nach dem Speichern: vergebener Code, die Zeile ist dann schreibgeschützt. */
  savedCode?: string;
  /** Fehler vom Server für diese Zeile. */
  serverError?: string;
};

export type GridColumn = {
  key: string;
  label: string;
  width: number;
  type: "text" | "number" | "select";
  options?: (row: DraftRow) => GridOption[];
  placeholder?: (row: DraftRow) => string;
  /** Zelle für diese Zeile ohne Bedeutung (z. B. Menge bei Einzelstücken). */
  inactive?: (row: DraftRow) => boolean;
  /** Lässt sich in der Spaltenauswahl ausblenden. */
  hideable: boolean;
  /** Standardmäßig sichtbar. */
  defaultVisible: boolean;
};

export type BulkPlacementOptions = {
  locations: { id: string; code: string; path: string }[];
  containers: { id: string; code: string; name: string; path: string | null }[];
};

export type BulkContext = {
  areas: AssetFormArea[];
  placement: BulkPlacementOptions;
  canManage: boolean;
  /** Gemischte Bereiche: Bereich als Spalte statt fest für die ganze Runde. */
  mixed: boolean;
  areaId: string;
};

export const ATTRIBUTE_PREFIX = "attr.";

/** Spalten, die neue Zeilen aus den Vorgaben übernehmen. */
export const PRESET_KEYS = ["area", "category", "kind", "condition", "placement"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];
export type Presets = Partial<Record<PresetKey, string>>;

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Findet die Option zu einer Eingabe: exakter Wert, dann exakter Name/Stichwort, dann ein
 * eindeutiger Treffer am Wortanfang oder im Text. Mehrdeutiges bleibt unaufgelöst.
 */
export function resolveOption(options: GridOption[], raw: string): GridOption | null {
  const value = raw.trim();
  if (!value) return null;
  const byValue = options.find((option) => option.value === value);
  if (byValue) return byValue;
  const needle = normalize(value);
  const texts = (option: GridOption) => [option.label, ...(option.keywords ?? [])].map(normalize);
  const exact = options.filter((option) => texts(option).includes(needle));
  if (exact.length === 1) return exact[0]!;
  const prefix = options.filter((option) => texts(option).some((text) => text.startsWith(needle)));
  if (prefix.length === 1) return prefix[0]!;
  const contains = options.filter((option) => texts(option).some((text) => text.includes(needle)));
  return contains.length === 1 ? contains[0]! : null;
}

/** Filtert Optionen für die Auswahlliste beim Tippen. */
export function filterOptions(options: GridOption[], query: string, limit = 50): GridOption[] {
  const needle = normalize(query);
  if (!needle) return options.slice(0, limit);
  const scored = options
    .map((option) => {
      const texts = [option.label, option.hint ?? "", ...(option.keywords ?? [])].map(normalize);
      const score = texts.some((text) => text === needle)
        ? 0
        : texts.some((text) => text.startsWith(needle))
          ? 1
          : texts.some((text) => text.includes(needle))
            ? 2
            : -1;
      return { option, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((entry) => entry.option);
}

const kindOptions: GridOption[] = ASSET_KINDS.map((kind) => ({
  value: kind,
  label: ASSET_KIND_LABELS[kind],
  keywords:
    kind === "unique"
      ? ["einzel", "einzeln", "stueck"]
      : kind === "bulk"
        ? ["menge", "mengen"]
        : ["kiste", "case"],
}));

const conditionOptions: GridOption[] = CONDITIONS.map((condition) => ({
  value: condition,
  label: CONDITION_LABELS[condition],
}));

const yesNoOptions: GridOption[] = [
  { value: "yes", label: "Ja", keywords: ["x", "1", "true", "j"] },
  { value: "no", label: "Nein", keywords: ["-", "0", "false", "n"] },
];

export function areaOptions(ctx: BulkContext): GridOption[] {
  return ctx.areas.map((area) => ({
    value: area.id,
    label: area.name,
    hint: area.prefix,
    keywords: [area.prefix],
  }));
}

export function placementOptions(ctx: BulkContext): GridOption[] {
  return [
    ...ctx.placement.locations.map((location) => ({
      value: `location:${location.id}`,
      label: `${location.code} · ${location.path}`,
      keywords: [location.code, location.path],
    })),
    ...ctx.placement.containers.map((container) => ({
      value: `container:${container.id}`,
      label: `${container.code} · ${container.name}`,
      hint: container.path ? `Kiste in ${container.path}` : "Kiste",
      keywords: [container.code, container.name],
    })),
  ];
}

export function rowAreaId(row: DraftRow, ctx: BulkContext): string | null {
  if (!ctx.mixed) return ctx.areaId;
  return resolveOption(areaOptions(ctx), row.cells.area ?? "")?.value ?? null;
}

function rowArea(row: DraftRow, ctx: BulkContext) {
  const id = rowAreaId(row, ctx);
  return ctx.areas.find((area) => area.id === id);
}

function categoryOptions(row: DraftRow, ctx: BulkContext): GridOption[] {
  return (rowArea(row, ctx)?.categories ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }));
}

export function rowKind(row: DraftRow): AssetKind {
  return (resolveOption(kindOptions, row.cells.kind ?? "")?.value as AssetKind) ?? "unique";
}

/** Zusatzfelder: im festen Bereich die des Bereichs, gemischt die aller Bereiche. */
function attributeColumns(ctx: BulkContext) {
  if (!ctx.mixed) {
    const area = ctx.areas.find((entry) => entry.id === ctx.areaId);
    return area ? attributeFieldsFor(area.prefix) : [];
  }
  const seen = new Map<string, { key: string; label: string; placeholder?: string }>();
  for (const area of ctx.areas) {
    for (const field of AREA_ATTRIBUTE_FIELDS[area.prefix] ?? []) {
      if (!seen.has(field.key)) seen.set(field.key, field);
    }
  }
  return [...seen.values()];
}

export function bulkColumns(ctx: BulkContext): GridColumn[] {
  const columns: GridColumn[] = [];
  if (ctx.mixed) {
    columns.push({
      key: "area",
      label: "Bereich",
      width: 120,
      type: "select",
      options: () => areaOptions(ctx),
      hideable: false,
      defaultVisible: true,
    });
  }
  columns.push(
    {
      key: "name",
      label: "Name",
      width: 240,
      type: "text",
      hideable: false,
      defaultVisible: true,
    },
    {
      key: "category",
      label: "Kategorie",
      width: 150,
      type: "select",
      options: (row) => categoryOptions(row, ctx),
      placeholder: () => "–",
      hideable: true,
      defaultVisible: true,
    },
    {
      key: "kind",
      label: "Art",
      width: 120,
      type: "select",
      options: () => kindOptions,
      placeholder: () => ASSET_KIND_LABELS.unique,
      hideable: true,
      defaultVisible: true,
    },
    {
      key: "quantity",
      label: "Menge",
      width: 72,
      type: "number",
      inactive: (row) => rowKind(row) !== "bulk",
      placeholder: (row) => (rowKind(row) === "bulk" ? "0" : "1"),
      hideable: true,
      defaultVisible: true,
    },
    {
      key: "unit",
      label: "Einheit",
      width: 72,
      type: "text",
      inactive: (row) => rowKind(row) !== "bulk",
      placeholder: (row) => (rowKind(row) === "bulk" ? "Stk." : ""),
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "condition",
      label: "Zustand",
      width: 110,
      type: "select",
      options: () => conditionOptions,
      placeholder: () => CONDITION_LABELS.good,
      hideable: true,
      defaultVisible: true,
    },
    {
      key: "placement",
      label: "Ort / Kiste",
      width: 220,
      type: "select",
      options: () => placementOptions(ctx),
      placeholder: () => "Noch kein Ort",
      hideable: true,
      defaultVisible: true,
    },
    ...attributeColumns(ctx).map<GridColumn>((field) => ({
      key: `${ATTRIBUTE_PREFIX}${field.key}`,
      label: field.label,
      width: 120,
      type: "text",
      inactive: (row) =>
        !attributeFieldsFor(rowArea(row, ctx)?.prefix ?? "").some(
          (entry) => entry.key === field.key,
        ),
      placeholder: () => field.placeholder ?? "",
      hideable: true,
      defaultVisible: true,
    })),
    {
      key: "manufacturer",
      label: "Hersteller",
      width: 130,
      type: "text",
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "model",
      label: "Modell",
      width: 130,
      type: "text",
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "serialNumber",
      label: "Seriennr.",
      width: 130,
      type: "text",
      inactive: (row) => rowKind(row) === "bulk",
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "inspection",
      label: "Prüfpflicht",
      width: 96,
      type: "select",
      options: () => yesNoOptions,
      inactive: (row) => rowKind(row) === "bulk",
      placeholder: (row) => (rowArea(row, ctx)?.inspectionDefault ? "Ja" : "Nein"),
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "publicNote",
      label: "Öffentl. Hinweis",
      width: 180,
      type: "text",
      hideable: true,
      defaultVisible: false,
    },
    {
      key: "internalNote",
      label: "Notiz",
      width: 180,
      type: "text",
      hideable: true,
      defaultVisible: false,
    },
  );
  if (ctx.canManage) {
    columns.push(
      {
        key: "acquisitionCost",
        label: "Preis €",
        width: 90,
        type: "number",
        hideable: true,
        defaultVisible: false,
      },
      {
        key: "supplier",
        label: "Lieferant",
        width: 130,
        type: "text",
        hideable: true,
        defaultVisible: false,
      },
    );
  }
  return columns;
}

/** Anzeigetext einer Zelle: bei Auswahlspalten der Name der Option. */
export function cellDisplay(
  column: GridColumn,
  row: DraftRow,
): { text: string; unresolved: boolean } {
  const raw = row.cells[column.key] ?? "";
  if (column.type !== "select" || !raw) return { text: raw, unresolved: false };
  const options = column.options?.(row) ?? [];
  const option =
    column.key === "placement" ? resolvePlacement(options, raw) : resolveOption(options, raw);
  return option ? { text: option.label, unresolved: false } : { text: raw, unresolved: true };
}

/** Ort: zuerst als (gescannter) Code lesen, dann wie jede Auswahl. */
function resolvePlacement(options: GridOption[], raw: string): GridOption | null {
  const code = parseInventoryCode(raw);
  if (code) {
    const byCode = options.find((option) => option.keywords?.[0] === code);
    if (byCode) return byCode;
  }
  return resolveOption(options, raw);
}

/** Wert, der beim Übernehmen einer Eingabe gespeichert wird (aufgelöst, sonst der Text). */
export function commitCellValue(column: GridColumn, row: DraftRow, raw: string): string {
  const value = raw.trim();
  if (column.type !== "select" || !value) return value;
  const options = column.options?.(row) ?? [];
  const option =
    column.key === "placement" ? resolvePlacement(options, value) : resolveOption(options, value);
  return option?.value ?? value;
}

export function isBlankRow(row: DraftRow, presets: Presets): boolean {
  if (row.savedCode) return false;
  return Object.entries(row.cells).every(([key, value]) => {
    if (!value.trim()) return true;
    return (presets as Record<string, string | undefined>)[key] === value;
  });
}

export function rowFromPresets(id: string, presets: Presets): DraftRow {
  const cells: Record<string, string> = {};
  for (const key of PRESET_KEYS) {
    if (presets[key]) cells[key] = presets[key]!;
  }
  return { id, cells };
}

/** Kopie für „×n duplizieren“ – ohne Seriennummer, die gibt es nur einmal. */
export function duplicateRow(row: DraftRow, id: string): DraftRow {
  const cells = { ...row.cells };
  delete cells.serialNumber;
  return { id, cells };
}

export type RowValidation = {
  errors: Record<string, string>;
  input: Record<string, unknown> | null;
};

const MAX_TEXT: Record<string, number> = {
  name: 160,
  manufacturer: 120,
  model: 120,
  serialNumber: 120,
  publicNote: 500,
  internalNote: 4000,
  unit: 30,
  supplier: 160,
};

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

/** Prüft eine Zeile wie der Server und baut die Eingabe für `bulkCreateAssetsAction`. */
export function validateRow(row: DraftRow, ctx: BulkContext): RowValidation {
  const errors: Record<string, string> = {};
  const cell = (key: string) => (row.cells[key] ?? "").trim();
  const columns = new Map(bulkColumns(ctx).map((column) => [column.key, column]));

  const area = rowArea(row, ctx);
  if (!area) errors.area = cell("area") ? "Bereich nicht erkannt." : "Bereich fehlt.";
  const name = cell("name");
  if (!name) errors.name = "Name fehlt.";

  for (const [key, max] of Object.entries(MAX_TEXT)) {
    if (cell(key).length > max) errors[key] = `Höchstens ${max} Zeichen.`;
  }

  const resolved = (key: string) => {
    const column = columns.get(key);
    const raw = cell(key);
    if (!column || !raw) return null;
    const display = cellDisplay(column, row);
    if (display.unresolved) {
      errors[key] = `„${raw}“ nicht erkannt.`;
      return null;
    }
    return commitCellValue(column, row, raw);
  };

  const categoryId = area ? resolved("category") : null;
  const kind = (resolved("kind") as AssetKind | null) ?? "unique";
  const condition = resolved("condition") ?? "good";
  const placementValue = resolved("placement");
  const inspection = resolved("inspection");

  let quantity: number | null = null;
  if (kind === "bulk" && cell("quantity")) {
    quantity = parseNumber(cell("quantity"));
    if (quantity === null || !Number.isInteger(quantity) || quantity < 0 || quantity > 100_000) {
      errors.quantity = "Ganze Zahl von 0 bis 100 000.";
    }
  }
  // Bestand hängt an einem Lagerplatz – ohne Ort ginge die Menge verloren.
  if (kind === "bulk" && quantity && !placementValue && !errors.placement) {
    errors.placement = "Für eine Menge bitte Ort oder Kiste angeben.";
  }
  let acquisitionCost: number | null = null;
  if (ctx.canManage && cell("acquisitionCost")) {
    acquisitionCost = parseNumber(cell("acquisitionCost"));
    if (acquisitionCost === null || Number.isNaN(acquisitionCost) || acquisitionCost < 0) {
      errors.acquisitionCost = "Ungültiger Betrag.";
    }
  }

  if (Object.keys(errors).length || !area) return { errors, input: null };

  const attributes: Record<string, string> = {};
  for (const field of attributeFieldsFor(area.prefix)) {
    const value = cell(`${ATTRIBUTE_PREFIX}${field.key}`);
    if (value) attributes[field.key] = value;
  }
  const [placementType, placementId] = placementValue?.split(":") ?? [];
  const inspectionRequired =
    kind === "bulk" ? false : inspection ? inspection === "yes" : area.inspectionDefault;

  return {
    errors,
    input: {
      areaId: area.id,
      categoryId,
      kind,
      name,
      manufacturer: cell("manufacturer") || null,
      model: cell("model") || null,
      serialNumber: kind === "bulk" ? null : cell("serialNumber") || null,
      publicNote: cell("publicNote") || null,
      internalNote: cell("internalNote") || null,
      attributes,
      condition,
      unit: kind === "bulk" ? cell("unit") || "Stk." : null,
      quantity: kind === "bulk" ? quantity : null,
      placement:
        placementType && placementId ? { type: placementType, id: placementId } : { type: "none" },
      inspectionRequired,
      acquisitionCost: ctx.canManage ? acquisitionCost : null,
      supplier: ctx.canManage ? cell("supplier") || null : null,
    },
  };
}
