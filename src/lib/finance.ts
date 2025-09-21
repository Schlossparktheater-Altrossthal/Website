import type {
  FinanceEntryKind,
  FinanceEntryStatus,
  FinanceType,
  VisibilityScope,
} from "@prisma/client";

export const FINANCE_ENTRY_STATUS_VALUES: FinanceEntryStatus[] = [
  "draft",
  "pending",
  "approved",
  "paid",
  "cancelled",
];

export const FINANCE_ENTRY_STATUS_LABELS: Record<FinanceEntryStatus, string> = {
  draft: "Entwurf",
  pending: "Wartet auf Freigabe",
  approved: "Freigegeben",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

export const FINANCE_ENTRY_STATUS_TONES: Record<FinanceEntryStatus, "default" | "info" | "warning" | "success" | "destructive"> = {
  draft: "default",
  pending: "warning",
  approved: "success",
  paid: "info",
  cancelled: "destructive",
};

export const FINANCE_ENTRY_KIND_VALUES: FinanceEntryKind[] = ["general", "invoice", "donation"];

export const FINANCE_ENTRY_KIND_LABELS: Record<FinanceEntryKind, string> = {
  general: "Allgemein",
  invoice: "Rechnung / Auslage",
  donation: "Spende",
};

export const FINANCE_ENTRY_KIND_DESCRIPTIONS: Record<FinanceEntryKind, string> = {
  general: "Sonstige Finanzbuchungen oder interne Umbuchungen.",
  invoice: "Rechnungen, Auslagen oder Erstattungen von Mitgliedern.",
  donation: "Spenden- und Förderungseingänge inklusive Kontaktangaben.",
};

export const FINANCE_TYPE_LABELS: Record<FinanceType, string> = {
  income: "Einnahme",
  expense: "Ausgabe",
};

export const FINANCE_VISIBILITY_LABELS: Record<VisibilityScope, string> = {
  board: "Nur Vorstand",
  finance: "Finanzteam",
};

export function isFinanceEntryStatus(value: unknown): value is FinanceEntryStatus {
  return typeof value === "string" && FINANCE_ENTRY_STATUS_VALUES.includes(value as FinanceEntryStatus);
}

export function isFinanceEntryKind(value: unknown): value is FinanceEntryKind {
  return typeof value === "string" && FINANCE_ENTRY_KIND_VALUES.includes(value as FinanceEntryKind);
}

export function isFinanceType(value: unknown): value is FinanceType {
  return value === "income" || value === "expense";
}

export function isVisibilityScope(value: unknown): value is VisibilityScope {
  return value === "board" || value === "finance";
}

export const FINANCE_EXPORT_FILENAME = "mitglieder-finanzen.csv";
