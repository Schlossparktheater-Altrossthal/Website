/**
 * Lager & Inventar – Bezeichnungen und Code-Helfer ohne Server-Abhängigkeiten
 * (docs/Plan/inventar-plan.md). Werte spiegeln die Prisma-Enums.
 */

export const INVENTORY_BASE_PATH = "/mitglieder/lager";
/** Öffentliche Kurz-URL im QR-Code: `/i/<code>`. */
export const INVENTORY_PUBLIC_PATH = "/i";

export const ASSET_KINDS = ["unique", "bulk", "container"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  unique: "Einzelstück",
  bulk: "Mengenartikel",
  container: "Kiste / Case",
};

export const ASSET_KIND_HINTS: Record<AssetKind, string> = {
  unique: "Eigenes Label, eigener Ort und Zustand",
  bulk: "Stückzahl je Lagerplatz, z. B. Kabel",
  container: "Nimmt andere Objekte auf",
};

export const ASSET_STATUSES = [
  "available",
  "checked_out",
  "repair",
  "locked",
  "missing",
  "retired",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Im Lager",
  checked_out: "Ausgegeben",
  repair: "In Reparatur",
  locked: "Gesperrt",
  missing: "Vermisst",
  retired: "Ausgemustert",
};

export type StatusTone = "success" | "info" | "warning" | "destructive" | "muted";

export const ASSET_STATUS_TONES: Record<AssetStatus, StatusTone> = {
  available: "success",
  checked_out: "info",
  repair: "warning",
  locked: "destructive",
  missing: "destructive",
  retired: "muted",
};

export const CONDITIONS = ["new", "good", "used", "worn", "damaged"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "Neu",
  good: "Gut",
  used: "Gebraucht",
  worn: "Abgenutzt",
  damaged: "Beschädigt",
};

export const DEFECT_SEVERITIES = ["cosmetic", "limited", "locked"] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

export const DEFECT_SEVERITY_LABELS: Record<DefectSeverity, string> = {
  cosmetic: "Kosmetisch",
  limited: "Eingeschränkt nutzbar",
  locked: "Gesperrt – nicht benutzen",
};

export const DEFECT_SEVERITY_TONES: Record<DefectSeverity, StatusTone> = {
  cosmetic: "muted",
  limited: "warning",
  locked: "destructive",
};

export const DEFECT_STATUSES = ["open", "repair", "done"] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  open: "Offen",
  repair: "In Reparatur",
  done: "Erledigt",
};

export const INSPECTION_RESULT_LABELS = {
  passed: "Bestanden",
  failed: "Nicht bestanden",
} as const;
export type InspectionResult = keyof typeof INSPECTION_RESULT_LABELS;

/** Standard-Prüfintervall für ortsveränderliche Betriebsmittel auf der Bühne. */
export const DEFAULT_INSPECTION_INTERVAL_MONTHS = 12;
/** Ab so vielen Tagen vor Fälligkeit gilt eine Prüfung als „bald fällig“. */
export const INSPECTION_SOON_DAYS = 30;

export type InspectionState = "none" | "ok" | "soon" | "overdue" | "failed";

export const INSPECTION_STATE_LABELS: Record<InspectionState, string> = {
  none: "Nicht prüfpflichtig",
  ok: "Geprüft",
  soon: "Prüfung bald fällig",
  overdue: "Prüfung überfällig",
  failed: "Prüfung nicht bestanden",
};

export const INSPECTION_STATE_TONES: Record<InspectionState, StatusTone> = {
  none: "muted",
  ok: "success",
  soon: "warning",
  overdue: "destructive",
  failed: "destructive",
};

export function inspectionState(
  asset: {
    inspectionRequired: boolean;
    nextInspectionAt: Date | string | null;
    lastInspectionFailed?: boolean;
  },
  now: Date = new Date(),
): InspectionState {
  if (!asset.inspectionRequired) return "none";
  if (asset.lastInspectionFailed) return "failed";
  if (!asset.nextInspectionAt) return "overdue";
  const due = new Date(asset.nextInspectionAt).getTime();
  if (due < now.getTime()) return "overdue";
  if (due - now.getTime() <= INSPECTION_SOON_DAYS * 86_400_000) return "soon";
  return "ok";
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Präfix für Lagerort-Labels. Bereiche dürfen dieses Präfix nicht verwenden. */
export const LOCATION_CODE_PREFIX = "L";

export function formatInventoryCode(prefix: string, number: number): string {
  const digits = number < 10_000 ? 4 : String(number).length;
  return `${prefix}-${String(number).padStart(digits, "0")}`;
}

const CODE_PATTERN = /^([A-Z]{1,3})-?(\d{1,7})$/;

/**
 * Liest einen Code aus einem Scan oder einer Eingabe: akzeptiert die QR-URL (`…/i/T-0042`),
 * den reinen Code und Varianten ohne Bindestrich oder führende Nullen („t42“).
 */
export function parseInventoryCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  const urlMatch = trimmed.match(/\/i\/([^/?#\s]+)/i);
  if (urlMatch?.[1]) {
    candidate = decodeURIComponent(urlMatch[1]);
  }
  const match = candidate.toUpperCase().replace(/\s+/g, "").match(CODE_PATTERN);
  if (!match) return null;
  return formatInventoryCode(match[1]!, Number(match[2]));
}

export function isLocationCode(code: string): boolean {
  return code.startsWith(`${LOCATION_CODE_PREFIX}-`);
}

export function inventoryPublicUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}${INVENTORY_PUBLIC_PATH}/${encodeURIComponent(code)}`;
}

export function inventoryAssetPath(code: string): string {
  return `${INVENTORY_BASE_PATH}/objekt/${encodeURIComponent(code)}`;
}

export function inventoryLocationPath(code: string): string {
  return `${INVENTORY_BASE_PATH}/orte/${encodeURIComponent(code)}`;
}

/** Bereichsspezifische Zusatzfelder (gespeichert in `attributes`). */
export type AttributeField = { key: string; label: string; placeholder?: string };

export const AREA_ATTRIBUTE_FIELDS: Record<string, AttributeField[]> = {
  K: [
    { key: "size", label: "Größe", placeholder: "z. B. 38 oder M" },
    { key: "era", label: "Epoche / Stil", placeholder: "z. B. 1920er" },
    { key: "color", label: "Farbe" },
    { key: "material", label: "Material" },
    { key: "gender", label: "Schnitt", placeholder: "Damen, Herren, unisex" },
  ],
  T: [
    { key: "power", label: "Leistung", placeholder: "z. B. 575 W" },
    { key: "connector", label: "Anschluss", placeholder: "z. B. Schuko, CEE 16 A" },
  ],
  W: [{ key: "power", label: "Leistung", placeholder: "z. B. 750 W" }],
};

export function attributeFieldsFor(prefix: string): AttributeField[] {
  return AREA_ATTRIBUTE_FIELDS[prefix] ?? [];
}

export function readAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) result[key] = entry;
  }
  return result;
}
