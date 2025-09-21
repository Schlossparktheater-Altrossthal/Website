export const ROLES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
  "admin",
  "owner",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  member: "Mitglied",
  cast: "Ensemble",
  tech: "Technik",
  board: "Vorstand",
  finance: "Finanzen",
  owner: "Owner",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  member: "Grundzugriff auf das Mitgliederportal und persönliche Bereiche.",
  cast: "Schauspiel-spezifische Proben, Rollen und Szenenübersichten.",
  tech: "Technik- und Gewerkeaufgaben inklusive Checklisten verwalten.",
  board: "Organisation und Produktionsleitung mit erweiterten Dashboards.",
  finance: "Finanz- und Budgetmodule inklusive Abrechnungen einsehen.",
  owner: "Systemweite Superuser-Rechte inklusive Rollenverwaltung.",
  admin: "Administrativer Vollzugriff ohne Besitzerrechte.",
};

export const ROLE_BADGE_VARIANTS: Record<Role, string> = {
  member: "border border-border/60 bg-muted/50 text-muted-foreground",
  cast: "border border-primary/45 bg-primary/15 text-primary",
  tech: "border border-info/45 bg-info/15 text-info",
  board: "border border-success/45 bg-success/15 text-success",
  finance: "border border-warning/45 bg-warning/15 text-warning",
  owner: "border border-secondary/45 bg-secondary/15 text-secondary",
  admin: "border border-destructive/45 bg-destructive/15 text-destructive",
};

export function sortRoles(roles: Role[]) {
  const order = new Map<Role, number>(ROLES.map((role, index) => [role, index]));
  return [...new Set(roles)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export function describeRoles(roles: Role[]) {
  if (!roles.length) return "Keine Rollen";
  return sortRoles(roles)
    .map((role) => ROLE_LABELS[role] ?? role)
    .join(", ");
}
