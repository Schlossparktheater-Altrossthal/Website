"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  OBJECT_KIND_LABELS,
  OBJECT_SOURCE_LABELS,
  OBJECT_STATUS_LABELS,
  OBJECT_TEXT_LIMITS,
} from "@/lib/ausstattung/constants";
import { sceneLabel } from "@/lib/ausstattung/objects";
import {
  createObjectWithCard,
  ensureObjectCard,
  requireObjectAccess,
  requireRequirementCreator,
  setObjectStatus,
  validCharacterIds,
  validSceneIds,
} from "@/lib/ausstattung/service";
import { notifyRequestersIfReady } from "@/lib/ausstattung/notify";
import { requireBoardAccess } from "@/lib/departments/board";
import { logObjectActivity, logTaskActivity } from "@/lib/departments/handover";
import { readPhotoFile } from "@/lib/inventory/actions-helpers";
import { createPublicId } from "@/lib/inventory/public-id";
import { searchInventoryProducts } from "@/lib/inventory/queries";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES, departmentActionUrl } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

type Result<T = undefined> = ProductionActionResult & { data?: T };

function revalidateAusstattung() {
  revalidatePath("/mitglieder/meine-gewerke", "layout");
  revalidatePath("/mitglieder/produktionen/stueck");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const kindSchema = z.enum(["prop", "set_piece", "costume", "costume_part", "other"]);

// ---------------------------------------------------------------------------
// Objekte

const createSchema = z.object({
  departmentId: z.string(),
  kind: kindSchema,
  title: z.string().trim().min(1, "Wie heißt das Stück?").max(OBJECT_TEXT_LIMITS.title),
  description: optionalText(OBJECT_TEXT_LIMITS.description),
  sceneIds: z.array(z.string()).max(200).optional(),
  characterIds: z.array(z.string()).max(100).optional(),
  /** Kostümteil gleich einem Kostüm zuordnen. */
  costumeId: z.string().nullish(),
});

export async function createObjectAction(
  input: z.input<typeof createSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const data = createSchema.parse(input);
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const department = await prisma.department.findUniqueOrThrow({
      where: { id: data.departmentId },
      select: { showId: true },
    });
    const object = await prisma.$transaction(async (tx) => {
      const created = await createObjectWithCard(tx, {
        showId: department.showId,
        departmentId: data.departmentId,
        kind: data.kind,
        title: data.title,
        description: data.description,
        createdById: access.userId,
        sceneIds: data.sceneIds,
        characterIds: data.characterIds,
      });
      if (data.costumeId && data.kind === "costume_part") {
        await addPartToCostume(tx, data.costumeId, created.id, department.showId);
      }
      return created;
    });
    revalidateAusstattung();
    return { ...actionSuccess(), data: { id: object.id } };
  } catch (error) {
    return actionFailure(error, "Objekt konnte nicht angelegt werden.");
  }
}

const updateSchema = z.object({
  objectId: z.string(),
  kind: kindSchema,
  title: z.string().trim().min(1, "Titel fehlt.").max(OBJECT_TEXT_LIMITS.title),
  description: optionalText(OBJECT_TEXT_LIMITS.description),
  source: z.enum(["undecided", "stock", "build", "buy", "borrow"]),
  dimensions: optionalText(OBJECT_TEXT_LIMITS.short),
  material: optionalText(OBJECT_TEXT_LIMITS.short),
  note: optionalText(OBJECT_TEXT_LIMITS.note),
  costCents: z.number().int().min(0).max(100_000_000).nullish(),
});

