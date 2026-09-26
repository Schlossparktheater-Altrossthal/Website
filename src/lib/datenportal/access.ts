import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { DATA_PORTAL_PERMISSIONS, FIELD_GROUP_PERMISSION, type FieldGroup } from "./fields";

/** Aufbewahrung des Abfrageprotokolls (Entscheidung 2026-09-26). */
export const DATA_PORTAL_AUDIT_RETENTION_MONTHS = 12;

export type PortalAccess = {
  canView: boolean;
  canExport: boolean;
  grants: Record<FieldGroup, boolean>;
};

/** Rechte für eine Produktion. Produktionsbezogene Rechte gelten nur bei Mitgliedschaft (siehe permissions.ts). */
export async function resolvePortalAccess(
  user: Parameters<typeof hasPermission>[0],
  showId: string,
): Promise<PortalAccess> {
  const check = (key: string) => hasPermission(user, key, { showId });
  const [canView, canExport, education, health] = await Promise.all([
    check(DATA_PORTAL_PERMISSIONS.view),
    check(DATA_PORTAL_PERMISSIONS.export),
    check(FIELD_GROUP_PERMISSION.education),
    check(FIELD_GROUP_PERMISSION.health),
  ]);
  return {
    canView,
    canExport: canView && canExport,
    grants: { base: canView, education: canView && education, health: canView && health },
  };
}

export async function writeAuditLog(entry: {
  userId: string;
  showId: string;
  action: "query" | "export";
  source: string;
  fields: readonly string[];
  rowCount: number;
}) {
  await prisma.dataPortalAuditLog.create({ data: { ...entry, fields: [...entry.fields] } });
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - DATA_PORTAL_AUDIT_RETENTION_MONTHS);
  await prisma.dataPortalAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
