import type { AudienceContext } from "@/lib/calendar/audience";

export type ScheduledScene = { sceneId: string; startsAt: Date | null; endsAt: Date | null };

/** In welchen der gewählten Szenen jemand spielt (Haupt- wie Zweitbesetzung). */
export function scenesByPerson(sceneIds: readonly string[], context: AudienceContext) {
  const result = new Map<string, string[]>();
  for (const sceneId of sceneIds) {
    const scene = context.scenes.find((entry) => entry.id === sceneId);
    if (!scene) continue;
    for (const casting of context.castings) {
      if (!scene.characterIds.includes(casting.characterId)) continue;
      const list = result.get(casting.userId) ?? [];
      if (!list.includes(sceneId)) list.push(sceneId);
      result.set(casting.userId, list);
    }
  }
  return result;
}

/**
 * Persönliche Zeitfenster einer gestaffelten Probe: von der ersten bis zur letzten eigenen
 * Szene. Wer in keiner Szene mit Uhrzeit spielt, kommt zur Terminzeit (kein Eintrag).
 */
export function computePersonalWindows(
  scenes: readonly ScheduledScene[],
  context: AudienceContext,
) {
  const timed = scenes.filter(
    (scene): scene is ScheduledScene & { startsAt: Date; endsAt: Date } =>
      scene.startsAt !== null && scene.endsAt !== null,
  );
  const byPerson = scenesByPerson(
    timed.map((scene) => scene.sceneId),
    context,
  );
  const windows = new Map<string, { start: Date; end: Date }>();
  for (const [userId, sceneIds] of byPerson) {
    const own = timed.filter((scene) => sceneIds.includes(scene.sceneId));
    windows.set(userId, {
      start: new Date(Math.min(...own.map((scene) => scene.startsAt.getTime()))),
      end: new Date(Math.max(...own.map((scene) => scene.endsAt.getTime()))),
    });
  }
  return windows;
}
