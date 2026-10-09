import type { CharacterCastingType } from "@prisma/client";

import { getUserDisplayName } from "@/lib/names";
import { visibleEventStatus } from "@/lib/calendar/status";
import { prisma } from "@/lib/prisma";
import { AVATAR_USER_SELECT, toAvatarFields } from "@/lib/avatar-fields";

export const CASTING_TYPE_LABELS: Record<CharacterCastingType, string> = {
  primary: "Hauptbesetzung",
  alternate: "Zweitbesetzung",
  cover: "Cover",
  cameo: "Cameo",
};

const CASTING_ORDER: CharacterCastingType[] = ["primary", "alternate", "cover", "cameo"];

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  ...AVATAR_USER_SELECT,
} as const;

export type RoleCard = {
  id: string;
  name: string;
  color: string | null;
  myCasting: CharacterCastingType | null;
  cast: { name: string; type: CharacterCastingType }[];
  sceneCount: number;
};

/** Rollen der Produktion, in denen die Person besetzt ist (oder alle, für Regie/Board). */
export async function loadMyRoles(userId: string, showId: string, includeAll: boolean) {
  const characters = await prisma.character.findMany({
    where: { showId, ...(includeAll ? {} : { castings: { some: { userId } } }) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      castings: {
        where: { user: { deactivatedAt: null } },
        select: { type: true, userId: true, user: { select: userSelect } },
      },
      _count: { select: { sceneAppearances: true } },
    },
  });
  return characters.map<RoleCard>((character) => ({
    id: character.id,
    name: character.name,
    color: character.color,
    myCasting: character.castings.find((entry) => entry.userId === userId)?.type ?? null,
    cast: character.castings
      .sort((a, b) => CASTING_ORDER.indexOf(a.type) - CASTING_ORDER.indexOf(b.type))
      .map((entry) => ({ name: getUserDisplayName(entry.user), type: entry.type })),
    sceneCount: character._count.sceneAppearances,
  }));
}

/** Darf die Person das Rollenportal sehen? Besetzung, Regie/Board oder Gewerk der Produktion. */
export async function canViewRole(userId: string, showId: string, isManager: boolean) {
  if (isManager) return true;
  const [casting, membership] = await Promise.all([
    prisma.characterCasting.count({ where: { userId, character: { showId } } }),
    prisma.departmentMembership.count({
      where: { userId, status: "active", department: { showId, archivedAt: null } },
    }),
  ]);
  return casting + membership > 0;
}

/** Eine Rolle mit Besetzung, Szenen, Ausstattung (Kostüme, Requisiten) und Proben der Besetzung. */
export async function loadRolePortal(showId: string, characterId: string, userId: string) {
  const now = new Date();
  const character = await prisma.character.findFirst({
    where: { id: characterId, showId },
    select: {
      id: true,
      name: true,
      shortName: true,
      description: true,
      notes: true,
      color: true,
      castings: {
        where: { user: { deactivatedAt: null } },
        select: { type: true, notes: true, user: { select: userSelect } },
      },
      objectCharacters: {
        where: { object: { archivedAt: null } },
        select: {
          object: {
            select: {
              id: true,
              title: true,
              kind: true,
              status: true,
              department: { select: { name: true, color: true } },
              scenes: { select: { scene: { select: { identifier: true, sequence: true } } } },
              photos: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } },
              parts: {
                orderBy: { position: "asc" },
                select: { part: { select: { title: true } } },
              },
            },
          },
        },
      },
      sceneAppearances: {
        orderBy: { scene: { sequence: "asc" } },
        select: {
          isFeatured: true,
          note: true,
          scene: {
            select: {
              id: true,
              sequence: true,
              identifier: true,
              title: true,
              location: true,
              timeOfDay: true,
              durationMinutes: true,
              characters: {
                where: { characterId: { not: characterId } },
                orderBy: { order: "asc" },
                select: { character: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!character) return null;

  const cast = character.castings
    .map((entry) => ({
      id: entry.user.id,
      name: getUserDisplayName(entry.user),
      ...toAvatarFields(entry.user),
      type: entry.type,
      notes: entry.notes,
    }))
    .sort(
      (a, b) =>
        CASTING_ORDER.indexOf(a.type) - CASTING_ORDER.indexOf(b.type) ||
        a.name.localeCompare(b.name, "de"),
    );

  const castIds = cast.map((person) => person.id);
  const rehearsals = castIds.length
    ? await prisma.calendarEvent.findMany({
        where: {
          kind: "REHEARSAL",
          start: { gte: now },
          status: visibleEventStatus,
          OR: [{ showId }, { showId: null }],
          participants: { some: { userId: { in: castIds }, invited: true } },
        },
        orderBy: { start: "asc" },
        take: 6,
        select: {
          id: true,
          title: true,
          start: true,
          location: true,
          participants: {
            where: { userId: { in: castIds }, invited: true },
            select: { userId: true },
          },
        },
      })
    : [];

  const scenes = character.sceneAppearances.map((entry) => ({
    id: entry.scene.id,
    label: entry.scene.identifier || `Szene ${entry.scene.sequence}`,
    title: entry.scene.title,
    location: entry.scene.location,
    timeOfDay: entry.scene.timeOfDay,
    durationMinutes: entry.scene.durationMinutes,
    featured: entry.isFeatured,
    note: entry.note,
    partners: entry.scene.characters.map((other) => other.character.name),
  }));

  // Ausstattung der Rolle: Kostüme (mit Teilen) und Requisiten (docs/Plan/ausstattung-plan.md).
  const objects = character.objectCharacters
    .map(({ object }) => ({
      id: object.id,
      title: object.title,
      kind: object.kind,
      status: object.status,
      department: object.department,
      photoId: object.photos[0]?.id ?? null,
      parts: object.parts.map((entry) => entry.part.title),
      scenes: object.scenes
        .map((entry) => entry.scene.identifier || `Szene ${entry.scene.sequence}`)
        .sort((a, b) => a.localeCompare(b, "de", { numeric: true })),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, "de"));

  return {
    id: character.id,
    name: character.name,
    shortName: character.shortName,
    description: character.description,
    notes: character.notes,
    color: character.color,
    cast,
    myCasting: cast.find((person) => person.id === userId)?.type ?? null,
    scenes,
    objects,
    rehearsals: rehearsals.map((rehearsal) => ({
      id: rehearsal.id,
      title: rehearsal.title,
      start: rehearsal.start,
      location: rehearsal.location,
      // Wer aus der Besetzung eingeladen ist, z. B. nur die Zweitbesetzung.
      castInvited: cast
        .filter((person) => rehearsal.participants.some((entry) => entry.userId === person.id))
        .map((person) => person.name),
    })),
  };
}