export async function updateObjectAction(input: z.input<typeof updateSchema>): Promise<Result> {
  try {
    const data = updateSchema.parse(input);
    const { object, access } = await requireObjectAccess(data.objectId);
    await prisma.$transaction(async (tx) => {
      const before = await tx.productionObject.findUniqueOrThrow({
        where: { id: object.id },
        select: { source: true },
      });
      if (before.source !== data.source) {
        await logObjectActivity(tx, object.id, access.userId, "source", {
          to: OBJECT_SOURCE_LABELS[data.source],
        });
      }
      await tx.productionObject.update({
        where: { id: object.id },
        data: {
          kind: data.kind,
          title: data.title,
          description: data.description,
          source: data.source,
          dimensions: data.dimensions,
          material: data.material,
          note: data.note,
          costCents: data.costCents ?? null,
          ...(data.source === "stock" ? {} : { inventoryProductId: null, inventoryAssetId: null }),
        },
      });
      // Karte trägt denselben Titel wie das Objekt.
      await tx.departmentTask.updateMany({
        where: { objectId: object.id },
        data: { title: data.title },
      });
    });
    revalidateAusstattung();
    return actionSuccess("Gespeichert");
  } catch (error) {
    return actionFailure(error, "Objekt konnte nicht gespeichert werden.");
  }
}

export async function setObjectStatusAction(input: {
  objectId: string;
  status: "planned" | "in_progress" | "ready";
}): Promise<Result> {
  try {
    const status = z.enum(["planned", "in_progress", "ready"]).parse(input.status);
    const { object, access } = await requireObjectAccess(z.string().parse(input.objectId));
    await prisma.$transaction(async (tx) => {
      await setObjectStatus(tx, object.id, status);
      if (object.status !== status) {
        await logObjectActivity(tx, object.id, access.userId, "status", {
          to: OBJECT_STATUS_LABELS[status],
        });
      }
    });
    if (object.status !== status) await notifyRequestersIfReady(object.id, status, access.userId);
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Status konnte nicht geändert werden.");
  }
}

const scenesSchema = z.object({
  objectId: z.string(),
  scenes: z
    .array(z.object({ sceneId: z.string(), note: optionalText(OBJECT_TEXT_LIMITS.sceneNote) }))
    .max(200),
});

export async function setObjectScenesAction(input: z.input<typeof scenesSchema>): Promise<Result> {
  try {
    const data = scenesSchema.parse(input);
    const { object } = await requireObjectAccess(data.objectId);
    const valid = new Set(
      await validSceneIds(
        prisma,
        object.showId,
        data.scenes.map((entry) => entry.sceneId),
      ),
    );
    const scenes = data.scenes.filter((entry) => valid.has(entry.sceneId));
    await prisma.$transaction([
      prisma.objectScene.deleteMany({ where: { objectId: object.id } }),
      prisma.objectScene.createMany({
        data: scenes.map((entry) => ({
          objectId: object.id,
          sceneId: entry.sceneId,
          note: entry.note,
        })),
        skipDuplicates: true,
      }),
    ]);
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Szenen konnten nicht gespeichert werden.");
  }
}

export async function setObjectCharactersAction(input: {
  objectId: string;
  characterIds: string[];
}): Promise<Result> {
  try {
    const ids = z.array(z.string()).max(100).parse(input.characterIds);
    const { object } = await requireObjectAccess(z.string().parse(input.objectId));
    const valid = await validCharacterIds(prisma, object.showId, ids);
    await prisma.$transaction([
      prisma.objectCharacter.deleteMany({ where: { objectId: object.id } }),
      prisma.objectCharacter.createMany({
        data: valid.map((characterId) => ({ objectId: object.id, characterId })),
      }),
    ]);
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Rollen konnten nicht gespeichert werden.");
  }
}

export async function archiveObjectAction(input: {
  objectId: string;
  archived: boolean;
}): Promise<Result> {
  try {
    const { object, access } = await requireObjectAccess(z.string().parse(input.objectId));
    if (!access.canManage) throw new Error("Archivieren dürfen Leitung und Vertretung.");
    await prisma.productionObject.update({
      where: { id: object.id },
      data: { archivedAt: input.archived ? new Date() : null },
    });
    revalidateAusstattung();
    return actionSuccess(input.archived ? "Archiviert" : "Wiederhergestellt");
  } catch (error) {
    return actionFailure(error, "Objekt konnte nicht archiviert werden.");
  }
}

