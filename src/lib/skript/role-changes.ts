/**
 * „Autor ändert Rollen“ (docs/Plan/skript-uebernahme-plan.md, Phase 5): Erkennt über die
 * zugeordneten Absätze der Vorfassung, ob ein neuer Sprechername eine alte Rolle umbenennt,
 * mehrere zusammenlegt oder aus einer aufgeteilten Rolle stammt. Reine Logik, nur Vorschläge.
 */

export type RoleChangeKind = "rename" | "merge" | "split";

export type RoleChange = {
  /** Neuer Sprechername in dieser Fassung. */
  name: string;
  kind: RoleChangeKind;
  /** Rollen der Vorfassung, aus denen die Absätze stammen (größter Anteil zuerst). */
  sources: { roleId: string; share: number }[];
};

/** Mindestanteil der wiedererkannten Absätze, die aus verschwundenen Rollen stammen. */
const MIN_TOTAL_SHARE = 0.6;
/** Ab diesem Anteil zählt eine alte Rolle als Quelle. */
const MIN_SOURCE_SHARE = 0.2;
/** Mindestens so viele wiedererkannte Absätze, sonst ist es Zufall. */
const MIN_MATCHED = 2;

export function detectRoleChanges(input: {
  /** Neue, noch unbekannte Sprechernamen → je Absatz die Rollen des Vorgänger-Absatzes. */
  unknown: Map<string, string[][]>;
  /** Rollen der Vorfassung, die in dieser Fassung nicht mehr vorkommen. */
  vanished: ReadonlySet<string>;
}): RoleChange[] {
  const found: RoleChange[] = [];
  for (const [name, blocks] of input.unknown) {
    const matched = blocks.filter((roles) => roles.length);
    if (matched.length < MIN_MATCHED) continue;
    const counts = new Map<string, number>();
    for (const roles of matched) {
      for (const roleId of roles) {
        if (input.vanished.has(roleId)) counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
      }
    }
    const sources = [...counts]
      .map(([roleId, n]) => ({ roleId, share: n / matched.length }))
      .filter((s) => s.share >= MIN_SOURCE_SHARE)
      .sort((a, b) => b.share - a.share);
    const total = matched.filter((roles) =>
      roles.some((id) => sources.some((s) => s.roleId === id)),
    ).length;
    if (!sources.length || total / matched.length < MIN_TOTAL_SHARE) continue;
    found.push({ name, kind: sources.length > 1 ? "merge" : "rename", sources });
  }
  // Eine verschwundene Rolle, die mehrere neue Namen speist, wurde aufgeteilt.
  const bySingleSource = new Map<string, RoleChange[]>();
  for (const change of found) {
    if (change.kind !== "rename") continue;
    const list = bySingleSource.get(change.sources[0].roleId) ?? [];
    list.push(change);
    bySingleSource.set(change.sources[0].roleId, list);
  }
  for (const list of bySingleSource.values()) {
    if (list.length > 1) for (const change of list) change.kind = "split";
  }
  return found;
}
