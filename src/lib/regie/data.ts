import type {
  BlockedDayKind,
  Prisma,
  CharacterCastingType,
  ProductionObjectStatus,
} from "@prisma/client";

import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { currentCastingWhere, currentMembershipWhere } from "@/lib/produktionen/status";

/**
 * Lese-Daten des Regie-Dashboards (docs/Plan/regie-plan.md, Phase 3+4). Bewusst ohne
 * Sperrgründe, Körpermaße und Kontaktdaten – nichts davon verlässt den Server.
 */

const DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE });

export const dayKeyOf = (date: Date) => DAY_KEY.format(date);
export const formatDay = (date: Date) => DATE.format(date).replace(/\.,/, ",");
export const formatTime = (date: Date) => TIME.format(date);

type NameFields = { firstName: string | null; lastName: string | null; name: string | null };
const nameSelect = { firstName: true, lastName: true, name: true } as const;
const displayName = (user: NameFields) => getUserDisplayName(user) || "Unbekannt";

/** Szenen-Kürzel wie im Stück: „1.3“ bzw. Titel. */
export function sceneLabel(scene: { identifier: string | null; title: string | null }) {
  if (scene.identifier && scene.title) return `${scene.identifier} ${scene.title}`;
  return scene.identifier ?? scene.title ?? "Szene";
}

// ---------------------------------------------------------------------------
// Besetzung

export type DirectionCastRole = {
  id: string;
  name: string;
  color: string | null;
  castings: { userId: string; name: string; type: CharacterCastingType }[];
};

