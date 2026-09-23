import type { Prisma, ProductionStatus } from "@prisma/client";

export const PRODUCTION_STATUSES = [
  "planning",
  "active",
  "finished",
  "archived",
] as const satisfies readonly ProductionStatus[];

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  planning: "In Planung",
  active: "Aktiv",
  finished: "Beendet",
  archived: "Archiviert",
};

/** Produktionen, deren Mitglieder Zugriff auf den Mitgliederbereich haben. */
export const CURRENT_PRODUCTION_STATUSES = [
  "planning",
  "active",
] as const satisfies readonly ProductionStatus[];

export function isProductionStatus(value: unknown): value is ProductionStatus {
  return typeof value === "string" && (PRODUCTION_STATUSES as readonly string[]).includes(value);
}

export function isCurrentProductionStatus(status: ProductionStatus): boolean {
  return (CURRENT_PRODUCTION_STATUSES as readonly ProductionStatus[]).includes(status);
}

/** Mitgliedschaft, die aktuell Zugriff gibt: aktiv und in einer laufenden oder geplanten Produktion. */
export function currentMembershipWhere(
  now: Date = new Date(),
): Prisma.ProductionMembershipWhereInput {
  return {
    status: "active",
    OR: [{ leftAt: null }, { leftAt: { gt: now } }],
    show: { status: { in: [...CURRENT_PRODUCTION_STATUSES] } },
  };
}

/** Daten für den Statuswechsel einer Produktion. */
export function buildProductionStatusUpdate(
  status: ProductionStatus,
  now: Date = new Date(),
): Prisma.ShowUpdateInput {
  return {
    status,
    statusChangedAt: now,
    archivedAt: status === "archived" ? now : null,
  };
}

/** Beim Beenden oder Archivieren scheiden alle noch offenen Mitgliedschaften aus. */
export function shouldCloseMemberships(status: ProductionStatus): boolean {
  return !isCurrentProductionStatus(status);
}