export async function deleteObjectAction(input: { objectId: string }): Promise<Result> {
  try {
    const { object, access } = await requireObjectAccess(z.string().parse(input.objectId));
    if (!access.canManage) throw new Error("Löschen dürfen Leitung und Vertretung.");
    await prisma.$transaction(async (tx) => {
      const current = await tx.productionObject.findUniqueOrThrow({
        where: { id: object.id },
        select: { inventoryProductId: true },
      });
      if (current.inventoryProductId) {
        await changeReservation(tx, object.showId, current.inventoryProductId, -1);
      }
      // Die Karte gehört zum Objekt und geht mit.
      await tx.departmentTask.deleteMany({ where: { objectId: object.id } });
      await tx.sceneRequirement.updateMany({
        where: { objectId: object.id },
        data: { status: "open", objectId: null, decidedAt: null, decidedById: null },
      });
      await tx.productionObject.delete({ where: { id: object.id } });
    });
    revalidateAusstattung();
    return actionSuccess("Gelöscht");
  } catch (error) {
    return actionFailure(error, "Objekt konnte nicht gelöscht werden.");
  }
}

/** Fehlende Karte nachträglich anlegen (Objekte aus der Datenübernahme). */
export async function ensureObjectCardAction(input: { objectId: string }): Promise<Result> {
  try {
    const { object, access } = await requireObjectAccess(z.string().parse(input.objectId));
    await ensureObjectCard(prisma, object.id, access.userId);
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Karte konnte nicht angelegt werden.");
  }
}

// ---------------------------------------------------------------------------
// Fotos

export async function addObjectPhotoAction(objectId: string, formData: FormData): Promise<Result> {
  try {
    const { object, access } = await requireObjectAccess(z.string().parse(objectId));
    const photo = await readPhotoFile(formData);
    if (!photo) throw new Error("Kein Foto ausgewählt.");
    const kind = formData.get("kind") === "actual" ? "actual" : "reference";
    const count = await prisma.productionObjectPhoto.count({ where: { objectId: object.id } });
    if (count >= 12) throw new Error("Höchstens 12 Fotos je Objekt.");
    await prisma.productionObjectPhoto.create({
      data: {
        objectId: object.id,
        data: photo.data,
        mimeType: photo.mimeType,
        kind,
        sortOrder: count,
      },
    });
    await logObjectActivity(prisma, object.id, access.userId, "photo");
    revalidateAusstattung();
    return actionSuccess("Foto gespeichert");
  } catch (error) {
    return actionFailure(error, "Foto konnte nicht gespeichert werden.");
  }
}

export async function deleteObjectPhotoAction(input: { photoId: string }): Promise<Result> {
  try {
    const photo = await prisma.productionObjectPhoto.findUnique({
      where: { id: z.string().parse(input.photoId) },
      select: { id: true, objectId: true },
    });
    if (!photo) throw new Error("Foto wurde nicht gefunden.");
    await requireObjectAccess(photo.objectId);
    await prisma.productionObjectPhoto.delete({ where: { id: photo.id } });
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Foto konnte nicht gelöscht werden.");
  }
}

// ---------------------------------------------------------------------------
// Checkliste der Karte

async function checklistTask(objectId: string) {
  const { object, access } = await requireObjectAccess(objectId);
  const taskId = await ensureObjectCard(prisma, object.id, access.userId);
  if (!taskId) throw new Error("Karte fehlt.");
  return { taskId, userId: access.userId };
}

export async function addChecklistItemAction(input: {
  objectId: string;
  text: string;
}): Promise<Result> {
  try {
    const text = z.string().trim().min(1).max(OBJECT_TEXT_LIMITS.short).parse(input.text);
    const { taskId, userId } = await checklistTask(z.string().parse(input.objectId));
    const last = await prisma.taskChecklistItem.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    await prisma.taskChecklistItem.create({
      data: { taskId, text, position: (last._max.position ?? -1) + 1 },
    });
    await logTaskActivity(prisma, taskId, userId, "checklist_added", { text });
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht angelegt werden.");
  }
}

async function loadChecklistItem(itemId: string) {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      text: true,
      doneAt: true,
      taskId: true,
      task: { select: { departmentId: true } },
    },
  });
  if (!item) throw new Error("Schritt wurde nicht gefunden.");
  const access = await requireBoardAccess(item.task.departmentId);
  if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
  return { item, access };
}

