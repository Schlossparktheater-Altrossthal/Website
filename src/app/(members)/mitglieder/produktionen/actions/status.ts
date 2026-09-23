"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import {
  actionFailure,
  actionSuccess,
  readOptionalString,
  readString,
  revalidateShow,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import {
  PRODUCTION_STATUS_LABELS,
  buildProductionStatusUpdate,
  isProductionStatus,
  shouldCloseMemberships,
} from "@/lib/produktionen/status";

export async function setProductionStatusAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const status = readString(formData, "status", { label: "Status" });
    const redirectPath = readOptionalString(formData, "redirectPath");
    if (!isProductionStatus(status)) {
      throw new Error("Unbekannter Produktionsstatus.");
    }

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { id: true, status: true },
    });
    if (!show) {
      throw new Error("Produktion wurde nicht gefunden.");
    }
    if (show.status === status) {
      return actionSuccess(`Produktion ist bereits „${PRODUCTION_STATUS_LABELS[status]}“.`);
    }

    const now = new Date();
    const closedMemberships = await prisma.$transaction(async (tx) => {
      await tx.show.update({
        where: { id: showId },
        data: buildProductionStatusUpdate(status, now),
      });
      if (!shouldCloseMemberships(status)) {
        return 0;
      }
      const result = await tx.productionMembership.updateMany({
        where: { showId, status: { not: "left" } },
        data: { status: "left", leftAt: now },
      });
      return result.count;
    });

    if (closedMemberships > 0) {
      requestServiceGroupSync();
    }

    revalidatePath("/mitglieder", "layout");
    revalidateShow(showId, redirectPath, true);

    const label = PRODUCTION_STATUS_LABELS[status];
    return actionSuccess(
      closedMemberships > 0
        ? `Status: ${label}. ${closedMemberships} Mitgliedschaften wurden beendet.`
        : `Status: ${label}.`,
    );
  } catch (error) {
    console.error("setProductionStatusAction", error);
    return actionFailure(error, "Status konnte nicht geändert werden.");
  }
}
