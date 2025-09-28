export const PRIMARY_ROLES = ["member", "cast", "tech", "board", "admin", "owner"] as const;

export const SUPPLEMENTAL_ROLES = ["finance"] as const;

const ROLE_SORT_ORDER = [
  "member",
  "cast",
  "tech",
  "board",
  "finance",
  "admin",
  "owner",
] as const;

export const ROLES = ROLE_SORT_ORDER;

export type PrimaryRole = (typeof PRIMARY_ROLES)[number];
export type SupplementalRole = (typeof SUPPLEMENTAL_ROLES)[number];

export const DEFAULT_PRIMARY_ROLE: PrimaryRole = "member";

export type Role = (typeof ROLES)[number];

const ROLE_ORDER = new Map<Role, number>(ROLE_SORT_ORDER.map((role, index) => [role, index]));
const PRIMARY_ROLE_ORDER = new Map<PrimaryRole, number>(
  PRIMARY_ROLES.map((role, index) => [role, index]),
);

export function isPrimaryRole(role: Role): role is PrimaryRole {
  return (PRIMARY_ROLE_ORDER as Map<Role, number>).has(role);
}

const SUPPLEMENTAL_ROLE_SET = new Set<Role>(SUPPLEMENTAL_ROLES);

export function isSupplementalRole(role: Role): role is SupplementalRole {
  return SUPPLEMENTAL_ROLE_SET.has(role);
}

export function filterPrimaryRoles(roles: Role[]): PrimaryRole[] {
  return roles.filter((role): role is PrimaryRole => isPrimaryRole(role));
}

export function filterSupplementalRoles(roles: Role[]): SupplementalRole[] {
  return roles.filter((role): role is SupplementalRole => isSupplementalRole(role));
}

export function hasPrimaryRole(roles: Role[]): boolean {
  return roles.some((role) => isPrimaryRole(role));
}

export function getHighestPrimaryRole(roles: Role[]): PrimaryRole {
  const primaries = filterPrimaryRoles(roles);
  if (primaries.length === 0) {
    return DEFAULT_PRIMARY_ROLE;
  }
  return primaries.reduce((highest, current) => {
    const currentOrder = PRIMARY_ROLE_ORDER.get(current) ?? 0;
    const highestOrder = PRIMARY_ROLE_ORDER.get(highest) ?? 0;
    return currentOrder >= highestOrder ? current : highest;
  });
}

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
  const unique = [...new Set(roles)];
  if (!hasPrimaryRole(unique)) {
    unique.push(DEFAULT_PRIMARY_ROLE);
  }
  return unique.sort((a, b) => (ROLE_ORDER.get(a) ?? 0) - (ROLE_ORDER.get(b) ?? 0));
}

export function describeRoles(roles: Role[]) {
  if (!roles.length) return "Keine Rollen";
  return sortRoles(roles)
    .map((role) => ROLE_LABELS[role] ?? role)
    .join(", ");
}
