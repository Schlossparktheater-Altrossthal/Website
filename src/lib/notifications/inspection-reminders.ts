import { INSPECTION_SOON_DAYS, INVENTORY_BASE_PATH } from "@/lib/inventory/constants";
import { inventoryManagerIds } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

import { notify } from "./notify";
import { NOTIFICATION_TYPES } from "./types";

/**
 * Monatliche Sammelerinnerung an die Lagerverwaltung, wenn Elektroprüfungen in den nächsten
 * 30 Tagen fällig oder überfällig sind. Läuft im Erinnerungs-Cron mit; je Monat höchstens einmal
 * (erkannt am `groupKey` der Benachrichtigung).
 */
export async function dispatchInspectionReminders(now: Date = new Date()) {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const groupKey = `inventory-inspection:${month}`;
  const already = await prisma.notification.count({ where: { groupKey } });
  if (already > 0) return { sent: 0, skipped: 1 };

  const soon = new Date(now.getTime() + INSPECTION_SOON_DAYS * 86_400_000);
  const base = { inspectionRequired: true, status: { not: "retired" as const } };
  const [overdue, upcoming] = await Promise.all([
    prisma.inventoryAsset.count({
      where: { ...base, OR: [{ nextInspectionAt: null }, { nextInspectionAt: { lt: now } }] },
    }),
    prisma.inventoryAsset.count({
      where: { ...base, nextInspectionAt: { gte: now, lte: soon } },
    }),
  ]);
  if (!overdue && !upcoming) return { sent: 0, skipped: 0 };

  const recipients = await inventoryManagerIds();
  if (!recipients.length) return { sent: 0, skipped: 1 };
  const parts = [
    overdue ? `${overdue} überfällig` : null,
    upcoming ? `${upcoming} in den nächsten ${INSPECTION_SOON_DAYS} Tagen` : null,
  ].filter(Boolean);
  await notify({
    type: NOTIFICATION_TYPES.INVENTORY_INSPECTION,
    recipients,
    title: "Elektroprüfungen fällig",
    body: parts.join(", "),
    actionUrl: `${INVENTORY_BASE_PATH}/pruefungen`,
    groupKey,
    ...(overdue ? { severity: "error" as const } : {}),
  });
  return { sent: 1, skipped: 0 };
}
