import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteObjects, getObject } from "@/lib/storage/s3";

import { newCreditNames, readScriptCredits, type ScriptCredit } from "./credits";
import { align, blockSimilarity, similarity } from "./diff";
import { parseScriptPdf } from "./import";
import { readImportReport, readParts } from "./json";
import { jaroWinkler, roleKey, splitSpeakerRoles } from "./roles";
import type { ScriptImportReport } from "./service";
import type { ScriptBlock } from "./types";

/** Prüfschritt und Freigabe einer Fassung (docs/Plan/skript-plan.md, Phase 3). */

export class ScriptReviewError extends Error {}

export type ReviewRoleEntry = {
  /** Einzelne Rolle aus dem Skript (gemeinsame Repliken „A/B“ schon aufgeteilt). */
  name: string;
  /** Schreibweisen im PDF, die hierauf zusammengeführt wurden. */
  spellings: string[];
  lines: number;
  words: number;
  /** Aktuell gespeicherte Zuordnung. */
  roleId: string | null;
  /** Vorschlag: bestehende Skript-Rolle mit gleichem/ähnlichem Namen. */
  suggestedRoleId: string | null;
};

export type ReviewCue = {
  blockId: string;
  partIndex: number;
  sceneTitle: string;
  speaker: string | null;
  text: string;
  category: string;
  before: string;
  after: string;
};

export type ScriptReviewData = {
  version: {
    id: string;
    showId: string;
    label: string;
    status: "draft" | "released";
    sourceName: string;
    /** Original-PDF liegt im Speicher (fehlt z. B. bei bearbeiteten Kopien). */
    hasSource: boolean;
    createdAt: Date;
    createdByName: string | null;
    releasedAt: Date | null;
    releasedByName: string | null;
    report: ScriptImportReport;
    basedOnLabel: string | null;
  };
  roles: { id: string; name: string }[];
  entries: ReviewRoleEntry[];
  cues: ReviewCue[];
  /** Mitwirkende der Produktion und was diese Fassung im Vorspann nennt. */
  credits: { saved: ScriptCredit[]; found: ScriptCredit[]; newNames: string[] };
  /** Was vor der Freigabe noch fehlt. */
  blockers: string[];
};

function suggestRole(name: string, roles: { id: string; name: string; aliases: string[] }[]) {
  const key = roleKey(name);
  const exact = roles.find((r) => roleKey(r.name) === key || r.aliases.includes(key));
  if (exact) return exact.id;
  let best: { id: string; score: number } | null = null;
  for (const role of roles) {
    const score = jaroWinkler(key, roleKey(role.name));
    if (score > 0.92 && (!best || score > best.score)) best = { id: role.id, score };
  }
  return best?.id ?? null;
}

