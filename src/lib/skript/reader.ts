import { prisma } from "@/lib/prisma";

import { readParts } from "./json";
import { roleKey, splitSpeakerRoles } from "./roles";
import type { ScriptPart } from "./types";

/** Daten für den Leser (docs/Plan/skript-plan.md, Abschnitt „Leser“). */

/** Gesprochene Wörter pro Minute für die geschätzte Szenendauer. */
export const WORDS_PER_MINUTE = 130;

export type ReaderBlock = {
  id: string;
  lineageId: string;
  sceneId: string;
  kind: "speech" | "direction";
  speaker: string | null;
  roleIds: string[];
  parts: ScriptPart[];
  words: number;
  page: number | null;
};

export type ReaderScene = { id: string; title: string; words: number; minutes: number };

export type ReaderRole = {
  id: string;
  name: string;
  lines: number;
  words: number;
  sceneIds: string[];
};

export type ScriptReaderData = {
  version: {
    id: string;
    showId: string;
    label: string;
    status: "draft" | "released";
    versionDate: string | null;
    /** Titel des Stücks für Kopfzeilen und Dateinamen. */
    showTitle: string;
  };
  scenes: ReaderScene[];
  blocks: ReaderBlock[];
  roles: ReaderRole[];
  /** Skript-Rollen, deren Name zu einer eigenen Besetzung im Stück passt. */
  ownRoleIds: string[];
};

export function estimateMinutes(words: number) {
  return words ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0;
}

export async function loadScriptReader(
  versionId: string,
  userId: string | null,
): Promise<ScriptReaderData | null> {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      showId: true,
      label: true,
      status: true,
      versionDate: true,
      show: { select: { title: true, year: true } },
      scenes: { orderBy: { sequence: "asc" }, select: { id: true, title: true } },
      blocks: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          lineageId: true,
          sceneId: true,
          kind: true,
          speaker: true,
          parts: true,
          wordCount: true,
          page: true,
          roles: { select: { roleId: true } },
        },
      },
    },
  });
  if (!version) return null;

  const [scriptRoles, castings] = await Promise.all([
    prisma.scriptRole.findMany({
      where: { showId: version.showId },
      select: { id: true, name: true, aliases: true },
    }),
    userId
      ? prisma.characterCasting.findMany({
          where: { userId, character: { showId: version.showId } },
          select: { character: { select: { name: true, shortName: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Ohne bestätigte Rolle (Entwurf) gilt der Sprechername als vorläufige Rolle.
  const provisional = new Map<string, string>();
  const blocks: ReaderBlock[] = version.blocks.map((block) => {
    let roleIds = block.roles.map((role) => role.roleId);
    if (!roleIds.length && block.kind === "speech" && block.speaker) {
      roleIds = splitSpeakerRoles(block.speaker).map((name) => {
        const id = `name:${roleKey(name)}`;
        if (!provisional.has(id)) provisional.set(id, name);
        return id;
      });
    }
    return {
      id: block.id,
      lineageId: block.lineageId,
      sceneId: block.sceneId,
      kind: block.kind,
      speaker: block.speaker,
      roleIds,
      parts: readParts(block.parts),
      words: block.wordCount,
      page: block.page,
    };
  });

  const stats = new Map<string, { lines: number; words: number; scenes: Set<string> }>();
  const sceneWords = new Map<string, number>();
  for (const block of blocks) {
    if (block.kind !== "speech") continue;
    sceneWords.set(block.sceneId, (sceneWords.get(block.sceneId) ?? 0) + block.words);
    for (const roleId of block.roleIds) {
      const entry = stats.get(roleId) ?? { lines: 0, words: 0, scenes: new Set<string>() };
      entry.lines += 1;
      entry.words += block.words;
      entry.scenes.add(block.sceneId);
      stats.set(roleId, entry);
    }
  }

  const known = [
    ...scriptRoles,
    ...[...provisional].map(([id, name]) => ({ id, name, aliases: [] as string[] })),
  ];
  const roles: ReaderRole[] = known
    .filter((role) => stats.has(role.id))
    .map((role) => {
      const entry = stats.get(role.id);
      return {
        id: role.id,
        name: role.name,
        lines: entry?.lines ?? 0,
        words: entry?.words ?? 0,
        sceneIds: entry ? [...entry.scenes] : [],
      };
    })
    .sort((a, b) => b.words - a.words || a.name.localeCompare(b.name, "de"));

  const castKeys = new Set(
    castings.flatMap(({ character }) =>
      [character.name, character.shortName].filter((name): name is string => !!name).map(roleKey),
    ),
  );
  const ownRoleIds = roles
    .filter((role) => {
      const original = known.find((candidate) => candidate.id === role.id);
      return [role.name, ...(original?.aliases ?? [])].some((name) => castKeys.has(roleKey(name)));
    })
    .map((role) => role.id);

  return {
    version: {
      id: version.id,
      showId: version.showId,
      label: version.label,
      status: version.status,
      versionDate: version.versionDate?.toISOString() ?? null,
      showTitle: version.show.title ?? `Produktion ${version.show.year}`,
    },
    scenes: version.scenes.map((scene) => {
      const words = sceneWords.get(scene.id) ?? 0;
      return { id: scene.id, title: scene.title, words, minutes: estimateMinutes(words) };
    }),
    blocks,
    roles,
    ownRoleIds,
  };
}