export async function toggleChecklistItemAction(input: {
  itemId: string;
  done: boolean;
}): Promise<Result> {
  try {
    const { item, access } = await loadChecklistItem(z.string().parse(input.itemId));
    if (Boolean(item.doneAt) !== input.done) {
      await prisma.$transaction(async (tx) => {
        await tx.taskChecklistItem.update({
          where: { id: item.id },
          data: input.done
            ? { doneAt: new Date(), doneById: access.userId }
            : { doneAt: null, doneById: null },
        });
        await logTaskActivity(
          tx,
          item.taskId,
          access.userId,
          input.done ? "checklist_done" : "checklist_undone",
          { text: item.text },
        );
      });
    }
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht geändert werden.");
  }
}

export async function deleteChecklistItemAction(input: { itemId: string }): Promise<Result> {
  try {
    const { item } = await loadChecklistItem(z.string().parse(input.itemId));
    await prisma.taskChecklistItem.delete({ where: { id: item.id } });
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht gelöscht werden.");
  }
}

// ---------------------------------------------------------------------------
// Kostüme aus Teilen

async function addPartToCostume(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  costumeId: string,
  partId: string,
  showId: string,
) {
  const [costume, part] = await Promise.all([
    tx.productionObject.findFirst({ where: { id: costumeId, showId, kind: "costume" } }),
    tx.productionObject.findFirst({ where: { id: partId, showId, kind: "costume_part" } }),
  ]);
  if (!costume || !part) throw new Error("Kostüm oder Teil wurde nicht gefunden.");
  const last = await tx.costumePart.aggregate({ where: { costumeId }, _max: { position: true } });
  await tx.costumePart.upsert({
    where: { costumeId_partId: { costumeId, partId } },
    create: { costumeId, partId, position: (last._max.position ?? -1) + 1 },
    update: {},
  });
}

export async function setCostumePartsAction(input: {
  costumeId: string;
  partIds: string[];
}): Promise<Result> {
  try {
    const partIds = z.array(z.string()).max(60).parse(input.partIds);
    const { object } = await requireObjectAccess(z.string().parse(input.costumeId));
    if (object.kind !== "costume") throw new Error("Teile gibt es nur bei Kostümen.");
    const valid = await prisma.productionObject.findMany({
      where: { id: { in: partIds }, showId: object.showId, kind: "costume_part" },
      select: { id: true },
    });
    const validIds = new Set(valid.map((entry) => entry.id));
    const ordered = [...new Set(partIds)].filter((id) => validIds.has(id));
    await prisma.$transaction([
      prisma.costumePart.deleteMany({ where: { costumeId: object.id } }),
      prisma.costumePart.createMany({
        data: ordered.map((partId, position) => ({ costumeId: object.id, partId, position })),
      }),
    ]);
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Teile konnten nicht gespeichert werden.");
  }
}

// ---------------------------------------------------------------------------
// Vorstellungs-Check (Requisiten)

export async function setObjectCheckedAction(input: {
  objectId: string;
  checked: boolean;
}): Promise<Result> {
  try {
    const { object, access } = await requireObjectAccess(z.string().parse(input.objectId));
    await prisma.productionObject.update({
      where: { id: object.id },
      data: input.checked
        ? { checkedAt: new Date(), checkedById: access.userId }
        : { checkedAt: null, checkedById: null },
    });
    revalidateAusstattung();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Check konnte nicht gespeichert werden.");
  }
}

export async function resetChecksAction(input: { departmentId: string }): Promise<Result> {
  try {
    const access = await requireBoardAccess(z.string().parse(input.departmentId));
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    await prisma.productionObject.updateMany({
      where: { departmentId: access.departmentId },
      data: { checkedAt: null, checkedById: null },
    });
    revalidateAusstattung();
    return actionSuccess("Check zurückgesetzt");
  } catch (error) {
    return actionFailure(error, "Check konnte nicht zurückgesetzt werden.");
  }
}

// ---------------------------------------------------------------------------
// Anforderungen aus der Szene

const requirementSchema = z.object({
  sceneId: z.string(),
  departmentId: z.string(),
  kind: kindSchema,
  characterId: z.string().nullish(),
  text: z.string().trim().min(1, "Was wird gebraucht?").max(OBJECT_TEXT_LIMITS.requirement),
});