export async function loadScriptReview(versionId: string): Promise<ScriptReviewData | null> {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      showId: true,
      label: true,
      status: true,
      sourceName: true,
      sourceKey: true,
      createdAt: true,
      releasedAt: true,
      importReport: true,
      createdBy: { select: { name: true } },
      releasedBy: { select: { name: true } },
      basedOn: { select: { label: true } },
      show: { select: { scriptCredits: true } },
      blocks: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          speaker: true,
          speakerRaw: true,
          parts: true,
          wordCount: true,
          scene: { select: { title: true } },
          roles: { select: { roleId: true, role: { select: { name: true } } } },
        },
      },
    },
  });
  if (!version) return null;
  const roles = await prisma.scriptRole.findMany({
    where: { showId: version.showId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, aliases: true },
  });

  const entries = new Map<string, ReviewRoleEntry>();
  const cues: ReviewCue[] = [];
  let unassigned = 0;
  for (const block of version.blocks) {
    const parts = readParts(block.parts);
    if (block.speaker) {
      const names = splitSpeakerRoles(block.speaker);
      if (!block.roles.length) unassigned++;
      for (const name of names) {
        const entry = entries.get(name) ?? {
          name,
          spellings: [],
          lines: 0,
          words: 0,
          roleId: null,
          suggestedRoleId: suggestRole(name, roles),
        };
        entry.lines++;
        entry.words += block.wordCount;
        if (block.speakerRaw && names.length === 1 && !entry.spellings.includes(block.speakerRaw)) {
          entry.spellings.push(block.speakerRaw);
        }
        const assigned =
          block.roles.length === 1
            ? block.roles[0]
            : block.roles.find((r) => roleKey(r.role.name) === roleKey(name));
        if (assigned) entry.roleId = assigned.roleId;
        entries.set(name, entry);
      }
    }
    parts.forEach((part, partIndex) => {
      if (part.kind !== "cue" || !part.auto) return;
      cues.push({
        blockId: block.id,
        partIndex,
        sceneTitle: block.scene.title,
        speaker: block.speaker,
        text: part.text,
        category: part.category,
        before: parts[partIndex - 1]?.text.slice(-80) ?? "",
        after: parts[partIndex + 1]?.text.slice(0, 80) ?? "",
      });
    });
  }

  const blockers: string[] = [];
  if (unassigned) {
    blockers.push(
      `${unassigned} ${unassigned === 1 ? "Replik" : "Repliken"} ohne bestätigte Rolle`,
    );
  }
  if (cues.length) {
    blockers.push(
      `${cues.length} ${cues.length === 1 ? "unsicherer Hinweis" : "unsichere Hinweise"}`,
    );
  }

  const report = readImportReport(version.importReport);
  const saved = readScriptCredits(version.show.scriptCredits);
  return {
    version: {
      id: version.id,
      showId: version.showId,
      label: version.label,
      status: version.status,
      sourceName: version.sourceName,
      hasSource: Boolean(version.sourceKey),
      createdAt: version.createdAt,
      createdByName: version.createdBy?.name ?? null,
      releasedAt: version.releasedAt,
      releasedByName: version.releasedBy?.name ?? null,
      report,
      basedOnLabel: version.basedOn?.label ?? null,
    },
    roles: roles.map(({ id, name }) => ({ id, name })),
    entries: [...entries.values()].sort((a, b) => b.words - a.words),
    cues,
    credits: { saved, found: report.credits, newNames: newCreditNames(saved, report.credits) },
    blockers,
  };
}

async function requireDraft(versionId: string) {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, showId: true, status: true, sourceBucket: true, sourceKey: true },
  });
  if (!version) throw new ScriptReviewError("Fassung nicht gefunden.");
  if (version.status !== "draft") {
    throw new ScriptReviewError("Freigegebene Fassungen lassen sich nicht mehr ändern.");
  }
  return version;
}

export type RoleAssignment = { name: string } & ({ roleId: string } | { createName: string });

/**
 * Rollen bestätigen: neue Skript-Rollen anlegen, Schreibweisen als Alias merken (gelten für alle
 * künftigen Fassungen) und alle Repliken der Fassung zuordnen.
 */
