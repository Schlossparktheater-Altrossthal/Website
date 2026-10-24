import { prisma } from "@/lib/prisma";

/**
 * Zwei Rollen eines Stücks zusammenführen (docs/Plan/skript-uebernahme-plan.md, Phase 6): Rolle
 * `sourceId` geht in `targetId` auf. Besetzung, Auftritte, Requisiten, Anforderungen,
 * Regie-Wünsche, Aufgaben und Skript-Verknüpfungen wandern mit; Doppeltes wird zusammengefasst.
 * Danach wird die leere Rolle gelöscht.
 */

export class CharacterMergeError extends Error {}

export type CharacterMergePreview = {
  castings: number;
  scenes: number;
  objects: number;
  requirements: number;
  wishes: number;
  tasks: number;
  scriptRoles: number;
};

async function loadPair(sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new CharacterMergeError("Rolle mit sich selbst?");
  const [source, target] = await Promise.all([
    prisma.character.findUnique({
      where: { id: sourceId },
      select: { id: true, showId: true, name: true },
    }),
    prisma.character.findUnique({
      where: { id: targetId },
      select: { id: true, showId: true, name: true },
    }),
  ]);
  if (!source || !target) throw new CharacterMergeError("Rolle nicht gefunden.");
  if (source.showId !== target.showId) {
    throw new CharacterMergeError("Die Rollen gehören zu verschiedenen Produktionen.");
  }
  return { source, target };
}

export async function previewCharacterMerge(
  sourceId: string,
  targetId: string,
): Promise<CharacterMergePreview> {
  await loadPair(sourceId, targetId);
  const where = { characterId: sourceId };
  const [castings, scenes, objects, requirements, wishes, tasks, scriptRoles] = await Promise.all([
    prisma.characterCasting.count({ where }),
    prisma.sceneCharacter.count({ where }),
    prisma.objectCharacter.count({ where }),
    prisma.sceneRequirement.count({ where }),
    prisma.directionWishTarget.count({ where }),
    prisma.eventNoteAssignee.count({ where }),
    prisma.scriptRoleLink.count({ where }),
  ]);
  return { castings, scenes, objects, requirements, wishes, tasks, scriptRoles };
}

export async function mergeCharacters(sourceId: string, targetId: string) {
  const { source, target } = await loadPair(sourceId, targetId);
  await prisma.$transaction(async (tx) => {
    // Besetzung: gleiche Person + Art gibt es nur einmal.
    const castings = await tx.characterCasting.findMany({
      where: { characterId: sourceId },
      select: { userId: true, type: true, notes: true },
    });
    await tx.characterCasting.createMany({
      data: castings.map((c) => ({ ...c, characterId: targetId })),
      skipDuplicates: true,
    });

    // Auftritte: vorhandene behalten, Hauptszene-Kennzeichen übernehmen.
    const appearances = await tx.sceneCharacter.findMany({
      where: { characterId: sourceId },
      select: { sceneId: true, isFeatured: true, note: true, order: true, source: true },
    });
    const existing = new Map(
      (
        await tx.sceneCharacter.findMany({
          where: { characterId: targetId },
          select: { id: true, sceneId: true, isFeatured: true, source: true },
        })
      ).map((a) => [a.sceneId, a]),
    );
    for (const a of appearances) {
      const there = existing.get(a.sceneId);
      if (!there) {
        await tx.sceneCharacter.create({ data: { ...a, characterId: targetId } });
      } else if (
        (a.isFeatured && !there.isFeatured) ||
        (a.source === "manual" && there.source !== "manual")
      ) {
        await tx.sceneCharacter.update({
          where: { id: there.id },
          data: {
            isFeatured: there.isFeatured || a.isFeatured,
            // Von Hand gepflegt schlägt „aus dem Skript“ – sonst könnte eine neue Fassung ihn entfernen.
            source: a.source === "manual" ? "manual" : there.source,
          },
        });
      }
    }

    const objects = await tx.objectCharacter.findMany({
      where: { characterId: sourceId },
      select: { objectId: true },
    });
    await tx.objectCharacter.createMany({
      data: objects.map((o) => ({ objectId: o.objectId, characterId: targetId })),
      skipDuplicates: true,
    });

    await tx.sceneRequirement.updateMany({
      where: { characterId: sourceId },
      data: { characterId: targetId },
    });
    await tx.directionWishTarget.updateMany({
      where: { characterId: sourceId },
      data: { characterId: targetId },
    });
    await tx.eventNoteAssignee.updateMany({
      where: { characterId: sourceId },
      data: { characterId: targetId },
    });

    const links = await tx.scriptRoleLink.findMany({
      where: { characterId: sourceId },
      select: { scriptRoleId: true, createdById: true },
    });
    await tx.scriptRoleLink.createMany({
      data: links.map((l) => ({ ...l, characterId: targetId })),
      skipDuplicates: true,
    });

    await tx.character.delete({ where: { id: sourceId } });
  });
  return { sourceName: source.name, targetName: target.name };
}
