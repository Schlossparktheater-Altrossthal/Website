"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  ensureUniqueSceneSlug,
  requireProductionManager,
  slugify,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { compareSceneIdentifiers } from "@/lib/produktionen/roles-scenes";

const hexColor = /^#[0-9a-f]{6}$/i;
const sceneIdentifier = /^\d+(?:\.\d+)?$/;

function revalidateRolesScenes() {
  revalidatePath("/mitglieder/produktionen/besetzung");
  revalidatePath("/mitglieder/produktionen/szenen");
  revalidatePath("/mitglieder/produktionen/zuweisung");
  revalidatePath("/mitglieder/meine-gewerke", "layout");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

async function assertShow(showId: string) {
  const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
  if (!show) throw new Error("Produktion wurde nicht gefunden.");
}

async function loadCharacter(id: string) {
  const character = await prisma.character.findUnique({
    where: { id },
    select: { id: true, showId: true },
  });
  if (!character) throw new Error("Rolle wurde nicht gefunden.");
  return character;
}

async function loadScene(id: string) {
  const scene = await prisma.scene.findUnique({
    where: { id },
    select: { id: true, showId: true },
  });
  if (!scene) throw new Error("Szene wurde nicht gefunden.");
  return scene;
}

/** Szenen-Reihenfolge (`sequence`) aus den Nummern neu setzen, damit Portale richtig sortieren. */
async function resequenceScenes(showId: string) {
  const scenes = await prisma.scene.findMany({
    where: { showId },
    select: { id: true, identifier: true, sequence: true },
  });
  scenes.sort((a, b) => compareSceneIdentifiers(a.identifier, b.identifier));
  await prisma.$transaction(
    scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene, index }) => scene.sequence !== index + 1)
      .map(({ scene, index }) =>
        prisma.scene.update({ where: { id: scene.id }, data: { sequence: index + 1 } }),
      ),
  );
}

const roleSchema = z.object({
  showId: z.string(),
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name fehlt.").max(120),
  description: optionalText(500),
  color: z.string().regex(hexColor).nullish(),
});

/** Rolle anlegen oder bearbeiten; gibt die ID zurück, damit das Panel offen bleiben kann. */
export async function saveRoleAction(
  input: z.input<typeof roleSchema>,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    await requireProductionManager();
    const data = roleSchema.parse(input);
    await assertShow(data.showId);
    const fields = { name: data.name, description: data.description, color: data.color ?? null };
    let id = data.id;
    if (id) {
      const character = await loadCharacter(id);
      if (character.showId !== data.showId) throw new Error("Rolle gehört nicht hierher.");
      await prisma.character.update({ where: { id }, data: fields });
    } else {
      const last = await prisma.character.aggregate({
        where: { showId: data.showId },
        _max: { order: true },
      });
      const created = await prisma.character.create({
        data: { ...fields, showId: data.showId, order: (last._max.order ?? -1) + 1 },
      });
      id = created.id;
    }
    revalidateRolesScenes();
    return { ...actionSuccess(), id };
  } catch (error) {
    return actionFailure(error, "Rolle konnte nicht gespeichert werden.");
  }
}

export async function deleteRoleAction(input: { id: string }): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const character = await loadCharacter(z.string().parse(input.id));
    await prisma.character.delete({ where: { id: character.id } });
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Rolle konnte nicht gelöscht werden.");
  }
}

const roleScenesSchema = z.object({
  characterId: z.string(),
  sceneIds: z.array(z.string()).max(500),
});

/** Szenen einer Rolle setzen (aus Sicht der Rolle); Hauptszene-Kennzeichen bleiben erhalten. */
export async function setRoleScenesAction(
  input: z.input<typeof roleScenesSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = roleScenesSchema.parse(input);
    const character = await loadCharacter(data.characterId);
    const valid = await prisma.scene.findMany({
      where: { showId: character.showId, id: { in: data.sceneIds } },
      select: { id: true },
    });
    const sceneIds = valid.map((scene) => scene.id);
    await prisma.$transaction([
      prisma.sceneCharacter.deleteMany({
        where: { characterId: character.id, sceneId: { notIn: sceneIds } },
      }),
      prisma.sceneCharacter.createMany({
        data: sceneIds.map((sceneId) => ({ sceneId, characterId: character.id })),
        skipDuplicates: true,
      }),
    ]);
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Szenen konnten nicht gespeichert werden.");
  }
}