export async function saveRoleAssignments(
  versionId: string,
  userId: string,
  assignments: RoleAssignment[],
) {
  const version = await requireDraft(versionId);
  const blocks = await prisma.scriptBlock.findMany({
    where: { versionId, speaker: { not: null } },
    select: { id: true, speaker: true, speakerRaw: true },
  });

  await prisma.$transaction(async (tx) => {
    const roles = await tx.scriptRole.findMany({
      where: { showId: version.showId },
      select: { id: true, name: true, aliases: true },
    });
    const byId = new Map(roles.map((r) => [r.id, r]));
    const target = new Map<string, string>();
    for (const assignment of assignments) {
      let roleId: string;
      if ("roleId" in assignment) {
        if (!byId.has(assignment.roleId)) throw new ScriptReviewError("Rolle nicht gefunden.");
        roleId = assignment.roleId;
      } else {
        const name = assignment.createName.trim();
        if (!name) throw new ScriptReviewError(`Name für „${assignment.name}“ fehlt.`);
        const existing = roles.find((r) => roleKey(r.name) === roleKey(name));
        if (existing) {
          roleId = existing.id;
        } else {
          const created = await tx.scriptRole.create({
            data: { showId: version.showId, name, createdById: userId },
            select: { id: true, name: true, aliases: true },
          });
          roles.push(created);
          byId.set(created.id, created);
          roleId = created.id;
        }
      }
      target.set(roleKey(assignment.name), roleId);
    }

    const links: Prisma.ScriptBlockRoleCreateManyInput[] = [];
    const newAliases = new Map<string, Set<string>>();
    for (const block of blocks) {
      const names = splitSpeakerRoles(block.speaker!);
      for (const name of names) {
        const roleId = target.get(roleKey(name));
        if (!roleId) continue;
        links.push({ blockId: block.id, roleId });
        const aliases = newAliases.get(roleId) ?? new Set<string>();
        aliases.add(roleKey(name));
        if (names.length === 1 && block.speakerRaw) aliases.add(roleKey(block.speakerRaw));
        newAliases.set(roleId, aliases);
      }
    }
    await tx.scriptBlockRole.deleteMany({ where: { block: { versionId } } });
    await tx.scriptBlockRole.createMany({ data: links, skipDuplicates: true });
    for (const [roleId, aliases] of newAliases) {
      const role = byId.get(roleId)!;
      const merged = [...new Set([...role.aliases, ...aliases])].filter(
        (alias) => alias !== roleKey(role.name),
      );
      if (merged.length !== role.aliases.length) {
        await tx.scriptRole.update({ where: { id: roleId }, data: { aliases: merged } });
      }
    }
  });
}

/** Unsicheren Hinweis bestätigen oder als Text/Regie umdeuten. */
export async function resolveUncertainCue(
  versionId: string,
  blockId: string,
  partIndex: number,
  as: "cue" | "text" | "direction",
) {
  await requireDraft(versionId);
  const block = await prisma.scriptBlock.findFirst({
    where: { id: blockId, versionId },
    select: { parts: true },
  });
  if (!block) throw new ScriptReviewError("Absatz nicht gefunden.");
  const parts = readParts(block.parts);
  const part = parts[partIndex];
  if (!part || part.kind !== "cue") throw new ScriptReviewError("Hinweis nicht gefunden.");
  parts[partIndex] =
    as === "cue"
      ? { kind: "cue", text: part.text, category: part.category }
      : { kind: as, text: part.text };
  await prisma.scriptBlock.update({ where: { id: blockId }, data: { parts } });
}

type LineageBlock = ScriptBlock & { id: string; lineageId: string };

async function loadLineageBlocks(versionId: string) {
  const scenes = await prisma.scriptScene.findMany({
    where: { versionId },
    orderBy: { sequence: "asc" },
    select: {
      title: true,
      blocks: {
        orderBy: { sequence: "asc" },
        select: { id: true, lineageId: true, kind: true, speaker: true, parts: true, page: true },
      },
    },
  });
  return scenes.map((scene) => ({
    title: scene.title,
    blocks: scene.blocks.map((b): LineageBlock => ({
      id: b.id,
      lineageId: b.lineageId,
      kind: b.kind,
      speaker: b.speaker,
      parts: readParts(b.parts),
      page: b.page ?? 0,
    })),
  }));
}

/**
 * Zugeordnete Absätze erben die `lineageId` der letzten freigegebenen Fassung – daran hängen
 * Kommentare und Markierungen. Gibt Absatz-ID → geerbte lineageId zurück.
 */
export async function inheritLineage(versionId: string, previousId: string) {
  const [current, previous] = await Promise.all([
    loadLineageBlocks(versionId),
    loadLineageBlocks(previousId),
  ]);
  const result = new Map<string, string>();
  for (const [before, after] of align(
    previous,
    current,
    (a, b) => similarity(a.title, b.title),
    0.4,
  )) {
    if (!before || !after) continue;
    for (const [x, y] of align(before.blocks, after.blocks, blockSimilarity, 0.5)) {
      if (x && y) result.set(y.id, x.lineageId);
    }
  }
  return result;
}

/**
 * Wie `inheritLineage`, lässt aber Absätze in Ruhe, die schon eine `lineageId` der Vorfassung
 * tragen (bearbeitete Kopie, Phase 10) – und vergibt keine `lineageId` doppelt.
 */
