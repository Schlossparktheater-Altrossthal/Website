import type { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sortRoles } from "@/lib/roles";

import { isProductionRole, sanitizeProductionRoles } from "./production-role-keys";
import { currentMembershipWhere } from "./status";

export {
  PRODUCTION_ROLES,
  isProductionRole,
  sanitizeProductionRoles,
  type ProductionRole,
} from "./production-role-keys";

/**
 * Globale Rollen = produktionsunabhängige Rollen (Vorstand, Finanzen, Admin …) plus die
 * Rollen aus allen geplanten/aktiven Produktionen. Ohne jede Rolle bleibt „Mitglied“.
 * Bewusst ohne `withAutoCast`: Die Bestandsdaten folgen dieser Regel nicht, sonst bekämen
 * z. B. Vorstand und Owner ungewollt die Ensemble-Rolle.
 */
export function computeEffectiveRoles(
  globalRoles: readonly Role[],
  productionRoleSets: ReadonlyArray<readonly Role[]>,
): Role[] {
  const base = globalRoles.filter((role) => !isProductionRole(role));
  const fromProductions = productionRoleSets.flatMap((roles) => sanitizeProductionRoles(roles));
  const combined = sortRoles([...base, ...fromProductions]);
  return combined.length > 0 ? combined : ["member"];
}

type RoleSyncUser = {
  id: string;
  role: Role;
  roles: Array<{ role: Role }>;
  productionMemberships: Array<{ roles: Role[] }>;
};

export type RoleSyncClient = {
  user: {
    findMany(args: {
      where: Prisma.UserWhereInput;
      select: {
        id: true;
        role: true;
        roles: { select: { role: true } };
        productionMemberships: {
          where: Prisma.ProductionMembershipWhereInput;
          select: { roles: true };
        };
      };
    }): Promise<RoleSyncUser[]>;
    update(args: { where: { id: string }; data: { role: Role } }): Promise<unknown>;
  };
  userRole: {
    deleteMany(args: { where: { userId: string } }): Promise<unknown>;
    createMany(args: { data: Array<{ userId: string; role: Role }> }): Promise<unknown>;
  };
};

/**
 * Leitet die globalen Rollen `cast`/`tech` aus den aktuellen Produktionsmitgliedschaften ab.
 * Gibt die Nutzer zurück, deren Rollen sich geändert haben.
 */
export async function syncProductionRoles(
  userIds: readonly string[],
  client: RoleSyncClient = prisma,
  now: Date = new Date(),
): Promise<string[]> {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return [];

  const users = await client.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      role: true,
      roles: { select: { role: true } },
      productionMemberships: {
        where: currentMembershipWhere(now),
        select: { roles: true },
      },
    },
  });

  const changed: string[] = [];
  for (const user of users) {
    const before = sortRoles([user.role, ...user.roles.map((entry) => entry.role)]);
    const after = computeEffectiveRoles(
      before,
      user.productionMemberships.map((membership) => membership.roles),
    );
    if (before.length === after.length && before.every((role, index) => role === after[index])) {
      continue;
    }
    await client.userRole.deleteMany({ where: { userId: user.id } });
    await client.userRole.createMany({ data: after.map((role) => ({ userId: user.id, role })) });
    await client.user.update({
      where: { id: user.id },
      data: { role: after[after.length - 1] },
    });
    changed.push(user.id);
  }
  return changed;
}
