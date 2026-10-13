import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { safeFileName } from "@/lib/media/event-media";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/produktionen/actions-helpers";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";

import { isPdf, parseScriptPdf } from "./import";
import { countWords, roleKey, roleStatistics, type RoleTypoSuspect } from "./roles";

/** DB-Zugriff für Skript-Fassungen (docs/Plan/skript-plan.md, Phase 2). */

export const SCRIPT_READ_PERMISSION = "PRIVATE.PRODUCTION.SCRIPT.READ";
export const SCRIPT_MANAGE_PERMISSION = "PRIVATE.PRODUCTION.SCRIPT.MANAGE";

export const SCRIPT_PDF_MAX_BYTES = 25 * 1024 * 1024;

export class ScriptImportError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "ScriptImportError";
  }
}

export type ScriptImportReport = {
  /** Schreibweise → zusammengeführte Rolle. */
  mergedRoles: [string, string][];
  roleTypos: RoleTypoSuspect[];
  uncertainCues: number;
  /** Rollen dieser Fassung; `known` = schon als Skript-Rolle des Stücks bestätigt. */
  speakers: { name: string; lines: number; words: number; known: boolean }[];
  scenes: number;
  blocks: number;
};

/** Bestätigte Schreibweisen des Stücks: normalisierter Schlüssel → Rollenname. */
async function loadRoleAliases(showId: string) {
  const roles = await prisma.scriptRole.findMany({
    where: { showId },
    select: { name: true, aliases: true },
  });
  const aliases = new Map<string, string>();
  for (const role of roles) {
    aliases.set(roleKey(role.name), role.name);
    for (const alias of role.aliases) aliases.set(alias, role.name);
  }
  return { aliases, known: new Set(roles.map((r) => r.name)) };
}

function storageFolder(show: { year: number; title: string | null }) {
  const production = `${show.year}${show.title ? `-${slugify(show.title)}` : ""}`;
  return `produktionen/${production}/skript/`;
}

/**
 * PDF einlesen und als Entwurf speichern. Das Original geht in den S3-Speicher (falls
 * eingerichtet); Urheber und Zeitpunkt werden immer festgehalten.
 */
export async function importScriptDraft(input: {
  showId: string;
  userId: string;
  fileName: string;
  data: Uint8Array;
  label?: string | null;
  versionDate?: Date | null;
}) {
  if (!isPdf(input.data)) throw new ScriptImportError("Die Datei ist kein PDF.", 415);
  if (input.data.byteLength > SCRIPT_PDF_MAX_BYTES) {
    throw new ScriptImportError("Das PDF ist zu groß (höchstens 25 MB).", 413);
  }
  const show = await prisma.show.findUnique({
    where: { id: input.showId },
    select: { id: true, year: true, title: true },
  });
  if (!show) throw new ScriptImportError("Produktion nicht gefunden.", 404);

  const { aliases, known } = await loadRoleAliases(show.id);
  let parsed: Awaited<ReturnType<typeof parseScriptPdf>>;
  try {
    parsed = await parseScriptPdf(input.data, { aliases });
  } catch (error) {
    console.error("[skript] PDF nicht lesbar", error);
    throw new ScriptImportError("Das PDF konnte nicht gelesen werden.");
  }
  const blockCount = parsed.scenes.reduce((sum, scene) => sum + scene.blocks.length, 0);
  if (!blockCount) {
    throw new ScriptImportError(
      "Im PDF wurde kein Text gefunden (eingescannt?). Bitte die Word-Datei als PDF exportieren.",
    );
  }

  const id = randomUUID();
  let source: { bucket: string; key: string } | null = null;
  if (isStorageConfigured()) {
    const name = safeFileName(input.fileName || "skript.pdf");
    source = await putObject(`${storageFolder(show)}${id}-${name}`, input.data, "application/pdf");
  }

  const report: ScriptImportReport = {
    mergedRoles: [...parsed.mergedRoles.entries()],
    roleTypos: parsed.roleTypos,
    uncertainCues: parsed.uncertainCues,
    speakers: roleStatistics(parsed.scenes).map((r) => ({
      name: r.name,
      lines: r.lines,
      words: r.words,
      known: known.has(r.name),
    })),
    scenes: parsed.scenes.length,
    blocks: blockCount,
  };

  const basedOn = await prisma.scriptVersion.findFirst({
    where: { showId: show.id },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  const scenes: Prisma.ScriptSceneCreateManyInput[] = [];
  const blocks: Prisma.ScriptBlockCreateManyInput[] = [];
  let sequence = 0;
  parsed.scenes.forEach((scene, sceneIndex) => {
    const sceneId = randomUUID();
    scenes.push({ id: sceneId, versionId: id, sequence: sceneIndex, title: scene.title });
    for (const block of scene.blocks) {
      blocks.push({
        versionId: id,
        sceneId,
        sequence: sequence++,
        // Phase 3 übernimmt die lineageId zugeordneter Absätze der Vorfassung.
        lineageId: randomUUID(),
        kind: block.kind,
        speakerRaw: block.speaker
          ? ([...parsed.mergedRoles.entries()].find(([, to]) => to === block.speaker)?.[0] ??
            block.speaker)
          : null,
        speaker: block.speaker,
        parts: block.parts,
        page: block.page,
        wordCount: countWords(block),
      });
    }
  });

  await prisma.$transaction([
    prisma.scriptVersion.create({
      data: {
        id,
        showId: show.id,
        label: input.label?.trim() || input.fileName.replace(/\.pdf$/i, ""),
        versionDate: input.versionDate ?? null,
        sourceBucket: source?.bucket ?? null,
        sourceKey: source?.key ?? null,
        sourceName: input.fileName,
        sourceSize: input.data.byteLength,
        profileId: parsed.profile.id,
        profileScore: parsed.score,
        importReport: report,
        basedOnId: basedOn?.id ?? null,
        createdById: input.userId,
      },
    }),
    prisma.scriptScene.createMany({ data: scenes }),
    prisma.scriptBlock.createMany({ data: blocks }),
  ]);
  return { id, report };
}

/** Fassungen eines Stücks; Entwürfe nur für Verwalter. */
export function listScriptVersions(showId: string, options: { includeDrafts: boolean }) {
  return prisma.scriptVersion.findMany({
    where: { showId, ...(options.includeDrafts ? {} : { status: "released" }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      versionDate: true,
      status: true,
      sourceName: true,
      profileId: true,
      importReport: true,
      createdAt: true,
      releasedAt: true,
      createdBy: { select: { id: true, name: true } },
      releasedBy: { select: { id: true, name: true } },
    },
  });
}
