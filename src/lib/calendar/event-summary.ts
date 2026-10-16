import type { AudienceRuleType } from "@prisma/client";

/**
 * Kurzfassungen eines Termins für Listen und PDFs: wer ist dabei, welche Szenen.
 * Reine Funktionen – die Daten lädt die Terminplanung.
 */

export type EventAudienceSummaryInput = {
  rules: { type: AudienceRuleType; targetId: string | null }[];
  /** Gewerke aus den Probenpunkten (Spuren), zusätzlich zu den Regeln. */
  blockDepartmentIds: (string | null)[];
  invitedCount: number;
};

/** z. B. „Alle“, „Ensemble · Kostüm · Bühne“, „Ensemble (Teil) · 2 Personen“. */
export function summarizeEventAudience(
  { rules, blockDepartmentIds, invitedCount }: EventAudienceSummaryInput,
  departmentNames: Map<string, string>,
): string | null {
  if (!rules.length) {
    return invitedCount ? `${invitedCount} ${invitedCount === 1 ? "Person" : "Personen"}` : "Alle";
  }
  const types = new Set(rules.map((rule) => rule.type));
  if (types.has("PRODUCTION_ALL")) return "Alle";

  const parts: string[] = [];
  if (types.has("ALL_CAST")) parts.push("Ensemble");
  else if (types.has("CHARACTER") || types.has("SCENE")) parts.push("Ensemble (Teil)");

  if (types.has("ALL_CREW")) {
    parts.push("Gewerke");
  } else {
    const departmentIds = [
      ...rules.filter((rule) => rule.type === "DEPARTMENT").map((rule) => rule.targetId),
      ...blockDepartmentIds,
    ];
    const names = [
      ...new Set(departmentIds.flatMap((id) => (id ? [departmentNames.get(id)] : []))),
    ].filter((name): name is string => Boolean(name));
    parts.push(...names);
  }

  const users = rules.filter((rule) => rule.type === "USER").length;
  if (users) parts.push(`${users} ${users === 1 ? "Person" : "Personen"}`);
  return parts.join(" · ") || null;
}

type SceneRef = { identifier: string | null; sequence: number };

/** Szenennummern in Spielreihenfolge, lange Listen als Spanne: „1.2, 1.4“ bzw. „1.1–2.6 (14)“. */
export function summarizeEventScenes(scenes: SceneRef[], maxListed = 8): string | null {
  const unique = [...new Map(scenes.map((scene) => [scene.sequence, scene])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
  if (!unique.length) return null;
  const label = (scene: SceneRef) => scene.identifier || String(scene.sequence);
  if (unique.length <= maxListed) return unique.map(label).join(", ");
  return `${label(unique[0])}–${label(unique.at(-1)!)} (${unique.length})`;
}