export async function createRequirementAction(formData: FormData): Promise<Result> {
  try {
    const { userId } = await requireRequirementCreator();
    const data = requirementSchema.parse({
      sceneId: formData.get("sceneId"),
      departmentId: formData.get("departmentId"),
      kind: formData.get("kind"),
      characterId: formData.get("characterId") || null,
      text: formData.get("text"),
    });
    const scene = await prisma.scene.findUnique({
      where: { id: data.sceneId },
      select: { id: true, showId: true, identifier: true, title: true },
    });
    if (!scene) throw new Error("Szene wurde nicht gefunden.");
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, showId: scene.showId, archivedAt: null },
      select: { id: true, slug: true, name: true },
    });
    if (!department) throw new Error("Gewerk wurde nicht gefunden.");
    const characterId = data.characterId
      ? ((await validCharacterIds(prisma, scene.showId, [data.characterId]))[0] ?? null)
      : null;
    const photo = await readPhotoFile(formData);
    await prisma.sceneRequirement.create({
      data: {
        showId: scene.showId,
        sceneId: scene.id,
        departmentId: department.id,
        kind: data.kind,
        characterId,
        text: data.text,
        photo: photo?.data ?? null,
        photoMimeType: photo?.mimeType ?? null,
        requestedById: userId,
      },
    });
    const leads = await prisma.departmentMembership.findMany({
      where: { departmentId: department.id, status: "active", role: { in: ["lead", "deputy"] } },
      select: { userId: true },
    });
    await notify({
      type: NOTIFICATION_TYPES.SCENE_REQUIREMENT,
      recipients: leads.map((entry) => entry.userId),
      actorId: userId,
      title: `Neue Anforderung: ${OBJECT_KIND_LABELS[data.kind]} für ${sceneLabel(scene)}`,
      body: data.text.slice(0, 200),
      actionUrl: `${departmentActionUrl(department.slug)}?ansicht=aufgaben`,
      showId: scene.showId,
    });
    revalidateAusstattung();
    return actionSuccess("Angefordert");
  } catch (error) {
    return actionFailure(error, "Anforderung konnte nicht gespeichert werden.");
  }
}

/** Offene Anforderung zurückziehen oder abgelehnte entfernen (Regie/Planung). */
export async function withdrawRequirementAction(input: { requirementId: string }): Promise<Result> {
  try {
    await requireRequirementCreator();
    const requirement = await prisma.sceneRequirement.findUnique({
      where: { id: z.string().parse(input.requirementId) },
      select: { id: true, status: true },
    });
    if (!requirement) throw new Error("Anforderung wurde nicht gefunden.");
    if (requirement.status === "assigned") throw new Error("Das Gewerk hat es schon übernommen.");
    await prisma.sceneRequirement.delete({ where: { id: requirement.id } });
    revalidateAusstattung();
    return actionSuccess("Zurückgezogen");
  } catch (error) {
    return actionFailure(error, "Anforderung konnte nicht zurückgezogen werden.");
  }
}

const decideSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new"),
    requirementId: z.string(),
    title: z.string().trim().min(1, "Titel fehlt.").max(OBJECT_TEXT_LIMITS.title),
    kind: kindSchema,
  }),
  z.object({ mode: z.literal("existing"), requirementId: z.string(), objectId: z.string() }),
  z.object({
    mode: z.literal("decline"),
    requirementId: z.string(),
    reason: z.string().trim().min(1, "Bitte kurz begründen.").max(OBJECT_TEXT_LIMITS.note),
  }),
]);

