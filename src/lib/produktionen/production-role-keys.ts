import type { Role } from "@prisma/client";

/** Rollen, die pro Produktion vergeben werden (Entscheidung E1). */
export const PRODUCTION_ROLES = ["cast", "tech"] as const satisfies readonly Role[];
export type ProductionRole = (typeof PRODUCTION_ROLES)[number];

export function isProductionRole(role: unknown): role is ProductionRole {
  return typeof role === "string" && (PRODUCTION_ROLES as readonly string[]).includes(role);
}

export function sanitizeProductionRoles(roles: readonly unknown[]): ProductionRole[] {
  return PRODUCTION_ROLES.filter((role) => roles.includes(role));
}
