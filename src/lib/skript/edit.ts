import { randomUUID } from "node:crypto";

import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { roleKey, splitSpeakerRoles, countWords } from "./roles";
import type { ScriptPart } from "./types";

/**
 * Bearbeiten (docs/Plan/skript-plan.md, Phase 10): Absätze im Entwurf korrigieren. Freigegebene
 * Fassungen bleiben unverändert (E5) – bearbeitet wird eine Kopie „(bearbeitet)“ als Entwurf, die
 * die `lineageId`s behält und über den Prüfschritt freigegeben wird.
 */

export class ScriptEditError extends Error {}

/** Kennzeichen im Feld `profileId` für Fassungen, die durch Bearbeiten entstanden sind. */
export const EDITED_PROFILE_ID = "bearbeitet";

const CUE_CATEGORIES = ["ton", "licht", "nebel", "effekt", "umbau", "aus", "technik"] as const;

const partSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("direction"), text: z.string() }),
  z.object({ kind: z.literal("cue"), text: z.string(), category: z.enum(CUE_CATEGORIES) }),
]);

export const blockEditSchema = z.object({
  kind: z.enum(["speech", "direction"]),
  speaker: z.string().max(200).nullable(),
  parts: z.array(partSchema).max(200),
});

export type BlockEdit = z.input<typeof blockEditSchema>;

/** Teile aufräumen: leere weg, Leerraum glätten. */
function cleanParts(parts: z.output<typeof blockEditSchema>["parts"]): ScriptPart[] {
  return parts
    .map((part) => ({ ...part, text: part.text.replace(/\s+/g, " ").trim() }))
    .filter((part) => part.text);
}

async function requireDraft(versionId: string) {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, showId: true, status: true },
  });
  if (!version) throw new ScriptEditError("Fassung nicht gefunden.");
  if (version.status !== "draft") {
    throw new ScriptEditError("Freigegebene Fassungen lassen sich nicht ändern.");
  }
  return version;
}

/**
 * Fassung zum Bearbeiten öffnen: Entwürfe direkt, freigegebene über eine Kopie als Entwurf (gibt
 * es schon eine bearbeitete Kopie dieser Fassung, wird sie weiterverwendet). Gibt die Kennung der
 * zu bearbeitenden Fassung zurück.
 */
export async function startEditing(versionId: string, userId: string) {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      showId: true,
      status: true,
      label: true,
      versionDate: true,
      sourceName: true,
      sourceSize: true,
      importReport: true,
    },
  });
  if (!version) throw new ScriptEditError("Fassung nicht gefunden.");
  if (version.status === "draft") return { id: version.id, created: false };

  const existing = await prisma.scriptVersion.findFirst({
    where: { basedOnId: version.id, status: "draft", profileId: EDITED_PROFILE_ID },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const [scenes, blocks] = await Promise.all([
    prisma.scriptScene.findMany({
      where: { versionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true },
    }),
    prisma.scriptBlock.findMany({
      where: { versionId },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        sceneId: true,
        sequence: true,
        lineageId: true,
        kind: true,
        speakerRaw: true,
        speaker: true,
        parts: true,
        page: true,
        wordCount: true,
        editedAt: true,
        editedById: true,
        roles: { select: { roleId: true } },
      },
    }),
  ]);

  const id = randomUUID();
  const sceneIds = new Map(scenes.map((scene) => [scene.id, randomUUID()]));
  const blockIds = new Map(blocks.map((block) => [block.id, randomUUID()]));
  await prisma.$transaction([
    prisma.scriptVersion.create({
      data: {
        id,
        showId: version.showId,
        label: `${version.label} (bearbeitet)`,
        versionDate: version.versionDate,
        // Kein Verweis aufs Original-PDF: Verwerfen des Entwurfs würde es sonst löschen.
        sourceName: version.sourceName,
        sourceSize: version.sourceSize,
        profileId: EDITED_PROFILE_ID,
        profileScore: 1,
        importReport: version.importReport ?? {},
        basedOnId: version.id,
        createdById: userId,
      },
    }),
    prisma.scriptScene.createMany({
      data: scenes.map((scene) => ({
        id: sceneIds.get(scene.id)!,
        versionId: id,
        sequence: scene.sequence,
        title: scene.title,
      })),
    }),
    prisma.scriptBlock.createMany({
      data: blocks.map((block) => ({
        id: blockIds.get(block.id)!,
        versionId: id,
        sceneId: sceneIds.get(block.sceneId)!,
        sequence: block.sequence,
        lineageId: block.lineageId,
        kind: block.kind,
        speakerRaw: block.speakerRaw,
        speaker: block.speaker,
        parts: block.parts ?? [],
        page: block.page,
        wordCount: block.wordCount,
        editedAt: block.editedAt,
        editedById: block.editedById,
      })),
    }),
    prisma.scriptBlockRole.createMany({
      data: blocks.flatMap((block) =>
        block.roles.map((role) => ({ blockId: blockIds.get(block.id)!, roleId: role.roleId })),
      ),
    }),
  ]);
  return { id, created: true };
}

