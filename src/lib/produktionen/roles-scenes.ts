import type { BreakdownStatus, CharacterCastingType } from "@prisma/client";

import { getNameInitials, getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

export type RsPerson = { id: string; name: string; initials: string };

export type RsRole = {
  id: string;
  name: string;
  shortName: string | null;
  /** Rollengröße als Onboarding-Code (`acting_lead` …). */
  size: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  cast: { id: string; person: RsPerson; type: CharacterCastingType; notes: string | null }[];
  sceneIds: string[];
};

export type RsBreakdownItem = {
  id: string;
  departmentId: string;
  title: string;
  status: BreakdownStatus;
  note: string | null;
};

export type RsScene = {
  id: string;
  act: number;
  identifier: string | null;
  title: string | null;
  location: string | null;
  timeOfDay: string | null;
  durationMinutes: number | null;
  summary: string | null;
  roles: { characterId: string; featured: boolean }[];
  breakdown: RsBreakdownItem[];
};

export type RsAct = { number: number; title: string | null };

export type RolesScenesData = {
  showId: string;
  /** Alle Akte mit Szenen oder Titel, aufsteigend. */
  acts: RsAct[];
  roles: RsRole[];
  scenes: RsScene[];
  departments: { id: string; name: string; color: string | null }[];
  /** Aktive Mitglieder der Produktion, für die Besetzung. */
  people: RsPerson[];
};

const userSelect = { id: true, firstName: true, lastName: true, name: true, email: true } as const;

const toPerson = (user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}): RsPerson => ({ id: user.id, name: getUserDisplayName(user), initials: getNameInitials(user) });

/** Szenennummern wie 1.3 < 1.10 < 2.1 sortieren; ohne Nummer ans Ende. */
export function compareSceneIdentifiers(a: string | null, b: string | null) {
  const parse = (value: string | null) =>
    value ? value.split(".").map((part) => Number.parseInt(part, 10) || 0) : [Infinity];
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** Rollen, Szenen, Ausstattung und Personen einer Produktion für die Verwaltung. */
export async function loadRolesAndScenes(showId: string): Promise<RolesScenesData> {
  const now = new Date();
  const [characters, scenes, departments, members, acts] = await Promise.all([
    prisma.character.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        rolePreferenceCode: true,
        description: true,
        notes: true,
        color: true,
        castings: {
          where: { user: { deactivatedAt: null } },
          select: { id: true, type: true, notes: true, user: { select: userSelect } },
        },
        sceneAppearances: { select: { sceneId: true } },
      },
    }),
    prisma.scene.findMany({
      where: { showId },
      select: {
        id: true,
        act: true,
        identifier: true,
        title: true,
        location: true,
        timeOfDay: true,
        durationMinutes: true,
        summary: true,
        characters: {
          orderBy: { order: "asc" },
          select: { characterId: true, isFeatured: true },
        },
        breakdownItems: {
          orderBy: { createdAt: "asc" },
          select: { id: true, departmentId: true, title: true, status: true, note: true },
        },
      },
    }),
    prisma.department.findMany({
      where: { showId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        productionMemberships: {
          some: { showId, OR: [{ leftAt: null }, { leftAt: { gt: now } }] },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { name: "asc" }],
      select: userSelect,
    }),
    prisma.showAct.findMany({
      where: { showId },
      orderBy: { number: "asc" },
      select: { number: true, title: true },
    }),
  ]);

  const actNumbers = new Set([
    ...acts.map((act) => act.number),
    ...scenes.map((scene) => scene.act),
  ]);
  if (!actNumbers.size) actNumbers.add(1);

  return {
    showId,
    acts: [...actNumbers]
      .sort((a, b) => a - b)
      .map((number) => ({
        number,
        title: acts.find((act) => act.number === number)?.title ?? null,
      })),
    roles: characters.map((character) => ({
      id: character.id,
      name: character.name,
      shortName: character.shortName,
      size: character.rolePreferenceCode,
      description: character.description,
      notes: character.notes,
      color: character.color,
      cast: character.castings.map((entry) => ({
        id: entry.id,
        person: toPerson(entry.user),
        type: entry.type,
        notes: entry.notes,
      })),
      sceneIds: character.sceneAppearances.map((entry) => entry.sceneId),
    })),
    scenes: scenes
      .sort((a, b) => a.act - b.act || compareSceneIdentifiers(a.identifier, b.identifier))
      .map((scene) => ({
        id: scene.id,
        act: scene.act,
        identifier: scene.identifier,
        title: scene.title,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        durationMinutes: scene.durationMinutes,
        summary: scene.summary,
        roles: scene.characters.map((entry) => ({
          characterId: entry.characterId,
          featured: entry.isFeatured,
        })),
        breakdown: scene.breakdownItems,
      })),
    departments,
    people: members.map(toPerson),
  };
}
