import { prisma } from "@/lib/prisma";
import { currentDepartmentMembershipWhere } from "@/lib/produktionen/status";
import { DIRECTION_TEAM_TEMPLATE_SLUGS } from "@/lib/regie/wishes";

import { readScriptCredits, type ScriptCredit } from "./credits";
import { readParts } from "./json";
import { resolveGroupMembers, roleIdsByUser, type LinkRole, type RoleKind } from "./role-links";
import { roleKey, splitSpeakerRoles } from "./roles";
import { isSpoken, type ScriptBlockKind, type ScriptPart } from "./types";

/** Daten für den Leser (docs/Plan/skript-plan.md, Abschnitt „Leser“). */

/** Gesprochene Wörter pro Minute für die geschätzte Szenendauer. */
export const WORDS_PER_MINUTE = 130;

export type ReaderBlock = {
  id: string;
  lineageId: string;
  sceneId: string;
  kind: ScriptBlockKind;
  speaker: string | null;
  roleIds: string[];
  /** Bei Gruppenrollen („Alle“): wer hier mitspricht (docs/Plan/skript-uebernahme-plan.md). */
  memberRoleIds: string[];
  parts: ScriptPart[];
  words: number;
  page: number | null;
};

export type ReaderScene = {
  id: string;
  title: string;
  words: number;
  minutes: number;
  /** Gemessene Dauer in Sekunden, falls eingetragen. */
  measuredSeconds: number | null;
};

export type ReaderRole = {
  id: string;
  name: string;
  kind: RoleKind;
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
  /** Skript-Rollen der eigenen Besetzung (verknüpft oder per Name, siehe role-links.ts). */
  ownRoleIds: string[];
  /** Mitwirkende fürs Deckblatt; ohne Regie-Angabe die Mitglieder des Gewerks Regie. */
  credits: ScriptCredit[];
  /** Mitglieder der Produktion – personalisierte PDFs „für“ jemanden (jeder für jeden). */
  people: ReaderPerson[];
  /** Angemeldete Person (Vorauswahl „für mich“ im PDF). */
  viewerId: string | null;
};

