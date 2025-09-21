export const ISSUE_STATUS_VALUES = ["open", "in_progress", "resolved", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];
export const ISSUE_STATUS_ORDER: readonly IssueStatus[] = ISSUE_STATUS_VALUES;

export const ISSUE_CATEGORY_VALUES = [
  "general",
  "website_bug",
  "improvement",
  "support",
  "other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORY_VALUES)[number];

export const ISSUE_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY_VALUES)[number];
export const ISSUE_PRIORITY_ORDER: readonly IssuePriority[] = ISSUE_PRIORITY_VALUES;

export const ISSUE_VISIBILITY_VALUES = ["public", "private"] as const;
export type IssueVisibility = (typeof ISSUE_VISIBILITY_VALUES)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

export const ISSUE_STATUS_DESCRIPTIONS: Record<IssueStatus, string> = {
  open: "Neues Anliegen, das noch nicht bearbeitet wurde.",
  in_progress: "Das Anliegen wird aktuell geprüft oder umgesetzt.",
  resolved: "Das Anliegen wurde gelöst und wartet auf Bestätigung.",
  closed: "Das Anliegen ist abgeschlossen.",
};

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  general: "Allgemeines",
  website_bug: "Website-Bug",
  improvement: "Verbesserung",
  support: "Support",
  other: "Sonstiges",
};

export const ISSUE_CATEGORY_DESCRIPTIONS: Record<IssueCategory, string> = {
  general: "Organisatorische Fragen oder generelles Feedback.",
  website_bug: "Fehler oder Probleme mit der Website.",
  improvement: "Ideen und Verbesserungsvorschläge für Funktionen oder Abläufe.",
  support: "Hilfestellungen oder Unterstützung bei internen Prozessen.",
  other: "Alles, was sich keiner anderen Kategorie zuordnen lässt.",
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: "Niedrig",
  medium: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

export const ISSUE_VISIBILITY_LABELS: Record<IssueVisibility, string> = {
  public: "Öffentlich",
  private: "Privat",
};

export const ISSUE_VISIBILITY_DESCRIPTIONS: Record<IssueVisibility, string> = {
  public: "Das Anliegen ist für alle Mitglieder mit Support-Zugang sichtbar.",
  private: "Nur du und das Support-Team können dieses Anliegen sehen.",
};

export const ISSUE_STATUS_BADGE_CLASSES: Record<IssueStatus, string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200",
};

export const ISSUE_CATEGORY_BADGE_CLASSES: Record<IssueCategory, string> = {
  general: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  website_bug: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  improvement: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  support: "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  other: "border-zinc-500/35 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200",
};

export const ISSUE_PRIORITY_BADGE_CLASSES: Record<IssuePriority, string> = {
  low: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  medium: "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  high: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  urgent: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-200",
};

export const ISSUE_VISIBILITY_BADGE_CLASSES: Record<IssueVisibility, string> = {
  public: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  private: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200",
};

const ISSUE_STATUS_SET = new Set<IssueStatus>(ISSUE_STATUS_VALUES);
const ISSUE_CATEGORY_SET = new Set<IssueCategory>(ISSUE_CATEGORY_VALUES);
const ISSUE_PRIORITY_SET = new Set<IssuePriority>(ISSUE_PRIORITY_VALUES);
const ISSUE_VISIBILITY_SET = new Set<IssueVisibility>(ISSUE_VISIBILITY_VALUES);

export function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === "string" && ISSUE_STATUS_SET.has(value as IssueStatus);
}

export function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === "string" && ISSUE_CATEGORY_SET.has(value as IssueCategory);
}

export function isIssuePriority(value: unknown): value is IssuePriority {
  return typeof value === "string" && ISSUE_PRIORITY_SET.has(value as IssuePriority);
}

export function isIssueVisibility(value: unknown): value is IssueVisibility {
  return typeof value === "string" && ISSUE_VISIBILITY_SET.has(value as IssueVisibility);
}

export const DEFAULT_ISSUE_STATUS: IssueStatus = "open";
export const DEFAULT_ISSUE_PRIORITY: IssuePriority = "medium";
export const DEFAULT_ISSUE_CATEGORY: IssueCategory = "general";
export const DEFAULT_ISSUE_VISIBILITY: IssueVisibility = "public";
