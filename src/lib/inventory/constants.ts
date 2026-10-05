/**
 * Lager & Inventar – Bezeichnungen und Code-Helfer ohne Server-Abhängigkeiten
 * (docs/Plan/inventar-plan.md). Werte spiegeln die Prisma-Enums.
 */

import { isPublicId } from "@/lib/inventory/public-id";

export const INVENTORY_BASE_PATH = "/mitglieder/lager";
/** Öffentliche Kurz-URL im QR-Code: `/i/<publicId>`. */
export const INVENTORY_PUBLIC_PATH = "/i";

/** Arten von Exemplaren (haben Codes und Orte). */
export const ASSET_KINDS = ["unique", "bulk", "container"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Arten von Artikeltypen: wie Exemplare, dazu Sets ohne eigene Exemplare. */
export const PRODUCT_KINDS = [...ASSET_KINDS, "set"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const ASSET_KIND_LABELS: Record<ProductKind, string> = {
  unique: "Einzelstück",
  bulk: "Mengenartikel",
  container: "Kiste / Case",
  set: "Set",
};

export const ASSET_KIND_HINTS: Record<ProductKind, string> = {
  unique: "Eigenes Label, eigener Ort und Zustand",
  bulk: "Stückzahl je Lagerplatz, z. B. Kabel",
  container: "Nimmt andere Objekte auf",
  set: "Besteht aus anderen Artikeln, z. B. Funkstrecke = Sender + Empfänger",
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

/**
 * Lesbarer Code ohne führende Nullen: `T-42-3` (Bereich-Typ-Exemplar), Mengenartikel `T-42`,
 * Lagerorte `L-7`.
 */
export function formatInventoryCode(prefix: string, number: number, unit?: number | null): string {
  return unit ? `${prefix}-${number}-${unit}` : `${prefix}-${number}`;
}

const CODE_PATTERN = /^([A-Z]{1,3})-?0*(\d{1,6})(?:[-.]0*(\d{1,5}))?$/;

/**
 * Liest einen Code aus einem Scan oder einer Eingabe: akzeptiert die QR-URL (`…/i/T-42-3`), den
 * reinen Code und Varianten mit führenden Nullen, Kleinschreibung oder ohne ersten Strich
 * („t042-03“, „T42.3“).
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
  const number = Number(match[2]);
  const unit = match[3] === undefined ? null : Number(match[3]);
  if (!number || unit === 0) return null;
  return formatInventoryCode(match[1]!, number, unit);
}

/**
 * Liest einen Scan: QR-URL mit zufälliger Kennung (`…/i/<publicId>`) oder eine nackte
 * Kennung ergibt die `publicId`, sonst der normalisierte lesbare Code. Der Server löst beides mit
 * `resolveScanToken` auf. Kennungen (Base58) enthalten keinen Bindestrich, Codes immer – sie überschneiden sich nicht.
 */
export function parseScanToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/i\/([^/?#\s]+)/i);
  const candidate = urlMatch?.[1] ? decodeURIComponent(urlMatch[1]) : trimmed;
  if (isPublicId(candidate)) return candidate;
  return parseInventoryCode(candidate);
}

export function isLocationCode(code: string): boolean {
  return code.startsWith(`${LOCATION_CODE_PREFIX}-`);
}

/** Ziel des QR-Codes – immer über die zufällige `publicId`, nie über den lesbaren Code. */
export function inventoryPublicUrl(origin: string, publicId: string): string {
  return `${origin.replace(/\/$/, "")}${INVENTORY_PUBLIC_PATH}/${encodeURIComponent(publicId)}`;
}

export function inventoryAssetPath(code: string): string {
  return `${INVENTORY_BASE_PATH}/objekt/${encodeURIComponent(code)}`;
}

export function inventoryProductPath(publicId: string): string {
  return `${INVENTORY_BASE_PATH}/typ/${encodeURIComponent(publicId)}`;
}

export function inventoryLocationPath(code: string): string {
  return `${INVENTORY_BASE_PATH}/orte/${encodeURIComponent(code)}`;
}

/** Bestand als Liste oder Tabelle (Desktop); Cookie merkt die Wahl. */
export const INVENTORY_VIEW_COOKIE = "lager_darstellung";
export type InventoryDisplay = "liste" | "tabelle";
export const INVENTORY_TABLE_PAGE_SIZE = 100;

/** Höchstzahl Zeilen je Sammelerfassung-Aufruf. */
export const MAX_BULK_ROWS = 200;

/** Höchstzahl Exemplare, die eine Erfassung auf einmal anlegt. */
export const MAX_EXEMPLARS_PER_CAPTURE = 200;

/** Anzeigename eines Exemplars: Typname plus optionaler Zusatz („Kiste 3“). */
export function assetDisplayName(asset: {
  label?: string | null;
  product: { name: string };
}): string {
  return asset.label ? `${asset.product.name} · ${asset.label}` : asset.product.name;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatInventoryDate(value: Date | string | null | undefined): string {
  if (!value) return "–";
  return DATE_FORMAT.format(new Date(value));
}

export function formatInventoryDateTime(value: Date | string | null | undefined): string {
  if (!value) return "–";
  return DATE_TIME_FORMAT.format(new Date(value));
}

/** `YYYY-MM-DD` für `<input type="date">`. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(date);
}

/** Frist überschritten? Außerhalb von Komponenten, damit das Rendern rein bleibt. */
export function isOverdue(
  dueAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(dueAt) && new Date(dueAt!).getTime() < now.getTime();
}
