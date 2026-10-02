"use server";

import { z } from "zod";

import {
  failure,
  optionalText,
  readJsonField,
  readPhotoFile,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import {
  addMonths,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  DEFECT_SEVERITIES,
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUSES,
  inventoryAssetPath,
} from "@/lib/inventory/constants";
import {
  inventoryManagerIds,
  recordEvent,
  refreshAssetStatus,
  requireInventoryAccess,
} from "@/lib/inventory/service";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

const defectSchema = z.object({
  title: z.string().trim().min(1, "Bitte kurz beschreiben, was kaputt ist.").max(160),
  description: optionalText(2000),
  severity: z.enum(DEFECT_SEVERITIES),
});

/** Mangel melden – schnell vom Handy aus, optional mit Foto. */
export async function reportDefectAction(
  assetId: string,
  formData: FormData,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const input = readJsonField(formData, "defect", defectSchema);
    const photo = await readPhotoFile(formData);
    const asset = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventoryAsset.findUnique({
        where: { id: assetId },
        select: { code: true, name: true },
      });
      if (!asset) throw new Error("Objekt nicht gefunden.");
      const defect = await tx.inventoryDefect.create({
        data: {
          assetId,
          title: input.title,
          description: input.description,
          severity: input.severity,
          reportedById: userId,
        },
      });
      if (photo) {
        await tx.inventoryPhoto.create({
          data: { defectId: defect.id, data: photo.data, mimeType: photo.mimeType },
        });
      }
      await recordEvent(tx, {
        assetId,
        type: "defect",
        message: `Mangel gemeldet: ${input.title} (${DEFECT_SEVERITY_LABELS[input.severity]})`,
        userId,
      });
      await refreshAssetStatus(tx, assetId);
      return asset;
    });

    if (input.severity !== "cosmetic") {
      try {
        await notify({
          type: NOTIFICATION_TYPES.INVENTORY_DEFECT,
          recipients: await inventoryManagerIds(),
          actorId: userId,
          title: `Mangel an ${asset.code} ${asset.name}`,
          body: `${input.title} – ${DEFECT_SEVERITY_LABELS[input.severity]}`,
          actionUrl: inventoryAssetPath(asset.code),
          groupKey: `inventory-defect:${assetId}`,
        });
      } catch (error) {
        console.warn("reportDefectAction notify failed", error);
      }
    }

    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Mangel gemeldet." };
  } catch (error) {
    console.error("reportDefectAction", error);
    return failure(error, "Mangel konnte nicht gespeichert werden.");
  }
}

export async function updateDefectAction(
  defectId: string,
  status: (typeof DEFECT_STATUSES)[number],
  resolutionNote?: string,
): Promise<InventoryActionResult> {
  try {
    const { userId } = await requireInventoryAccess("use");
    const nextStatus = z.enum(DEFECT_STATUSES).parse(status);
    const note = z.string().trim().max(1000).optional().parse(resolutionNote) || null;
    const asset = await prisma.$transaction(async (tx) => {
      const defect = await tx.inventoryDefect.update({
        where: { id: defectId },
        data: {
          status: nextStatus,
          resolutionNote: nextStatus === "done" ? note : undefined,
          resolvedAt: nextStatus === "done" ? new Date() : null,
        },
        select: { title: true, assetId: true, asset: { select: { code: true } } },
      });
      const label =
        nextStatus === "done"
          ? `Mangel behoben: ${defect.title}${note ? ` – ${note}` : ""}`
          : nextStatus === "repair"
            ? `In Reparatur: ${defect.title}`
            : `Mangel wieder offen: ${defect.title}`;
      await recordEvent(tx, { assetId: defect.assetId, type: "defect", message: label, userId });
      await refreshAssetStatus(tx, defect.assetId);
      return defect.asset;
    });
    revalidateInventory(inventoryAssetPath(asset.code));
    return { ok: true, message: "Mangel aktualisiert." };
  } catch (error) {
    console.error("updateDefectAction", error);
    return failure(error, "Mangel konnte nicht aktualisiert werden.");
  }
}

const inspectionSchema = z.object({
  kind: z.string().trim().min(1).max(60).default("DGUV V3"),
  result: z.enum(["passed", "failed"]),
  inspectedAt: z
    .string()
    .min(1, "Bitte das Prüfdatum angeben.")
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Ungültiges Datum." });
        return z.NEVER;
      }
      return date;
    }),
  intervalMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
  inspectorName: optionalText(120),
  note: optionalText(1000),
});

/**
 * Prüfung eintragen. Darf jede Person mit Lagerzugriff (Wunsch: niedrige Hürde); wer prüft,
 * steht im Protokoll. Bei „nicht bestanden“ wird das Objekt automatisch gesperrt.
 */
export async function recordInspectionAction(
  assetIds: string[],
  formData: FormData,
): Promise<InventoryActionResult<{ inspectionIds: string[] }>> {
  try {
    const { session, userId } = await requireInventoryAccess("use");
    const ids = z.array(z.string().min(1)).min(1).max(300).parse(assetIds);
    const input = readJsonField(formData, "inspection", inspectionSchema);
    const fallbackName =
      [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ") ||
      session.user?.name ||
      null;

    const inspectionIds: string[] = [];
    for (const assetId of ids) {
      const id = await prisma.$transaction(async (tx) => {
        const asset = await tx.inventoryAsset.findUnique({
          where: { id: assetId },
          select: { inspectionIntervalMonths: true },
        });
        if (!asset) throw new Error("Objekt nicht gefunden.");
        const interval =
          input.intervalMonths ??
          asset.inspectionIntervalMonths ??
          DEFAULT_INSPECTION_INTERVAL_MONTHS;
        const nextDueAt = input.result === "passed" ? addMonths(input.inspectedAt, interval) : null;
        const inspection = await tx.inventoryInspection.create({
          data: {
            assetId,
            kind: input.kind,
            result: input.result,
            inspectedAt: input.inspectedAt,
            nextDueAt,
            inspectorId: userId,
            inspectorName: input.inspectorName ?? fallbackName,
            note: input.note,
          },
        });
        await tx.inventoryAsset.update({
          where: { id: assetId },
          data: {
            inspectionRequired: true,
            inspectionIntervalMonths: interval,
            lastInspectionAt: input.inspectedAt,
            nextInspectionAt: nextDueAt,
            lastSeenAt: new Date(),
          },
        });
        if (input.result === "failed") {
          await tx.inventoryDefect.create({
            data: {
              assetId,
              title: `${input.kind}-Prüfung nicht bestanden`,
              description: input.note,
              severity: "locked",
              reportedById: userId,
            },
          });
        }
        await recordEvent(tx, {
          assetId,
          type: "inspection",
          message:
            input.result === "passed"
              ? `${input.kind}-Prüfung bestanden`
              : `${input.kind}-Prüfung nicht bestanden – gesperrt`,
          userId,
        });
        await refreshAssetStatus(tx, assetId, { seen: true });
        return inspection.id;
      });
      inspectionIds.push(id);
    }
    revalidateInventory();
    return {
      ok: true,
      message: ids.length === 1 ? "Prüfung eingetragen." : `${ids.length} Prüfungen eingetragen.`,
      data: { inspectionIds },
    };
  } catch (error) {
    console.error("recordInspectionAction", error);
    return failure(error, "Prüfung konnte nicht gespeichert werden.");
  }
}