async function keepOwnLineage(versionId: string, previousId: string) {
  const [inherited, current, before] = await Promise.all([
    inheritLineage(versionId, previousId),
    prisma.scriptBlock.findMany({ where: { versionId }, select: { id: true, lineageId: true } }),
    prisma.scriptBlock.findMany({ where: { versionId: previousId }, select: { lineageId: true } }),
  ]);
  const known = new Set(before.map((block) => block.lineageId));
  const kept = new Set(
    current.filter((block) => known.has(block.lineageId)).map((block) => block.lineageId),
  );
  if (!kept.size) return inherited;
  const own = new Map(current.map((block) => [block.id, block.lineageId]));
  const result = new Map<string, string>();
  for (const [id, lineageId] of inherited) {
    if (known.has(own.get(id) ?? "") || kept.has(lineageId)) continue;
    result.set(id, lineageId);
  }
  return result;
}

export async function releaseScriptVersion(versionId: string, userId: string) {
  const version = await requireDraft(versionId);
  const review = await loadScriptReview(versionId);
  if (review?.blockers.length) {
    throw new ScriptReviewError(`Noch offen: ${review.blockers.join(", ")}.`);
  }
  const previous = await prisma.scriptVersion.findFirst({
    where: { showId: version.showId, status: "released" },
    orderBy: { releasedAt: "desc" },
    select: { id: true },
  });
  const inherited = previous ? await keepOwnLineage(versionId, previous.id) : new Map();
  await prisma.$transaction([
    ...[...inherited].map(([id, lineageId]) =>
      prisma.scriptBlock.update({ where: { id }, data: { lineageId } }),
    ),
    prisma.scriptVersion.update({
      where: { id: versionId },
      data: {
        status: "released",
        releasedAt: new Date(),
        releasedById: userId,
        basedOnId: previous?.id ?? undefined,
      },
    }),
  ]);
  return { inherited: inherited.size };
}

/** Entwurf verwerfen, Original-PDF aus dem Speicher löschen. */
export async function deleteScriptDraft(versionId: string) {
  const version = await requireDraft(versionId);
  await prisma.scriptVersion.delete({ where: { id: versionId } });
  if (version.sourceBucket && version.sourceKey) {
    await deleteObjects([{ bucket: version.sourceBucket, key: version.sourceKey }]).catch((error) =>
      console.error("[skript] Original-PDF nicht gelöscht", error),
    );
  }
}

/** Mitwirkende der Produktion speichern (Prüfschritt, Phase 1 Auswertungen). */
export async function saveShowCredits(showId: string, credits: ScriptCredit[]) {
  await prisma.show.update({ where: { id: showId }, data: { scriptCredits: credits } });
}

/**
 * Mitwirkende nachträglich aus dem Original-PDF lesen (Fassungen von vor Phase 1). Ergebnis landet
 * im Import-Bericht; ist die Liste der Produktion leer, wird sie direkt gefüllt.
 */
export async function rereadCreditsFromSource(versionId: string) {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: {
      showId: true,
      sourceBucket: true,
      sourceKey: true,
      importReport: true,
      show: { select: { scriptCredits: true } },
    },
  });
  if (!version) throw new ScriptReviewError("Fassung nicht gefunden.");
  if (!version.sourceBucket || !version.sourceKey) {
    throw new ScriptReviewError("Zu dieser Fassung ist kein Original-PDF gespeichert.");
  }
  const object = await getObject(version.sourceBucket, version.sourceKey);
  if (!object.body) throw new ScriptReviewError("Das Original-PDF ist leer.");
  const data = new Uint8Array(await new Response(object.body).arrayBuffer());
  const { credits } = await parseScriptPdf(data);
  const report = { ...readImportReport(version.importReport), credits };
  const fill = credits.length > 0 && !readScriptCredits(version.show.scriptCredits).length;
  await prisma.$transaction([
    prisma.scriptVersion.update({ where: { id: versionId }, data: { importReport: report } }),
    ...(fill
      ? [prisma.show.update({ where: { id: version.showId }, data: { scriptCredits: credits } })]
      : []),
  ]);
  return credits;
}