/** Eingang: neues Objekt, vorhandenem Objekt zuordnen oder ablehnen. */
export async function decideRequirementAction(
  input: z.input<typeof decideSchema>,
): Promise<Result<{ objectId: string | null }>> {
  try {
    const data = decideSchema.parse(input);
    const requirement = await prisma.sceneRequirement.findUnique({
      where: { id: data.requirementId },
      select: {
        id: true,
        showId: true,
        sceneId: true,
        departmentId: true,
        characterId: true,
        text: true,
        status: true,
        requestedById: true,
        photo: true,
        photoMimeType: true,
        scene: { select: { identifier: true, title: true } },
      },
    });
    if (!requirement) throw new Error("Anforderung wurde nicht gefunden.");
    if (requirement.status !== "open") throw new Error("Darüber wurde schon entschieden.");
    const access = await requireBoardAccess(requirement.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");

    let objectId: string | null = null;
    let objectTitle = "";
    await prisma.$transaction(async (tx) => {
      if (data.mode === "decline") {
        await tx.sceneRequirement.update({
          where: { id: requirement.id },
          data: {
            status: "declined",
            declineReason: data.reason,
            decidedById: access.userId,
            decidedAt: new Date(),
          },
        });
        return;
      }
      if (data.mode === "new") {
        const created = await createObjectWithCard(tx, {
          showId: requirement.showId,
          departmentId: requirement.departmentId,
          kind: data.kind,
          title: data.title,
          description: requirement.text,
          createdById: access.userId,
          sceneIds: [requirement.sceneId],
          characterIds: requirement.characterId ? [requirement.characterId] : [],
        });
        objectId = created.id;
        objectTitle = created.title;
        // Foto der Anforderung wird Referenzfoto des Objekts.
        if (requirement.photo && requirement.photoMimeType) {
          await tx.productionObjectPhoto.create({
            data: {
              objectId: created.id,
              data: requirement.photo,
              mimeType: requirement.photoMimeType,
              kind: "reference",
            },
          });
        }
      } else {
        const existing = await tx.productionObject.findFirst({
          where: { id: data.objectId, departmentId: requirement.departmentId },
          select: { id: true, title: true },
        });
        if (!existing) throw new Error("Objekt wurde nicht gefunden.");
        objectId = existing.id;
        objectTitle = existing.title;
        await tx.objectScene.upsert({
          where: { objectId_sceneId: { objectId: existing.id, sceneId: requirement.sceneId } },
          create: { objectId: existing.id, sceneId: requirement.sceneId },
          update: {},
        });
        if (requirement.characterId) {
          await tx.objectCharacter.upsert({
            where: {
              objectId_characterId: {
                objectId: existing.id,
                characterId: requirement.characterId,
              },
            },
            create: { objectId: existing.id, characterId: requirement.characterId },
            update: {},
          });
        }
      }
      await tx.sceneRequirement.update({
        where: { id: requirement.id },
        data: {
          status: "assigned",
          objectId,
          decidedById: access.userId,
          decidedAt: new Date(),
        },
      });
    });

    if (requirement.requestedById) {
      const label = sceneLabel(requirement.scene);
      await notify({
        type: NOTIFICATION_TYPES.SCENE_REQUIREMENT,
        recipients: [requirement.requestedById],
        actorId: access.userId,
        title:
          data.mode === "decline"
            ? `Anforderung für ${label} abgelehnt`
            : `Anforderung für ${label} übernommen`,
        body: data.mode === "decline" ? data.reason : `Wird als „${objectTitle}“ umgesetzt.`,
        actionUrl: "/mitglieder/produktionen/stueck",
        showId: requirement.showId,
      });
    }
    revalidateAusstattung();
    return { ...actionSuccess(), data: { objectId } };
  } catch (error) {
    return actionFailure(error, "Entscheidung konnte nicht gespeichert werden.");
  }
}

// ---------------------------------------------------------------------------
// Fundus (Lager): Typ/Exemplar verknüpfen und im Lager-Projekt der Produktion vormerken

export type FundusHit = {
  id: string;
  name: string;
  area: string;
  photoId: string | null;
  count: number;
};

export async function searchFundusAction(input: {
  objectId: string;
  query: string;
}): Promise<Result<FundusHit[]>> {
  try {
    await requireObjectAccess(z.string().parse(input.objectId), "view");
    const query = z
      .string()
      .max(120)
      .parse(input.query ?? "");
    const hits = await searchInventoryProducts(query, 15);
    return {
      ...actionSuccess(),
      data: hits.map((hit) => ({
        id: hit.id,
        name: hit.name,
        area: hit.areaName,
        photoId: hit.photoId,
        count: hit.count,
      })),
    };
  } catch (error) {
    return actionFailure(error, "Suche fehlgeschlagen.");
  }
}

export type FundusAsset = { id: string; code: string; status: string };

export async function listFundusAssetsAction(input: {
  objectId: string;
  productId: string;
}): Promise<Result<FundusAsset[]>> {
  try {
    await requireObjectAccess(z.string().parse(input.objectId), "view");
    const assets = await prisma.inventoryAsset.findMany({
      where: { productId: z.string().parse(input.productId), status: { not: "retired" } },
      orderBy: [{ unitNumber: "asc" }, { code: "asc" }],
      take: 100,
      select: { id: true, code: true, status: true },
    });
    return { ...actionSuccess(), data: assets };
  } catch (error) {
    return actionFailure(error, "Exemplare konnten nicht geladen werden.");
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Lager-Projekt der Produktion (angelegt bei Bedarf, Status „angefragt“). */
async function showProject(tx: Tx, showId: string) {
  const existing = await tx.inventoryProject.findFirst({
    where: { showId, status: { in: ["request", "confirmed"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const show = await tx.show.findUniqueOrThrow({
    where: { id: showId },
    select: { title: true, year: true },
  });
  const created = await tx.inventoryProject.create({
    data: {
      publicId: createPublicId(),
      title: `Produktion ${show.title ?? show.year}`,
      status: "request",
      showId,
      note: "Automatisch angelegt für Ausstattung aus dem Fundus.",
    },
    select: { id: true },
  });
  return created.id;
}

async function changeReservation(tx: Tx, showId: string, productId: string, delta: 1 | -1) {
  const projectId = await showProject(tx, showId);
  const line = await tx.inventoryProjectLine.findUnique({
    where: { projectId_productId: { projectId, productId } },
    select: { id: true, quantity: true },
  });
  if (delta > 0) {
    if (line) {
      await tx.inventoryProjectLine.update({
        where: { id: line.id },
        data: { quantity: { increment: 1 } },
      });
    } else {
      const count = await tx.inventoryProjectLine.count({ where: { projectId } });
      await tx.inventoryProjectLine.create({
        data: { projectId, productId, quantity: 1, note: "Ausstattung", sortOrder: count },
      });
    }
  } else if (line) {
    if (line.quantity <= 1) await tx.inventoryProjectLine.delete({ where: { id: line.id } });
    else
      await tx.inventoryProjectLine.update({
        where: { id: line.id },
        data: { quantity: { decrement: 1 } },
      });
  }
}

export async function linkFundusAction(input: {
  objectId: string;
  productId: string | null;
  assetId?: string | null;
}): Promise<Result> {
  try {
    const { object } = await requireObjectAccess(z.string().parse(input.objectId));
    const productId = z.string().nullable().parse(input.productId);
    const assetId = z.string().nullish().parse(input.assetId) ?? null;
    if (assetId) {
      const asset = await prisma.inventoryAsset.findFirst({
        where: { id: assetId, productId: productId ?? undefined },
        select: { id: true },
      });
      if (!asset) throw new Error("Exemplar passt nicht zum Typ.");
    }
    await prisma.$transaction(async (tx) => {
      const before = await tx.productionObject.findUniqueOrThrow({
        where: { id: object.id },
        select: { inventoryProductId: true },
      });
      if (before.inventoryProductId !== productId) {
        if (before.inventoryProductId) {
          await changeReservation(tx, object.showId, before.inventoryProductId, -1);
        }
        if (productId) await changeReservation(tx, object.showId, productId, 1);
      }
      await tx.productionObject.update({
        where: { id: object.id },
        data: {
          inventoryProductId: productId,
          inventoryAssetId: productId ? assetId : null,
          ...(productId ? { source: "stock" } : {}),
        },
      });
    });
    revalidateAusstattung();
    revalidatePath("/mitglieder/lager", "layout");
    return actionSuccess(productId ? "Im Lager vorgemerkt" : "Verknüpfung gelöst");
  } catch (error) {
    return actionFailure(error, "Fundus konnte nicht verknüpft werden.");
  }
}
