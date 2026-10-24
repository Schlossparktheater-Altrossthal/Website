import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { safeFileName } from "@/lib/media/event-media";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/produktionen/actions-helpers";
import { deleteObjects, getObject, isStorageConfigured, putObject } from "@/lib/storage/s3";

import { readScriptCredits, type ScriptCredit } from "./credits";
import { isPdf, parseScriptPdf } from "./import";
import { countWords, roleKey, roleStatistics, type RoleTypoSuspect } from "./roles";
import { sceneTitleKey } from "./stats";

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
  /** Mitwirkende aus dem Vorspann dieser Fassung. */
  credits: ScriptCredit[];
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
    select: { id: true, year: true, title: true, scriptCredits: true },
  });
  if (!show) throw new ScriptImportError("Produktion nicht gefunden.", 404);

  let source: ScriptSource | null = null;
  if (isStorageConfigured()) {
    const name = safeFileName(input.fileName || "skript.pdf");
    source = await putObject(
      `${storageFolder(show)}${randomUUID()}-${name}`,
      input.data,
      "application/pdf",
    );
  }
  const meta = {
    label: input.label?.trim() || input.fileName.replace(/\.pdf$/i, ""),
    versionDate: input.versionDate ?? null,
    sourceName: input.fileName,
    sourceSize: input.data.byteLength,
    userId: input.userId,
  };

  const attempt = await tryParse(show.id, input.data);
  if (!attempt.ok) {
    // Ohne Speicher lässt sich nichts aufheben – dann wie früher sofort abweisen.
    if (!source) throw new ScriptImportError(attempt.message);
    const pending = await prisma.scriptPendingImport.create({
      data: {
        showId: show.id,
        label: meta.label,
        versionDate: meta.versionDate,
        sourceBucket: source.bucket,
        sourceKey: source.key,
        sourceName: meta.sourceName,
        sourceSize: meta.sourceSize,
        error: attempt.error,
        createdById: input.userId,
      },
      select: { id: true },
    });
    console.error(`[skript] PDF aufgehoben, Parser muss angepasst werden (${pending.id})`);
    return { pending: true as const, id: pending.id };
  }
  return { pending: false as const, ...(await saveVersion(show, attempt, source, meta)) };
}

type ScriptSource = { bucket: string; key: string };
type ParseAttempt =
  | ({ ok: true; known: Set<string>; blockCount: number } & Awaited<
      ReturnType<typeof parseScriptPdf>
    >)
  | { ok: false; message: string; error: string };

async function tryParse(showId: string, data: Uint8Array): Promise<ParseAttempt> {
  const { aliases, known } = await loadRoleAliases(showId);
  let parsed: Awaited<ReturnType<typeof parseScriptPdf>>;
  try {
    parsed = await parseScriptPdf(data, { aliases });
  } catch (error) {
    console.error("[skript] PDF nicht lesbar", error);
    return {
      ok: false,
      message: "Das PDF konnte nicht gelesen werden.",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
  const blockCount = parsed.scenes.reduce((sum, scene) => sum + scene.blocks.length, 0);
  if (!blockCount) {
    return {
      ok: false,
      message:
        "Im PDF wurde kein Text gefunden (eingescannt?). Bitte die Word-Datei als PDF exportieren.",
      error: `Kein Absatz erkannt (Profil ${parsed.profile.id}, Quote ${parsed.score.toFixed(2)})`,
    };
  }
  return { ok: true, known, blockCount, ...parsed };
}

async function saveVersion(
  show: { id: string; scriptCredits: Prisma.JsonValue },
  parsed: Extract<ParseAttempt, { ok: true }>,
  source: ScriptSource | null,
  meta: {
    label: string;
    versionDate: Date | null;
    sourceName: string;
    sourceSize: number;
    userId: string;
  },
  extra: Prisma.PrismaPromise<unknown>[] = [],
) {
  const { known, blockCount } = parsed;
  const id = randomUUID();

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
    credits: parsed.credits,
  };
  // Erste Fassung mit Angaben füllt die Mitwirkenden der Produktion; danach fragt der Prüfschritt.
  const saveCredits = parsed.credits.length > 0 && !readScriptCredits(show.scriptCredits).length;

  const basedOn = await prisma.scriptVersion.findFirst({
    where: { showId: show.id },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  // Gemessene Szenenzeiten der Vorfassung übernehmen (gleicher Titel).
  const measured = new Map(
    basedOn
      ? (
          await prisma.scriptScene.findMany({
            where: { versionId: basedOn.id, measuredSeconds: { not: null } },
            select: { title: true, measuredSeconds: true },
          })
        ).map((scene) => [sceneTitleKey(scene.title), scene.measuredSeconds])
      : [],
  );
  // Vorläufiger Szenen-Schlüssel über den Titel; die Freigabe vererbt ihn über die Absätze.
  const titleKeys = new Map(
    basedOn
      ? (
          await prisma.scriptScene.findMany({
            where: { versionId: basedOn.id },
            select: { title: true, sceneKey: true },
          })
        ).map((scene) => [sceneTitleKey(scene.title), scene.sceneKey])
      : [],
  );

  const scenes: Prisma.ScriptSceneCreateManyInput[] = [];
  const blocks: Prisma.ScriptBlockCreateManyInput[] = [];
  let sequence = 0;
  parsed.scenes.forEach((scene, sceneIndex) => {
    const sceneId = randomUUID();
    scenes.push({
      id: sceneId,
      versionId: id,
      sequence: sceneIndex,
      title: scene.title,
      sceneKey: titleKeys.get(sceneTitleKey(scene.title)) ?? randomUUID(),
      measuredSeconds: measured.get(sceneTitleKey(scene.title)) ?? null,
    });
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
        label: meta.label,
        versionDate: meta.versionDate,
        sourceBucket: source?.bucket ?? null,
        sourceKey: source?.key ?? null,
        sourceName: meta.sourceName,
        sourceSize: meta.sourceSize,
        profileId: parsed.profile.id,
        profileScore: parsed.score,
        importReport: report,
        basedOnId: basedOn?.id ?? null,
        createdById: meta.userId,
      },
    }),
    prisma.scriptScene.createMany({ data: scenes }),
    prisma.scriptBlock.createMany({ data: blocks }),
    ...(saveCredits
      ? [prisma.show.update({ where: { id: show.id }, data: { scriptCredits: parsed.credits } })]
      : []),
    ...extra,
  ]);
  return { id, report };
}