/** Sprecher → Skript-Rollen über Namen und bestätigte Schreibweisen; Unbekannte bleiben offen. */
async function resolveRoles(showId: string, speaker: string | null) {
  if (!speaker) return [];
  const roles = await prisma.scriptRole.findMany({
    where: { showId },
    select: { id: true, name: true, aliases: true },
  });
  const byKey = new Map<string, string>();
  for (const role of roles) {
    byKey.set(roleKey(role.name), role.id);
    for (const alias of role.aliases) if (!byKey.has(alias)) byKey.set(alias, role.id);
  }
  const names = splitSpeakerRoles(speaker);
  const ids = names.map((name) => byKey.get(roleKey(name)));
  // Nur vollständig zuordnen – sonst fragt der Prüfschritt nach.
  return ids.every(Boolean) ? [...new Set(ids as string[])] : [];
}

function blockData(input: z.output<typeof blockEditSchema>, userId: string) {
  const parts = cleanParts(input.parts);
  if (!parts.length) throw new ScriptEditError("Der Absatz ist leer.");
  const speaker = input.kind === "speech" ? input.speaker?.trim() || null : null;
  if (input.kind === "speech" && !speaker) throw new ScriptEditError("Wer spricht?");
  return {
    parts,
    speaker,
    data: {
      kind: input.kind,
      speaker,
      speakerRaw: speaker,
      parts,
      wordCount: countWords({ kind: input.kind, speaker, parts, page: 0 }),
      editedAt: new Date(),
      editedById: userId,
    },
  };
}

/** Absatz im Entwurf ändern: Art, Sprecher, Teile. */
export async function editBlock(
  versionId: string,
  blockId: string,
  userId: string,
  raw: BlockEdit,
) {
  const version = await requireDraft(versionId);
  const input = blockEditSchema.parse(raw);
  const block = await prisma.scriptBlock.findFirst({
    where: { id: blockId, versionId },
    select: { id: true },
  });
  if (!block) throw new ScriptEditError("Absatz nicht gefunden.");
  const { data, speaker } = blockData(input, userId);
  const roleIds = await resolveRoles(version.showId, speaker);
  await prisma.$transaction([
    prisma.scriptBlock.update({ where: { id: blockId }, data }),
    prisma.scriptBlockRole.deleteMany({ where: { blockId } }),
    prisma.scriptBlockRole.createMany({ data: roleIds.map((roleId) => ({ blockId, roleId })) }),
  ]);
}

/** Neuen Absatz hinter einem bestehenden einfügen (gleiche Szene). */
export async function insertBlockAfter(
  versionId: string,
  afterBlockId: string,
  userId: string,
  raw: BlockEdit,
) {
  const version = await requireDraft(versionId);
  const input = blockEditSchema.parse(raw);
  const after = await prisma.scriptBlock.findFirst({
    where: { id: afterBlockId, versionId },
    select: { sceneId: true, sequence: true, page: true },
  });
  if (!after) throw new ScriptEditError("Absatz nicht gefunden.");
  const { data, speaker } = blockData(input, userId);
  const roleIds = await resolveRoles(version.showId, speaker);
  const id = randomUUID();
  await prisma.$transaction([
    prisma.scriptBlock.updateMany({
      where: { versionId, sequence: { gt: after.sequence } },
      data: { sequence: { increment: 1 } },
    }),
    prisma.scriptBlock.create({
      data: {
        ...data,
        id,
        versionId,
        sceneId: after.sceneId,
        sequence: after.sequence + 1,
        lineageId: randomUUID(),
        page: after.page,
      },
    }),
    prisma.scriptBlockRole.createMany({
      data: roleIds.map((roleId) => ({ blockId: id, roleId })),
    }),
  ]);
  return id;
}

/** Absatz aus dem Entwurf streichen. */
export async function deleteBlock(versionId: string, blockId: string) {
  await requireDraft(versionId);
  const block = await prisma.scriptBlock.findFirst({
    where: { id: blockId, versionId },
    select: { id: true },
  });
  if (!block) throw new ScriptEditError("Absatz nicht gefunden.");
  const left = await prisma.scriptBlock.count({ where: { versionId } });
  if (left <= 1) throw new ScriptEditError("Der letzte Absatz bleibt stehen.");
  await prisma.scriptBlock.delete({ where: { id: blockId } });
}
