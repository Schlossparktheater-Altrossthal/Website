"use server";

import { z } from "zod";

import {
  failure,
  optionalId,
  optionalText,
  revalidateInventory,
  type InventoryActionResult,
} from "@/lib/inventory/actions-helpers";
import {
  INVENTORY_PROJECTS_PATH,
  inventoryProjectPath,
  parseDateOnly,
  PHASE_KINDS,
  PROJECT_STATUSES,
  projectWindow,
} from "@/lib/inventory/project-constants";
import { createPublicId } from "@/lib/inventory/public-id";
import { requireInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";

/** Lager-Projekte (docs/Plan/lager-typen-projekte-plan.md, Phase 6). */

const dateOnly = z.string().transform((value, ctx) => {
  const date = parseDateOnly(value);
  if (!date) {
    ctx.addIssue({ code: "custom", message: "Bitte ein Datum angeben." });
    return z.NEVER;
  }
  return date;
});

const phaseSchema = z
  .object({
    kind: z.enum(PHASE_KINDS),
    label: optionalText(60),
    startsOn: dateOnly,
    endsOn: dateOnly.optional().nullable(),
  })
  .transform((phase) => ({ ...phase, endsOn: phase.endsOn ?? phase.startsOn }))
  .refine((phase) => phase.endsOn >= phase.startsOn, {
    message: "Eine Phase endet vor ihrem Beginn.",
  });

const projectSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(160),
  status: z.enum(PROJECT_STATUSES).default("request"),
  /** Bestehender Kunde oder neuer Name (legt einen Kunden an). */
  contactId: optionalId,
  contactName: optionalText(160),
  venue: optionalText(200),
  leadUserId: optionalId,
  leadName: optionalText(120),
  showId: optionalId,
  note: optionalText(4000),
  phases: z.array(phaseSchema).max(30).default([]),
});

export type ProjectInput = z.input<typeof projectSchema>;

async function resolveContact(input: z.infer<typeof projectSchema>) {
  if (input.contactId) return input.contactId;
  if (!input.contactName) return null;
  const existing = await prisma.inventoryContact.findFirst({
    where: { name: { equals: input.contactName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.inventoryContact.create({
    data: { name: input.contactName },
    select: { id: true },
  });
  return created.id;
}

export async function saveProjectAction(
  id: string | null,
  raw: ProjectInput,
): Promise<InventoryActionResult<{ publicId: string }>> {
  try {
    await requireInventoryAccess("use");
    const input = projectSchema.parse(raw);
    const contactId = await resolveContact(input);
    const window = projectWindow(input.phases);
    const data = {
      title: input.title,
      status: input.status,
      contactId,
      venue: input.venue,
      leadUserId: input.leadUserId,
      leadName: input.leadUserId ? null : input.leadName,
      showId: input.showId,
      note: input.note,
      startsOn: window.startsOn,
      endsOn: window.endsOn,
    };
    const phases = input.phases.map((phase) => ({
      kind: phase.kind,
      label: phase.label,
      startsOn: phase.startsOn,
      endsOn: phase.endsOn,
    }));
    const project = await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.inventoryProjectPhase.deleteMany({ where: { projectId: id } });
        return tx.inventoryProject.update({
          where: { id },
          data: { ...data, phases: { create: phases } },
          select: { publicId: true },
        });
      }
      return tx.inventoryProject.create({
        data: { ...data, publicId: createPublicId(), phases: { create: phases } },
        select: { publicId: true },
      });
    });
    revalidateInventory(INVENTORY_PROJECTS_PATH, inventoryProjectPath(project.publicId));
    return { ok: true, message: "Projekt gespeichert.", data: project };
  } catch (error) {
    console.error("saveProjectAction", error);
    return failure(error, "Projekt konnte nicht gespeichert werden.");
  }
}

export async function setProjectStatusAction(
  id: string,
  status: string,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const value = z.enum(PROJECT_STATUSES).parse(status);
    const project = await prisma.inventoryProject.update({
      where: { id },
      data: { status: value },
      select: { publicId: true },
    });
    revalidateInventory(INVENTORY_PROJECTS_PATH, inventoryProjectPath(project.publicId));
    return { ok: true, message: "Status geändert." };
  } catch (error) {
    console.error("setProjectStatusAction", error);
    return failure(error, "Status konnte nicht geändert werden.");
  }
}

export async function deleteProjectAction(id: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("manage");
    const open = await prisma.inventoryCheckout.count({ where: { projectId: id, status: "open" } });
    if (open) throw new Error("Es gibt noch offene Ausgaben zu diesem Projekt.");
    await prisma.inventoryProject.delete({ where: { id } });
    revalidateInventory(INVENTORY_PROJECTS_PATH);
    return { ok: true, message: "Projekt gelöscht." };
  } catch (error) {
    console.error("deleteProjectAction", error);
    return failure(error, "Projekt konnte nicht gelöscht werden.");
  }
}

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Mindestens 1.").max(100_000),
  note: optionalText(200),
});

/** Bedarf hinzufügen; gibt es den Typ schon, wird die Menge erhöht. */
export async function addProjectLineAction(
  projectId: string,
  raw: z.input<typeof lineSchema>,
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const input = lineSchema.parse(raw);
    const project = await prisma.inventoryProject.findUniqueOrThrow({
      where: { id: projectId },
      select: { publicId: true, _count: { select: { lines: true } } },
    });
    await prisma.inventoryProjectLine.upsert({
      where: { projectId_productId: { projectId, productId: input.productId } },
      create: {
        projectId,
        productId: input.productId,
        quantity: input.quantity,
        note: input.note,
        sortOrder: project._count.lines,
      },
      update: { quantity: { increment: input.quantity } },
    });
    revalidateInventory(inventoryProjectPath(project.publicId));
    return { ok: true };
  } catch (error) {
    console.error("addProjectLineAction", error);
    return failure(error, "Bedarf konnte nicht gespeichert werden.");
  }
}

export async function updateProjectLineAction(
  lineId: string,
  raw: { quantity: number; note?: string | null },
): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const input = lineSchema.omit({ productId: true }).parse(raw);
    const line = await prisma.inventoryProjectLine.update({
      where: { id: lineId },
      data: { quantity: input.quantity, note: input.note },
      select: { project: { select: { publicId: true } } },
    });
    revalidateInventory(inventoryProjectPath(line.project.publicId));
    return { ok: true };
  } catch (error) {
    console.error("updateProjectLineAction", error);
    return failure(error, "Bedarf konnte nicht gespeichert werden.");
  }
}

export async function removeProjectLineAction(lineId: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryAccess("use");
    const line = await prisma.inventoryProjectLine.delete({
      where: { id: lineId },
      select: { project: { select: { publicId: true } } },
    });
    revalidateInventory(inventoryProjectPath(line.project.publicId));
    return { ok: true };
  } catch (error) {
    console.error("removeProjectLineAction", error);
    return failure(error, "Bedarf konnte nicht entfernt werden.");
  }
}
