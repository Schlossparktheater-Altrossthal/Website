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
import { getRoleSizeCodes } from "@/lib/produktionen/role-sizes";

const hexColor = /^#[0-9a-f]{6}$/i;

function revalidateRolesScenes() {
  revalidatePath("/mitglieder/produktionen/stueck");
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

/**
 * Nummern und Reihenfolge neu vergeben: `identifier` = „Akt.Position“, `sequence` fortlaufend.
 * `order` legt die neue Reihenfolge fest (IDs); sonst bleibt die bisherige.
 */
async function renumberScenes(showId: string, order?: { id: string; act: number }[]) {
  const scenes = await prisma.scene.findMany({
    where: { showId },
    orderBy: [{ act: "asc" }, { sequence: "asc" }],
    select: { id: true, act: true, identifier: true, sequence: true },
  });
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const ordered = order
    ? [
        ...order.flatMap((entry) => {
          const scene = byId.get(entry.id);
          return scene ? [{ ...scene, act: entry.act }] : [];
        }),
        ...scenes.filter((scene) => !order.some((entry) => entry.id === scene.id)),
      ].sort((a, b) => a.act - b.act)
    : scenes;
  const positions = new Map<number, number>();
  const updates = ordered.flatMap((scene, index) => {
    const position = (positions.get(scene.act) ?? 0) + 1;
    positions.set(scene.act, position);
    const identifier = `${scene.act}.${position}`;
    const current = byId.get(scene.id);
    if (
      current?.identifier === identifier &&
      current.sequence === index + 1 &&
      current.act === scene.act
    ) {
      return [];
    }
    return [
      prisma.scene.update({
        where: { id: scene.id },
        data: { act: scene.act, identifier, sequence: index + 1 },
      }),
    ];
  });
  if (updates.length) await prisma.$transaction(updates);
  // Akte bleiben bestehen, auch wenn sie leer werden (löschen nur ausdrücklich).
  await prisma.showAct.createMany({
    data: [...new Set(ordered.map((scene) => scene.act))].map((number) => ({ showId, number })),
    skipDuplicates: true,
  });
}

const roleSchema = z.object({
  showId: z.string(),
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name fehlt.").max(120),
  description: optionalText(500),
  color: z.string().regex(hexColor).nullish(),
  size: z
    .string()
    .nullish()
    .refine((value) => !value || getRoleSizeCodes().includes(value), "Unbekannte Rollengröße."),
});

/** Rolle anlegen oder bearbeiten; gibt die ID zurück, damit das Panel offen bleiben kann. */
export async function saveRoleAction(
  input: z.input<typeof roleSchema>,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    await requireProductionManager();
    const data = roleSchema.parse(input);
    await assertShow(data.showId);
    const fields = {
      name: data.name,
      description: data.description,
      color: data.color ?? null,
      rolePreferenceCode: data.size || null,
    };
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
  act: z.number().int().min(1).max(20),
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

/** Szene anlegen (ans Ende des Akts) oder bearbeiten; Akt-Wechsel hängt sie dort hinten an. */
export async function saveSceneAction(
  input: z.input<typeof sceneSchema>,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    await requireProductionManager();
    const data = sceneSchema.parse(input);
    await assertShow(data.showId);
    const fields = {
      act: data.act,
      title: data.title,
      location: data.location,
      timeOfDay: data.timeOfDay,
      durationMinutes: data.durationMinutes ?? null,
      summary: data.summary,
    };
    const last = await prisma.scene.aggregate({
      where: { showId: data.showId },
      _max: { sequence: true },
    });
    const end = (last._max.sequence ?? 0) + 1;
    let id = data.id;
    if (id) {
      const scene = await prisma.scene.findUnique({
        where: { id },
        select: { showId: true, act: true },
      });
      if (!scene || scene.showId !== data.showId) throw new Error("Szene wurde nicht gefunden.");
      await prisma.scene.update({
        where: { id },
        data: { ...fields, ...(scene.act !== data.act ? { sequence: end } : {}) },
      });
    } else {
      const slug = await ensureUniqueSceneSlug(data.showId, slugify(`szene-${Date.now()}`));
      const created = await prisma.scene.create({
        data: { ...fields, showId: data.showId, slug, sequence: end },
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

    await renumberScenes(data.showId);
    revalidateRolesScenes();
    return { ...actionSuccess(), id };
  } catch (error) {
    return actionFailure(error, "Szene konnte nicht gespeichert werden.");
  }
}

const orderSchema = z.object({
  showId: z.string(),
  order: z.array(z.object({ id: z.string(), act: z.number().int().min(1).max(20) })).max(500),
});

/** Neue Reihenfolge aller Szenen (Ziehen oder Hoch/Runter); vergibt die Nummern neu. */
export async function reorderScenesAction(
  input: z.input<typeof orderSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = orderSchema.parse(input);
    await assertShow(data.showId);
    await renumberScenes(data.showId, data.order);
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Reihenfolge konnte nicht gespeichert werden.");
  }
}

const actSchema = z.object({
  showId: z.string(),
  number: z.number().int().min(1).max(20),
  title: optionalText(80),
});

/** Akt anlegen oder umbenennen. */
export async function saveActAction(
  input: z.input<typeof actSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = actSchema.parse(input);
    await assertShow(data.showId);
    await prisma.showAct.upsert({
      where: { showId_number: { showId: data.showId, number: data.number } },
      create: { showId: data.showId, number: data.number, title: data.title },
      update: { title: data.title },
    });
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Akt konnte nicht gespeichert werden.");
  }
}

/** Leeren Akt entfernen. */
export async function deleteActAction(input: {
  showId: string;
  number: number;
}): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = actSchema.pick({ showId: true, number: true }).parse(input);
    const scenes = await prisma.scene.count({ where: { showId: data.showId, act: data.number } });
    if (scenes) throw new Error("Im Akt sind noch Szenen. Verschiebe oder lösche sie zuerst.");
    await prisma.showAct.deleteMany({ where: { showId: data.showId, number: data.number } });
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Akt konnte nicht gelöscht werden.");
  }
}

const cellSchema = z.object({
  sceneId: z.string(),
  characterId: z.string(),
  state: z.enum(["none", "in", "featured"]),
});

/** Eine Zelle im Auftrittsplan: Rolle in Szene nicht dabei, dabei oder Hauptszene. */
export async function setSceneRoleAction(
  input: z.input<typeof cellSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const data = cellSchema.parse(input);
    const [scene, character] = await Promise.all([
      loadScene(data.sceneId),
      loadCharacter(data.characterId),
    ]);
    if (scene.showId !== character.showId) throw new Error("Rolle gehört nicht zum Stück.");
    const key = { sceneId_characterId: { sceneId: scene.id, characterId: character.id } };
    if (data.state === "none") {
      await prisma.sceneCharacter.deleteMany({
        where: { sceneId: scene.id, characterId: character.id },
      });
    } else {
      await prisma.sceneCharacter.upsert({
        where: key,
        create: {
          sceneId: scene.id,
          characterId: character.id,
          isFeatured: data.state === "featured",
        },
        update: { isFeatured: data.state === "featured" },
      });
    }
    revalidateRolesScenes();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Auftritt konnte nicht gespeichert werden.");
  }
}

export async function deleteSceneAction(input: { id: string }): Promise<ProductionActionResult> {
  try {
    await requireProductionManager();
    const scene = await loadScene(z.string().parse(input.id));
    await prisma.scene.delete({ where: { id: scene.id } });
    await renumberScenes(scene.showId);
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