const sceneSchema = z.object({
  showId: z.string(),
  id: z.string().optional(),
  identifier: z.string().trim().regex(sceneIdentifier, "Nummer wie 1 oder 1.3 angeben."),
  title: optionalText(160),
  location: optionalText(120),
  timeOfDay: optionalText(60),
  durationMinutes: z.number().int().min(0).max(600).nullish(),
  summary: optionalText(600),
  roles: z
    .array(z.object({ characterId: z.string(), featured: z.boolean() }))
    .max(200)
    .optional(),
});

export async function saveSceneAction(
  input: z.input<typeof sceneSchema>,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    await requireProductionManager();
    const data = sceneSchema.parse(input);
    await assertShow(data.showId);
    const duplicate = await prisma.scene.findFirst({
      where: {
        showId: data.showId,
        identifier: data.identifier,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new Error(`Szene ${data.identifier} gibt es schon.`);

    const fields = {
      identifier: data.identifier,
      title: data.title,
      location: data.location,
      timeOfDay: data.timeOfDay,
      durationMinutes: data.durationMinutes ?? null,
      summary: data.summary,
    };
    let id = data.id;
    if (id) {
      const scene = await loadScene(id);
      if (scene.showId !== data.showId) throw new Error("Szene gehört nicht hierher.");
      await prisma.scene.update({ where: { id }, data: fields });
    } else {
      const slug = await ensureUniqueSceneSlug(data.showId, slugify(data.identifier));
      const created = await prisma.scene.create({
        data: { ...fields, showId: data.showId, slug },
      });
      id = created.id;
    }

    if (data.roles) {
      const valid = await prisma.character.findMany({
        where: { showId: data.showId, id: { in: data.roles.map((entry) => entry.characterId) } },
        select: { id: true },
      });
      const roles = data.roles.filter((entry) =>
        valid.some((character) => character.id === entry.characterId),
      );
      const sceneId = id;
      await prisma.$transaction([
        prisma.sceneCharacter.deleteMany({ where: { sceneId } }),
        prisma.sceneCharacter.createMany({
          data: roles.map((entry, order) => ({
            sceneId,
            characterId: entry.characterId,
            isFeatured: entry.featured,
            order,
          })),
        }),
      ]);
    }

    await resequenceScenes(data.showId);
    revalidateRolesScenes();
    return { ...actionSuccess(), id };
  } catch (error) {
    return actionFailure(error, "Szene konnte nicht gespeichert werden.");
  }
}

export async function deleteSceneAction(input: { id: string }): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const scene = await loadScene(z.string().parse(input.id));
    await prisma.scene.delete({ where: { id: scene.id } });
    await resequenceScenes(scene.showId);
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Szene konnte nicht gelöscht werden.");
  }
}

const breakdownSchema = z.object({
  sceneId: z.string(),
  id: z.string().optional(),
  departmentId: z.string(),
  title: z.string().trim().min(1, "Was wird gebraucht?").max(160),
  status: z.enum(["planned", "in_progress", "blocked", "ready", "done"]),
  note: optionalText(300),
});

/** Ausstattung (Breakdown) einer Szene für ein Gewerk anlegen oder ändern. */
export async function saveBreakdownItemAction(
  input: z.input<typeof breakdownSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = breakdownSchema.parse(input);
    const scene = await loadScene(data.sceneId);
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, showId: scene.showId, archivedAt: null },
      select: { id: true },
    });
    if (!department) throw new Error("Gewerk wurde nicht gefunden.");
    const fields = {
      departmentId: department.id,
      title: data.title,
      status: data.status,
      note: data.note,
    };
    if (data.id) {
      const item = await prisma.sceneBreakdownItem.findFirst({
        where: { id: data.id, sceneId: scene.id },
        select: { id: true },
      });
      if (!item) throw new Error("Eintrag wurde nicht gefunden.");
      await prisma.sceneBreakdownItem.update({ where: { id: item.id }, data: fields });
    } else {
      await prisma.sceneBreakdownItem.create({ data: { ...fields, sceneId: scene.id } });
    }
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Ausstattung konnte nicht gespeichert werden.");
  }
}

export async function deleteBreakdownItemAction(input: {
  id: string;
}): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const id = z.string().parse(input.id);
    await prisma.sceneBreakdownItem.delete({ where: { id } });
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Eintrag konnte nicht gelöscht werden.");
  }
}
