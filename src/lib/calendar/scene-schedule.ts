import type { AudienceContext } from "@/lib/calendar/audience";

export type ScheduledScene = { sceneId: string; startsAt: Date | null; endsAt: Date | null };

/** Gewerk-Baustein mit Zeitfenster; betrifft alle Mitglieder des Gewerks. */
export type ScheduledDepartmentBlock = {
  departmentId: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

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
 * Persönliche Zeitfenster: von der ersten bis zur letzten eigenen Szene bzw. dem eigenen
 * Gewerk-Baustein. Wer in keinem Baustein mit Uhrzeit steckt, kommt zur Terminzeit (kein
 * Eintrag). Bausteine dürfen parallel laufen.
 */
export function computePersonalWindows(
  scenes: readonly ScheduledScene[],
  context: AudienceContext,
  departmentBlocks: readonly ScheduledDepartmentBlock[] = [],
) {
  const spans = new Map<string, { start: number; end: number }>();
  const extend = (userId: string, startsAt: Date, endsAt: Date) => {
    const current = spans.get(userId);
    spans.set(userId, {
      start: Math.min(current?.start ?? Infinity, startsAt.getTime()),
      end: Math.max(current?.end ?? -Infinity, endsAt.getTime()),
    });
  };

  const timed = scenes.filter(
    (scene): scene is ScheduledScene & { startsAt: Date; endsAt: Date } =>
      scene.startsAt !== null && scene.endsAt !== null,
  );
  const byPerson = scenesByPerson(
    timed.map((scene) => scene.sceneId),
    context,
  );
  for (const [userId, sceneIds] of byPerson) {
    for (const scene of timed) {
      if (sceneIds.includes(scene.sceneId)) extend(userId, scene.startsAt, scene.endsAt);
    }
  }
  for (const block of departmentBlocks) {
    if (!block.startsAt || !block.endsAt) continue;
    const department = context.departments.find((entry) => entry.id === block.departmentId);
    for (const userId of department?.memberIds ?? []) extend(userId, block.startsAt, block.endsAt);
  }

  return new Map(
    Array.from(spans, ([userId, span]) => [
      userId,
      { start: new Date(span.start), end: new Date(span.end) },
    ]),
  );
}

export type BlockLabelSource = {
  type: "SCENE" | "DEPARTMENT" | "CUSTOM";
  title: string | null;
  location?: string | null;
  scene: { identifier: string | null; sequence: number; title: string | null } | null;
  department: { name: string } | null;
};

/** Anzeigename eines Bausteins, z. B. „Sz. 3 Sturm“, „Bühnenbau (Gewerk Bühne)“. */
export function blockLabel(block: BlockLabelSource) {
  const room = block.location ? ` · ${block.location}` : "";
  if (block.type === "SCENE" && block.scene) {
    const { identifier, sequence, title } = block.scene;
    return `Sz. ${identifier || sequence}${title ? ` ${title}` : ""}${room}`;
  }
  if (block.type === "DEPARTMENT") {
    const name = block.department?.name ?? "Gewerk";
    return `${block.title ? `${block.title} (Gewerk ${name})` : `Gewerk ${name}`}${room}`;
  }
  return `${block.title || "Programmpunkt"}${room}`;
}
