import type {
  ProductionObjectKind,
  ProductionObjectSource,
  ProductionObjectStatus,
  SceneRequirementStatus,
  TaskStatus,
} from "@prisma/client";

import type { DepartmentModuleKey } from "@/lib/departments/modules";

/** Ausstattung (docs/Plan/ausstattung-plan.md): Bezeichnungen und Zuordnungen, auch im Browser nutzbar. */

export const OBJECT_KINDS: ProductionObjectKind[] = [
  "prop",
  "set_piece",
  "costume",
  "costume_part",
  "other",
];

export const OBJECT_KIND_LABELS: Record<ProductionObjectKind, string> = {
  prop: "Requisite",
  set_piece: "Bühnenbild",
  costume: "Kostüm",
  costume_part: "Kostümteil",
  other: "Sonstiges",
};

export const OBJECT_KIND_PLURAL: Record<ProductionObjectKind, string> = {
  prop: "Requisiten",
  set_piece: "Bühnenbild",
  costume: "Kostüme",
  costume_part: "Kostümteile",
  other: "Sonstiges",
};

/** Arten, die man in einer Szene anfordern kann (Teile entstehen erst im Gewerk). */
export const REQUEST_KINDS: ProductionObjectKind[] = ["prop", "costume", "set_piece", "other"];

export const OBJECT_SOURCES: ProductionObjectSource[] = [
  "undecided",
  "stock",
  "build",
  "buy",
  "borrow",
];

export const OBJECT_SOURCE_LABELS: Record<ProductionObjectSource, string> = {
  undecided: "Noch offen",
  stock: "Aus dem Fundus",
  build: "Bauen/Nähen",
  buy: "Kaufen",
  borrow: "Leihen",
};

export const OBJECT_STATUSES: ProductionObjectStatus[] = ["planned", "in_progress", "ready"];

export const OBJECT_STATUS_LABELS: Record<ProductionObjectStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  ready: "Fertig",
};

export const OBJECT_STATUS_TONE: Record<ProductionObjectStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/20 text-warning-foreground",
  ready: "bg-success/15 text-success",
};

export const OBJECT_STATUS_DOT: Record<ProductionObjectStatus, string> = {
  planned: "bg-muted-foreground/60",
  in_progress: "bg-warning",
  ready: "bg-success",
};

export const REQUIREMENT_STATUS_LABELS: Record<SceneRequirementStatus, string> = {
  open: "Offen",
  assigned: "Übernommen",
  declined: "Abgelehnt",
};

/** Objekt-Status und Board-Spalte laufen gemeinsam: eine Karte je Objekt. */
export const TASK_STATUS_FOR_OBJECT: Record<ProductionObjectStatus, TaskStatus> = {
  planned: "todo",
  in_progress: "doing",
  ready: "done",
};

export const OBJECT_STATUS_FOR_TASK: Record<TaskStatus, ProductionObjectStatus> = {
  todo: "planned",
  doing: "in_progress",
  done: "ready",
};

/** Welche Verwaltungsseite (Baustein) eine Art führt. */
export const MODULE_FOR_KIND: Record<ProductionObjectKind, DepartmentModuleKey | null> = {
  prop: "props",
  set_piece: "set",
  costume: "costumes",
  costume_part: "costumes",
  other: null,
};

export const KINDS_FOR_MODULE: Partial<Record<DepartmentModuleKey, ProductionObjectKind[]>> = {
  props: ["prop"],
  set: ["set_piece"],
  costumes: ["costume", "costume_part"],
};

export const OBJECT_TEXT_LIMITS = {
  title: 160,
  description: 5000,
  requirement: 2000,
  note: 1000,
  short: 200,
  sceneNote: 200,
} as const;

/** Cent-Betrag als „12,50 €“. */
export function formatCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** „12,5“ / „12,50 €“ → Cent; leer → null. */
export function parseEuroToCents(value: string): number | null {
  const cleaned = value.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}