/** Aufgehobene PDFs eines Stücks, die der Parser noch nicht lesen konnte. */
export function listPendingImports(showId: string) {
  return prisma.scriptPendingImport.findMany({
    where: { showId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      sourceName: true,
      error: true,
      attempts: true,
      lastTriedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

/**
 * Aufgehobenes PDF erneut einlesen (nach einer Parser-Anpassung). Klappt es, entsteht ein Entwurf
 * mit demselben Original; sonst wird der Versuch gezählt.
 */
export async function retryPendingImport(pendingId: string, userId: string) {
  const pending = await prisma.scriptPendingImport.findUnique({ where: { id: pendingId } });
  if (!pending) throw new ScriptImportError("Upload nicht gefunden.", 404);
  const show = await prisma.show.findUniqueOrThrow({
    where: { id: pending.showId },
    select: { id: true, scriptCredits: true },
  });
  const object = await getObject(pending.sourceBucket, pending.sourceKey);
  if (!object.body) throw new ScriptImportError("Das Original-PDF ist leer.");
  const data = new Uint8Array(await new Response(object.body).arrayBuffer());

  const attempt = await tryParse(show.id, data);
  if (!attempt.ok) {
    await prisma.scriptPendingImport.update({
      where: { id: pendingId },
      data: { error: attempt.error, attempts: { increment: 1 }, lastTriedAt: new Date() },
    });
    throw new ScriptImportError("Der Parser kommt mit diesem PDF immer noch nicht klar.");
  }
  return saveVersion(
    show,
    attempt,
    { bucket: pending.sourceBucket, key: pending.sourceKey },
    {
      label: pending.label,
      versionDate: pending.versionDate,
      sourceName: pending.sourceName,
      sourceSize: pending.sourceSize,
      // Urheber bleibt, wer das PDF hochgeladen hat.
      userId: pending.createdById ?? userId,
    },
    [prisma.scriptPendingImport.delete({ where: { id: pendingId } })],
  );
}

/** Aufgehobenes PDF verwerfen, Original aus dem Speicher löschen. */
export async function deletePendingImport(pendingId: string) {
  const pending = await prisma.scriptPendingImport.delete({ where: { id: pendingId } });
  await deleteObjects([{ bucket: pending.sourceBucket, key: pending.sourceKey }]).catch((error) =>
    console.error("[skript] Original-PDF nicht gelöscht", error),
  );
}

/** Fassungen eines Stücks; Entwürfe nur für Verwalter. */
export async function listScriptVersions(showId: string, options: { includeDrafts: boolean }) {
  const versions = await prisma.scriptVersion.findMany({
    where: { showId, ...(options.includeDrafts ? {} : { status: "released" }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      versionDate: true,
      status: true,
      sourceName: true,
      sourceKey: true,
      profileId: true,
      importReport: true,
      createdAt: true,
      releasedAt: true,
      createdBy: { select: { id: true, name: true } },
      releasedBy: { select: { id: true, name: true } },
    },
  });
  return versions.map(({ sourceKey, ...version }) => ({
    ...version,
    hasSource: Boolean(sourceKey),
  }));
}
