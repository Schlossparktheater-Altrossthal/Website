/**
 * Stabile Szenen über Fassungen (docs/Plan/skript-uebernahme-plan.md, Phase 4): Eine Szene erbt den
 * Schlüssel der Vorfassungs-Szene, aus der die meisten ihrer Absätze (`lineageId`) stammen. Jeder
 * Schlüssel geht höchstens an eine Szene – bei geteilten Szenen an die mit den meisten Treffern.
 * Ohne Treffer zählt der gleiche Titel.
 */
export function inheritSceneKeys(input: {
  scenes: { id: string; titleKey: string; lineageIds: string[] }[];
  previous: { sceneKey: string; titleKey: string; lineageIds: string[] }[];
}): Map<string, string> {
  const keyByLineage = new Map<string, string>();
  for (const scene of input.previous) {
    for (const lineageId of scene.lineageIds) keyByLineage.set(lineageId, scene.sceneKey);
  }
  const candidates: { sceneId: string; key: string; hits: number }[] = [];
  for (const scene of input.scenes) {
    const counts = new Map<string, number>();
    for (const lineageId of scene.lineageIds) {
      const key = keyByLineage.get(lineageId);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, hits] of counts) candidates.push({ sceneId: scene.id, key, hits });
  }
  candidates.sort((a, b) => b.hits - a.hits);
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const c of candidates) {
    if (result.has(c.sceneId) || used.has(c.key)) continue;
    result.set(c.sceneId, c.key);
    used.add(c.key);
  }
  for (const scene of input.scenes) {
    if (result.has(scene.id)) continue;
    const match = input.previous.find(
      (p) => p.titleKey === scene.titleKey && !used.has(p.sceneKey),
    );
    if (match) {
      result.set(scene.id, match.sceneKey);
      used.add(match.sceneKey);
    }
  }
  return result;
}
