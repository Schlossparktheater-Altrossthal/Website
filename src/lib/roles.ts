export const ROLES = [
  "member",
  "cast",
  "tech",
  "board",
  "finance_admin",
  "admin",
  "owner",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  member: "Mitglied",
  cast: "Ensemble",
  tech: "Technik",
  board: "Vorstand",
  finance_admin: "Finanzen",
  owner: "Owner",
  admin: "Admin",
};

export const ROLE_BADGE_VARIANTS: Record<Role, string> = {
  member: "bg-slate-100 text-slate-700 border-slate-200",
  cast: "bg-purple-100 text-purple-700 border-purple-200",
  tech: "bg-blue-100 text-blue-700 border-blue-200",
  board: "bg-emerald-100 text-emerald-700 border-emerald-200",
  finance_admin: "bg-amber-100 text-amber-700 border-amber-200",
  owner: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  admin: "bg-red-100 text-red-700 border-red-200",
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
