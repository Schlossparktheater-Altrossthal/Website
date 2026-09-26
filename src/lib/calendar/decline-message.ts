import type { CharacterCastingType } from "@prisma/client";

import type { AudienceContext } from "@/lib/calendar/audience";
import type { DayAvailability } from "@/lib/calendar/day-availability";

/** Absagen innerhalb dieser Frist gelten als kurzfristig und werden hervorgehoben. */
export const SHORT_NOTICE_MS = 48 * 60 * 60 * 1000;

const SECOND_CAST: ReadonlySet<CharacterCastingType> = new Set(["alternate", "cover"]);

export type SceneImpact = {
  scene: string;
  character: string;
  /** Zweitbesetzungen, die laut Sperrliste und Rückmeldung können. */
  available: string[];
};

/**
 * Welche Szenen einer Probe durch die Absage unvollständig werden – und ob eine
 * Zweitbesetzung einspringen könnte.
 */
export function findSceneImpacts({
  userId,
  sceneIds,
  context,
  availability,
  declinedIds,
}: {
  userId: string;
  sceneIds: readonly string[];
  context: AudienceContext;
  availability: DayAvailability;
  declinedIds: ReadonlySet<string>;
}): SceneImpact[] {
  const names = new Map(context.members.map((member) => [member.id, member.name]));
  const characters = new Map(context.characters.map((entry) => [entry.id, entry.name]));
  const impacts: SceneImpact[] = [];
  for (const scene of context.scenes) {
    if (!sceneIds.includes(scene.id)) continue;
    for (const characterId of scene.characterIds) {
      const castings = context.castings.filter((entry) => entry.characterId === characterId);
      const ownMain = castings.some(
        (entry) => entry.userId === userId && !SECOND_CAST.has(entry.type),
      );
      if (!ownMain) continue;
      const available = castings
        .filter(
          (entry) =>
            entry.userId !== userId &&
            SECOND_CAST.has(entry.type) &&
            availability[entry.userId] !== "blocked" &&
            !declinedIds.has(entry.userId),
        )
        .map((entry) => names.get(entry.userId) ?? "Unbekannt");
      impacts.push({
        scene: scene.label,
        character: characters.get(characterId) ?? "?",
        available,
      });
    }
  }
  return impacts;
}

export function buildDeclineMessage({
  personName,
  eventTitle,
  when,
  reason,
  shortNotice,
  impacts,
}: {
  personName: string;
  eventTitle: string;
  when: string;
  reason: string | null;
  shortNotice: boolean;
  impacts: readonly SceneImpact[];
}) {
  const title = `${shortNotice ? "Kurzfristige Absage" : "Absage"}: ${personName} – ${eventTitle}`;
  const lines = [`${personName} kann am ${when} nicht zu „${eventTitle}“ kommen.`];
  if (reason) lines.push(`Grund: ${reason}`);
  for (const impact of impacts) {
    const cover = impact.available.length
      ? `Zweitbesetzung ${impact.available.join(", ")} kann laut Sperrliste`
      : "keine Zweitbesetzung verfügbar";
    lines.push(`${impact.scene} ist unvollständig – ${impact.character} fehlt (${cover}).`);
  }
  return { title, body: lines.join("\n") };
}
