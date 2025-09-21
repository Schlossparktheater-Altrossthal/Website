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
  open: "border-warning/45 bg-warning/15 text-warning",
  in_progress: "border-info/45 bg-info/15 text-info",
  resolved: "border-success/45 bg-success/15 text-success",
  closed: "border-muted/50 bg-muted/40 text-muted-foreground",
};

export const ISSUE_CATEGORY_BADGE_CLASSES: Record<IssueCategory, string> = {
  general: "border-muted/50 bg-muted/35 text-muted-foreground",
  website_bug: "border-destructive/45 bg-destructive/15 text-destructive",
  improvement: "border-success/45 bg-success/15 text-success",
  support: "border-primary/45 bg-primary/15 text-primary",
  other: "border-secondary/45 bg-secondary/15 text-secondary",
};

export const ISSUE_PRIORITY_BADGE_CLASSES: Record<IssuePriority, string> = {
  low: "border-muted/50 bg-muted/35 text-muted-foreground",
  medium: "border-info/45 bg-info/15 text-info",
  high: "border-warning/45 bg-warning/15 text-warning",
  urgent: "border-destructive/50 bg-destructive/15 text-destructive",
};

export const ISSUE_VISIBILITY_BADGE_CLASSES: Record<IssueVisibility, string> = {
  public: "border-success/45 bg-success/15 text-success",
  private: "border-destructive/45 bg-destructive/15 text-destructive",
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
