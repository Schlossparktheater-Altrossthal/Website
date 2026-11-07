import type { BlockedDayKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  availabilityDayKeys,
  isFinalWeekKey,
  type AvailabilityRange,
  type FinalWeek,
} from "@/lib/regie/availability-range";
import {
  dayKeyOf,
  loadDirectionAvailability,
  loadDirectionCasting,
  loadDirectionEvents,
  loadDirectionScenes,
  type DirectionCastRole,
  type DirectionEvent,
  type DirectionScene,
} from "@/lib/regie/data";
import { readSperrlisteSettings, resolveBlocklistSettings } from "@/lib/sperrliste-settings";

const castLabel = (role: DirectionCastRole) =>
  role.castings.map((casting) => casting.name).join(" / ") || null;

/** Szenen-Zeilen der Verfügbarkeit: probbar, wenn keine besetzte Rolle fehlt. */
export function sceneRows(
  scenes: DirectionScene[],
  roles: DirectionCastRole[],
  days: string[],
  entries: Map<string, BlockedDayKind>,
) {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  return scenes.map((scene) => {
    const sceneRoles = scene.characterIds
      .map((id) => roleById.get(id))
      .filter((role): role is DirectionCastRole => Boolean(role));
    return {
      label: scene.label,
      cast: sceneRoles.map((role) => `${role.name}: ${castLabel(role) ?? "–"}`).join(" · ") || null,
      cells: days.map((day) => {
        const missing: string[] = [];
        const limited: string[] = [];
        let alternate = false;
        for (const role of sceneRoles) {
          const states = role.castings.map((c) => entries.get(`${c.userId}:${day}`));
          const free = states.filter((state) => !state || state === "PREFERRED").length;
          if (!role.castings.length || free === 0) {
            if (states.some((state) => state === "LIMITED")) limited.push(role.name);
            else missing.push(role.name);
          } else if (states[0] && states[0] !== "PREFERRED") alternate = true;
        }
        if (missing.length) return { status: "missing" as const, note: missing.join(", ") };
        if (limited.length) return { status: "limited" as const, note: limited.join(", ") };
        return { status: alternate ? ("alternate" as const) : ("ready" as const), note: null };
      }),
    };
  });
}

/**
 * Alles für Verfügbarkeits-Ansicht und -PDF der Regie: Tage des gewählten Zeitraums,
 * Einträge mit Gründen, Termine je Tag und Probbarkeit der Szenen.
 */
export async function loadDirectionAvailabilityView(showId: string, range: AvailabilityRange) {
  const from = new Date();
  const [settingsRecord, show, events, scenes, roles] = await Promise.all([
    readSperrlisteSettings(),
    prisma.show.findUnique({
      where: { id: showId },
      select: { finalRehearsalWeekStart: true, finalRehearsalWeekEnd: true },
    }),
    loadDirectionEvents(showId, { from }),
    loadDirectionScenes(showId),
    loadDirectionCasting(showId),
  ]);
  const { preferredWeekdays } = resolveBlocklistSettings(settingsRecord);
  const finalWeek: FinalWeek = show?.finalRehearsalWeekStart
    ? {
        start: dayKeyOf(show.finalRehearsalWeekStart),
        end: show.finalRehearsalWeekEnd ? dayKeyOf(show.finalRehearsalWeekEnd) : null,
      }
    : null;
  const activeEvents = events.filter((event) => event.status !== "CANCELLED");
  const eventsByDay = new Map<string, DirectionEvent[]>();
  for (const event of activeEvents) {
    const key = dayKeyOf(event.start);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }
  const days = availabilityDayKeys(range, {
    preferredWeekdays,
    finalWeek,
    eventDayKeys: new Set(eventsByDay.keys()),
  });
  const { members } = await loadDirectionAvailability(showId, days);

  const entries = new Map<string, BlockedDayKind>();
  for (const member of members) {
    for (const [day, entry] of Object.entries(member.entries)) {
      entries.set(`${member.id}:${day}`, entry.kind);
    }
  }
  const castScenes = scenes.filter((scene) =>
    scene.characterIds.some((id) => roles.find((role) => role.id === id)?.castings.length),
  );
  const rows = sceneRows(castScenes, roles, days, entries);

  return {
    days: days.map((key, index) => ({
      key,
      finalWeek: isFinalWeekKey(key, finalWeek),
      events: eventsByDay.get(key) ?? [],
      absent: members
        .filter((m) => m.entries[key] && ["BLOCKED", "EMERGENCY"].includes(m.entries[key].kind))
        .map((m) => ({ id: m.id, name: m.name, roles: m.roles, ...m.entries[key] })),
      limited: members
        .filter((m) => m.entries[key]?.kind === "LIMITED")
        .map((m) => ({ id: m.id, name: m.name, roles: m.roles, ...m.entries[key] })),
      scenes: rows.map((row) => ({ label: row.label, ...row.cells[index] })),
    })),
    members,
    preferredWeekdays,
    sceneCount: castScenes.length,
    castComplete: roles.every((role) => role.castings.length > 0),
    rows,
  };
}

export type DirectionAvailabilityView = Awaited<ReturnType<typeof loadDirectionAvailabilityView>>;