export async function loadDirectionCasting(showId: string): Promise<DirectionCastRole[]> {
  const characters = await prisma.character.findMany({
    where: { showId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      castings: {
        where: currentCastingWhere(),
        orderBy: { type: "asc" },
        select: { userId: true, type: true, user: { select: nameSelect } },
      },
    },
  });
  return characters.map((character) => ({
    id: character.id,
    name: character.name,
    color: character.color,
    castings: character.castings.map((casting) => ({
      userId: casting.userId,
      name: displayName(casting.user),
      type: casting.type,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Szenen × Personen

export type DirectionScene = {
  id: string;
  label: string;
  act: number;
  characterIds: string[];
};

export async function loadDirectionScenes(showId: string): Promise<DirectionScene[]> {
  const scenes = await prisma.scene.findMany({
    where: { showId },
    orderBy: [{ act: "asc" }, { sequence: "asc" }],
    select: {
      id: true,
      identifier: true,
      title: true,
      act: true,
      characters: { orderBy: { order: "asc" }, select: { characterId: true } },
    },
  });
  return scenes.map((scene) => ({
    id: scene.id,
    label: sceneLabel(scene),
    act: scene.act,
    characterIds: scene.characters.map((entry) => entry.characterId),
  }));
}

// ---------------------------------------------------------------------------
// Proben/Termine

export type DirectionEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  rehearsal: boolean;
  status: "SCHEDULED" | "TENTATIVE" | "CANCELLED";
  scenes: string[];
  invited: number;
  /** Abgesagt bzw. laut Sperrliste verhindert – nur Namen, keine Gründe. */
  absent: string[];
  updatedAt: Date;
};

/** Termine der Produktion ab `from` (ohne Entwürfe), aufsteigend. */
export async function loadDirectionEvents(
  showId: string,
  { from = new Date(), take }: { from?: Date; take?: number } = {},
): Promise<DirectionEvent[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      showId,
      departmentId: null,
      status: { not: "DRAFT" },
      OR: [{ start: { gte: from } }, { end: { gte: from } }],
    },
    orderBy: { start: "asc" },
    take,
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      start: true,
      end: true,
      allDay: true,
      location: true,
      updatedAt: true,
      blocks: {
        orderBy: { order: "asc" },
        select: {
          scene: { select: { identifier: true, title: true } },
          runScenes: { select: { scene: { select: { identifier: true, title: true } } } },
        },
      },
      participants: {
        where: { invited: true, override: { not: "EXCLUDED" } },
        select: { userId: true, response: true, user: { select: nameSelect } },
      },
    },
  });

  // Sperrliste an den Termintagen: wer „kann nicht“ eingetragen hat, fehlt (ohne Grund).
  const userIds = [...new Set(events.flatMap((e) => e.participants.map((p) => p.userId)))];
  const days = [...new Set(events.map((event) => dayKeyOf(event.start)))];
  const blocked = userIds.length
    ? await prisma.blockedDay.findMany({
        where: {
          userId: { in: userIds },
          kind: { in: ["BLOCKED", "EMERGENCY"] },
          date: { in: days.map((key) => new Date(`${key}T00:00:00.000Z`)) },
        },
        select: { userId: true, date: true },
      })
    : [];
  const blockedKeys = new Set(
    blocked.map((entry) => `${entry.userId}:${entry.date.toISOString().slice(0, 10)}`),
  );

  return events.map((event) => {
    const day = dayKeyOf(event.start);
    const scenes = event.blocks.flatMap((block) =>
      block.scene ? [block.scene] : block.runScenes.map((entry) => entry.scene),
    );
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      location: event.location,
      rehearsal: event.kind === "REHEARSAL",
      status: event.status === "DRAFT" ? "SCHEDULED" : event.status,
      scenes: [...new Set(scenes.map((scene) => scene.identifier ?? scene.title ?? "?"))],
      invited: event.participants.length,
      absent: event.participants
        .filter(
          (p) =>
            p.response === "no" ||
            p.response === "emergency" ||
            blockedKeys.has(`${p.userId}:${day}`),
        )
        .map((p) => displayName(p.user))
        .sort((a, b) => a.localeCompare(b, "de")),
      updatedAt: event.updatedAt,
    };
  });
}

export function eventTimeLabel(event: Pick<DirectionEvent, "start" | "end" | "allDay">) {
  if (event.allDay) return "ganztägig";
  return event.end
    ? `${formatTime(event.start)}–${formatTime(event.end)}`
    : formatTime(event.start);
}

// ---------------------------------------------------------------------------
// Verfügbarkeit (ohne Gründe)

export type DirectionAvailabilityMember = {
  id: string;
  name: string;
  roles: string[];
  entries: Record<string, BlockedDayKind>;
};

export async function loadDirectionAvailability(
  showId: string,
  { from, days }: { from: Date; days: number },
) {
  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + index);
    return dayKeyOf(date);
  });
  const [members, castRoles] = await Promise.all([
    prisma.productionMembership.findMany({
      where: { showId, ...currentMembershipWhere(), user: { deactivatedAt: null } },
      select: {
        user: {
          select: {
            id: true,
            ...nameSelect,
            blockedDays: {
              where: {
                kind: { not: "PREFERRED" },
                date: {
                  gte: new Date(`${keys[0]}T00:00:00.000Z`),
                  lte: new Date(`${keys.at(-1)}T00:00:00.000Z`),
                },
              },
              select: { date: true, kind: true },
            },
          },
        },
      },
    }),
    loadDirectionCasting(showId),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const role of castRoles) {
    for (const casting of role.castings) {
      rolesByUser.set(casting.userId, [...(rolesByUser.get(casting.userId) ?? []), role.name]);
    }
  }

  const list: DirectionAvailabilityMember[] = members
    .map(({ user }) => ({
      id: user.id,
      name: displayName(user),
      roles: rolesByUser.get(user.id) ?? [],
      entries: Object.fromEntries(
        user.blockedDays.map((day) => [day.date.toISOString().slice(0, 10), day.kind]),
      ),
    }))
    // Ensemble zuerst, dann nach Name.
    .sort(
      (a, b) =>
        Number(!a.roles.length) - Number(!b.roles.length) || a.name.localeCompare(b.name, "de"),
    );
  return { days: keys, members: list };
}

// ---------------------------------------------------------------------------
// Probenprotokolle

export type DirectionProtocol = {
  id: string;
  title: string;
  start: Date;
  summary: string | null;
  notes: { id: string; type: string; text: string; done: boolean; createdAt: Date }[];
  updatedAt: Date;
};