export type ReaderPerson = { id: string; name: string; roleIds: string[] };

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
      show: { select: { title: true, year: true, scriptCredits: true } },
      scenes: {
        orderBy: { sequence: "asc" },
        select: { id: true, title: true, sceneKey: true, measuredSeconds: true },
      },
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

  const [scriptRoles, castings, members, directors] = await Promise.all([
    prisma.scriptRole.findMany({
      where: { showId: version.showId },
      select: {
        id: true,
        name: true,
        aliases: true,
        kind: true,
        groupMode: true,
        linkedAt: true,
        links: { select: { characterId: true } },
        groupRules: {
          select: {
            groupRoleId: true,
            memberRoleId: true,
            sceneKey: true,
            lineageId: true,
            mode: true,
          },
        },
      },
    }),
    prisma.characterCasting.findMany({
      where: { character: { showId: version.showId } },
      select: {
        userId: true,
        characterId: true,
        character: { select: { name: true, shortName: true } },
      },
    }),
    prisma.productionMembership.findMany({
      where: { showId: version.showId, status: { not: "left" } },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.departmentMembership.findMany({
      where: {
        ...currentDepartmentMembershipWhere(),
        department: {
          showId: version.showId,
          template: { slug: DIRECTION_TEAM_TEMPLATE_SLUGS[0] },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { user: { select: { name: true } } },
    }),
  ]);

  // Ohne bestätigte Rolle (Entwurf) gilt der Sprechername als vorläufige Rolle.
  const provisional = new Map<string, string>();
  const blocks: ReaderBlock[] = version.blocks.map((block) => {
    let roleIds = block.roles.map((role) => role.roleId);
    if (!roleIds.length && isSpoken(block.kind) && block.speaker) {
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
      memberRoleIds: [] as string[],
      parts: readParts(block.parts),
      words: block.wordCount,
      page: block.page,
    };
  });

  const stats = new Map<string, { lines: number; words: number; scenes: Set<string> }>();
  const sceneWords = new Map<string, number>();
  for (const block of blocks) {
    if (!isSpoken(block.kind)) continue;
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
    ...[...provisional].map(([id, name]) => ({
      id,
      name,
      aliases: [] as string[],
      kind: "person" as RoleKind,
    })),
  ];
  const roles: ReaderRole[] = known
    .filter((role) => stats.has(role.id))
    .map((role) => {
      const entry = stats.get(role.id);
      return {
        id: role.id,
        name: role.name,
        kind: role.kind,
        lines: entry?.lines ?? 0,
        words: entry?.words ?? 0,
        sceneIds: entry ? [...entry.scenes] : [],
      };
    })
    .sort((a, b) => b.words - a.words || a.name.localeCompare(b.name, "de"));

  const linkRoles: LinkRole[] = scriptRoles.map((role) => ({
    id: role.id,
    name: role.name,
    aliases: role.aliases,
    kind: role.kind,
    groupMode: role.groupMode,
    linked: !!role.linkedAt,
    characterIds: role.links.map((link) => link.characterId),
  }));
  const byUser = roleIdsByUser(
    linkRoles,
    castings.map((c) => ({
      userId: c.userId,
      characterId: c.characterId,
      name: c.character.name,
      shortName: c.character.shortName,
    })),
  );
  const rolesFor = (personId: string | null) => (personId ? (byUser.get(personId) ?? []) : []);
  resolveGroups(
    blocks,
    version.scenes,
    linkRoles,
    scriptRoles.flatMap((r) => r.groupRules),
    byUser,
  );

  const ownRoleIds = rolesFor(userId);

  const people = new Map<string, ReaderPerson>();
  for (const { user } of members) {
    if (user.name)
      people.set(user.id, { id: user.id, name: user.name, roleIds: rolesFor(user.id) });
  }
  let credits = readScriptCredits(version.show.scriptCredits);
  const directorNames = [...new Set(directors.map((d) => d.user.name).filter(Boolean))] as string[];
  if (!credits.some((credit) => credit.kind === "direction") && directorNames.length) {
    credits = [...credits, { kind: "direction", label: "Regie", names: directorNames }];
  }

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
      return {
        id: scene.id,
        title: scene.title,
        words,
        minutes: estimateMinutes(words),
        measuredSeconds: scene.measuredSeconds,
      };
    }),
    blocks,
    roles,
    ownRoleIds,
    credits,
    viewerId: userId,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

/** Gruppenrollen je Absatz auflösen: `memberRoleIds` der Absätze füllen. */
function resolveGroups(
  blocks: ReaderBlock[],
  scenes: { id: string; sceneKey: string }[],
  roles: LinkRole[],
  rules: Parameters<typeof resolveGroupMembers>[0]["rules"],
  byUser: ReadonlyMap<string, string[]>,
) {
  const groups = new Map(roles.filter((r) => r.kind === "group").map((r) => [r.id, r]));
  if (!groups.size) return;
  const persons = new Set(roles.filter((r) => r.kind === "person").map((r) => r.id));
  const cast = new Set([...byUser.values()].flat().filter((id) => persons.has(id)));
  const castRoleIds = cast.size ? [...cast] : [...persons];
  const sceneKeys = new Map(scenes.map((scene) => [scene.id, scene.sceneKey]));
  const sceneRoles = new Map<string, Set<string>>();
  for (const block of blocks) {
    const set = sceneRoles.get(block.sceneId) ?? new Set<string>();
    for (const id of block.roleIds) if (persons.has(id)) set.add(id);
    sceneRoles.set(block.sceneId, set);
  }
  for (const block of blocks) {
    const members = new Set<string>();
    for (const id of block.roleIds) {
      const group = groups.get(id);
      if (!group) continue;
      for (const member of resolveGroupMembers({
        group,
        rules,
        block: {
          lineageId: block.lineageId,
          sceneKey: sceneKeys.get(block.sceneId) ?? "",
          roleIds: block.roleIds,
        },
        castRoleIds,
        sceneRoleIds: [...(sceneRoles.get(block.sceneId) ?? [])],
      })) {
        members.add(member);
      }
    }
    block.memberRoleIds = [...members];
  }
}
