import { prisma } from "@/lib/prisma";
import { ROLES, sortRoles, type Role } from "@/lib/roles";
import type { SeasonResetSettings } from "@prisma/client";

export const SEASON_RESET_SETTINGS_ID = "default";

export const DEFAULT_PROTECTED_ROLES: Role[] = ["owner", "admin"];

export function sanitiseProtectedRoles(values: readonly unknown[]): Role[] {
  const roles: Role[] = [];
  for (const value of values) {
    if (typeof value === "string" && (ROLES as readonly string[]).includes(value)) {
      roles.push(value as Role);
    }
  }
  return sortRoles(Array.from(new Set(roles)));
}

export function resolveProtectedRoles(record: SeasonResetSettings | null | undefined): Role[] {
  const raw = record?.protectedRoles;

  // Nie konfiguriert (null) → Default. Leer konfiguriert ([]) → nur Owner.
  if (!Array.isArray(raw)) {
    return [...DEFAULT_PROTECTED_ROLES];
  }

  const roles = new Set<Role>(sanitiseProtectedRoles(raw));
  roles.add("owner"); // Owner ist immer geschützt.
  return sortRoles(Array.from(roles));
}

export async function readSeasonResetSettings(): Promise<SeasonResetSettings | null> {
  return prisma.seasonResetSettings.findUnique({
    where: { id: SEASON_RESET_SETTINGS_ID },
  });
}

export async function saveProtectedRoles(roles: readonly Role[]) {
  const sanitised = sanitiseProtectedRoles(roles).filter((role) => role !== "owner");
  return prisma.seasonResetSettings.upsert({
    where: { id: SEASON_RESET_SETTINGS_ID },
    update: { protectedRoles: sanitised },
    create: { id: SEASON_RESET_SETTINGS_ID, protectedRoles: sanitised },
  });
}
