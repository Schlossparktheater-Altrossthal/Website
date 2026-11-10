import { sceneTitleKey } from "./stats";
import type { ScriptScene } from "./types";

/**
 * Einzeln geschickte Szenen („Szene 6 neu“): Das PDF hat keine Titelseite und nur wenige Szenen.
 * Statt einer Fassung mit nur diesen Szenen entsteht die Vorfassung mit ausgetauschten Szenen.
 */

/** Szenennummer aus dem Titel („6. SZENE: …“, „20.A SZENE“, „Szene 6“), sonst Titel ohne Zusatz. */
export function sceneNumberKey(title: string): string {
  const t = title.trim();
  const lead = t.match(/^(\d+)\s*\.?\s*([a-z])?\b[\s.]*(?:szene|bild|akt)\b/i);
  if (lead) return `${lead[1]}${(lead[2] ?? "").toUpperCase()}`;
  const tail = t.match(/^(?:szene|bild)\s*(\d+)\s*\.?\s*([a-z])?\b/i);
  if (tail) return `${tail[1]}${(tail[2] ?? "").toUpperCase()}`;
  return sceneTitleKey(t.split(/[:–—-]/)[0]);
}

function numericOrder(key: string): number | null {
  const m = key.match(/^(\d+)([A-Z]?)$/);
  return m ? Number(m[1]) + (m[2] ? (m[2].charCodeAt(0) - 64) / 100 : 0) : null;
}

export type SceneMerge = {
  scenes: ScriptScene[];
  /** Ersetzte Szenen: Titel in der Vorfassung → neuer Titel. */
  replaced: { from: string; to: string }[];
  /** Neu eingefügte Szenen (ohne Gegenstück in der Vorfassung). */
  added: string[];
};

/**
 * Ist `update` eine Teillieferung zu `base`? Dann Szenen austauschen bzw. einsortieren, sonst `null`
 * (normale vollständige Fassung). Teillieferung = kein Vorspann, weniger als die Hälfte der Szenen
 * der Vorfassung und mindestens eine Szene mit gleicher Nummer.
 */
export function mergeSceneUpdate(
  base: readonly ScriptScene[],
  update: readonly ScriptScene[],
): SceneMerge | null {
  if (!base.length || !update.length) return null;
  if (update.some((s) => s.title === "(Vorspann)")) return null;
  if (update.length * 2 > base.length) return null;

  const scenes = base.map((s) => ({ ...s }));
  const baseKeys = scenes.map((s) => sceneNumberKey(s.title));
  const replaced: SceneMerge["replaced"] = [];
  const added: string[] = [];
  const pending: ScriptScene[] = [];
  for (const scene of update) {
    const index = baseKeys.indexOf(sceneNumberKey(scene.title));
    if (index < 0) {
      pending.push(scene);
      continue;
    }
    replaced.push({ from: scenes[index].title, to: scene.title });
    scenes[index] = scene;
  }
  if (!replaced.length) return null;

  for (const scene of pending) {
    const order = numericOrder(sceneNumberKey(scene.title));
    let at = scenes.length;
    if (order !== null) {
      const next = scenes.findIndex((s) => {
        const o = numericOrder(sceneNumberKey(s.title));
        return o !== null && o > order;
      });
      if (next >= 0) at = next;
    }
    scenes.splice(at, 0, scene);
    added.push(scene.title);
  }
  return { scenes, replaced, added };
}