export async function loadDirectionProtocols(showId: string, take = 10) {
  const events = await prisma.calendarEvent.findMany({
    where: {
      showId,
      kind: "REHEARSAL",
      status: { not: "DRAFT" },
      start: { lte: new Date() },
      OR: [{ protocolSummary: { not: null } }, { notes: { some: {} } }],
    },
    orderBy: { start: "desc" },
    take,
    select: {
      id: true,
      title: true,
      start: true,
      protocolSummary: true,
      updatedAt: true,
      notes: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, text: true, doneAt: true, createdAt: true },
      },
    },
  });
  return events.map<DirectionProtocol>((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    summary: event.protocolSummary,
    notes: event.notes.map((note) => ({
      id: note.id,
      type: note.type,
      text: note.text,
      done: Boolean(note.doneAt),
      createdAt: note.createdAt,
    })),
    updatedAt: event.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// Ausstattung

export type DirectionPropScene = {
  id: string;
  label: string;
  objects: {
    id: string;
    title: string;
    kind: string;
    status: ProductionObjectStatus;
    note: string | null;
    roles: string[];
  }[];
};

export async function loadDirectionProps(showId: string) {
  const [scenes, objects] = await Promise.all([
    prisma.scene.findMany({
      where: { showId },
      orderBy: [{ act: "asc" }, { sequence: "asc" }],
      select: { id: true, identifier: true, title: true },
    }),
    prisma.productionObject.findMany({
      where: { showId, archivedAt: null, kind: { not: "costume_part" } },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        kind: true,
        status: true,
        updatedAt: true,
        scenes: { select: { sceneId: true, note: true } },
        characters: { select: { character: { select: { name: true } } } },
      },
    }),
  ]);
  const list: DirectionPropScene[] = scenes
    .map((scene) => ({
      id: scene.id,
      label: sceneLabel(scene),
      objects: objects
        .filter((object) => object.scenes.some((entry) => entry.sceneId === scene.id))
        .map((object) => ({
          id: object.id,
          title: object.title,
          kind: object.kind,
          status: object.status,
          note: object.scenes.find((entry) => entry.sceneId === scene.id)?.note ?? null,
          roles: object.characters.map((entry) => entry.character.name),
        })),
    }))
    .filter((scene) => scene.objects.length);
  return {
    scenes: list,
    total: objects.length,
    open: objects.filter((object) => object.status !== "ready").length,
    lastChange: objects.reduce<Date | null>(
      (max, object) => (!max || object.updatedAt > max ? object.updatedAt : max),
      null,
    ),
  };
}

// ---------------------------------------------------------------------------
// Skript

export async function loadDirectionScript(showId: string) {
  return prisma.scriptVersion.findFirst({
    where: { showId, status: "released" },
    orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, label: true, versionDate: true, releasedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Auswahl für Wünsche

/** Personen der Produktion (nur Namen) – Ensemble mit Rolle zuerst. */
export async function loadDirectionPeople(showId: string) {
  const [members, roles] = await Promise.all([
    prisma.productionMembership.findMany({
      where: { showId, ...currentMembershipWhere(), user: { deactivatedAt: null } },
      select: { user: { select: { id: true, ...nameSelect } } },
    }),
    loadDirectionCasting(showId),
  ]);
  const cast = new Set(roles.flatMap((role) => role.castings.map((casting) => casting.userId)));
  return members
    .map(({ user }) => ({ id: user.id, label: displayName(user), cast: cast.has(user.id) }))
    .sort((a, b) => Number(b.cast) - Number(a.cast) || a.label.localeCompare(b.label, "de"))
    .map(({ id, label }) => ({ id, label }));
}

// ---------------------------------------------------------------------------
// Kennzahlen (Countdown)

/** Termine und Probenabdeckung für die Kennzahlen oben im Dashboard. */
export async function loadDirectionCountdownData(showId: string) {
  const eventWhere = {
    showId,
    departmentId: null,
    status: { notIn: ["DRAFT", "CANCELLED"] },
  } satisfies Prisma.CalendarEventWhereInput;
  const [show, performances, rehearsedBlocks] = await Promise.all([
    prisma.show.findUnique({
      where: { id: showId },
      select: { finalRehearsalWeekStart: true, finalRehearsalWeekEnd: true, premiereAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { ...eventWhere, kind: "PERFORMANCE" },
      orderBy: { start: "asc" },
      select: { start: true },
    }),
    prisma.eventBlock.findMany({
      where: { event: { ...eventWhere, kind: "REHEARSAL" } },
      select: { sceneId: true, runScenes: { select: { sceneId: true } } },
    }),
  ]);
  const rehearsedSceneIds = new Set(
    rehearsedBlocks.flatMap((block) => [
      ...(block.sceneId ? [block.sceneId] : []),
      ...block.runScenes.map((entry) => entry.sceneId),
    ]),
  );
  return {
    finalRehearsalWeekStart: show?.finalRehearsalWeekStart ?? null,
    finalRehearsalWeekEnd: show?.finalRehearsalWeekEnd ?? null,
    premiereAt: show?.premiereAt ?? null,
    performances: performances.map((event) => event.start),
    rehearsedSceneIds,
  };
}
