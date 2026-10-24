import { isPartHeading } from "./casting";

/**
 * Übernahme-Assistent, reine Logik (docs/Plan/skript-uebernahme-plan.md, Phase 7): Was aus der
 * Fassung ins Stück soll – Szenen, Rollen, Auftritte. Schreibt nichts, schlägt nur vor.
 */

export type SyncedScene = { title?: string | null; durationMinutes?: number | null };

export type TakeoverField = {
  field: "title" | "durationMinutes";
  from: string | number | null;
  to: string | number | null;
  /** Im Stück seit der letzten Übernahme von Hand geändert → nicht vorausgewählt (E-U3). */
  handEdited: boolean;
  preselect: boolean;
};

export type TakeoverScene = {
  sceneKey: string;
  scriptTitle: string;
  title: string;
  durationMinutes: number;
  status: "linked" | "ignored" | "new";
  sceneId: string | null;
  /** Vorschlag für neue Skript-Szenen: passende Stück-Szene. */
  suggestionId: string | null;
  fields: TakeoverField[];
};

/** „SZENE 3 – ATRÉJUS AUFTRAG“ → „ATRÉJUS AUFTRAG“, „1. Szene: Im Club“ → „Im Club“. */
export function cleanSceneTitle(title: string) {
  const stripped = title
    .replace(/^\s*(?:\d+\s*[.)]?\s*)?szene\s*[\dA-Za-z]{0,4}\s*(?:[-–—:.]\s*)?/iu, "")
    .trim();
  return stripped || title.trim();
}

/** „KINDLICHE KAISERIN“ → „Kindliche Kaiserin“; gemischte Schreibweise bleibt. */
export function prettyName(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean !== clean.toLocaleUpperCase("de-DE")) return clean;
  return clean
    .toLocaleLowerCase("de-DE")
    .replace(
      /(^|[\s\-/(])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("de-DE"),
    );
}

const titleKey = (title: string | null | undefined) =>
  cleanSceneTitle(title ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function planScenes(input: {
  scriptScenes: { sceneKey: string; title: string; seconds: number; hasContent: boolean }[];
  showScenes: { id: string; title: string | null; durationMinutes: number | null }[];
  links: { sceneKey: string; sceneId: string | null; synced: SyncedScene | null }[];
}): TakeoverScene[] {
  const links = new Map(input.links.map((l) => [l.sceneKey, l]));
  const byId = new Map(input.showScenes.map((s) => [s.id, s]));
  const taken = new Set(input.links.map((l) => l.sceneId).filter(Boolean));
  const result: TakeoverScene[] = [];
  for (const scene of input.scriptScenes) {
    if (!scene.hasContent || isPartHeading(scene.title)) continue;
    const title = cleanSceneTitle(scene.title);
    const durationMinutes = Math.max(1, Math.round(scene.seconds / 60));
    const link = links.get(scene.sceneKey);
    const target = link?.sceneId ? byId.get(link.sceneId) : undefined;
    if (link && !link.sceneId) {
      result.push({
        sceneKey: scene.sceneKey,
        scriptTitle: scene.title,
        title,
        durationMinutes,
        status: "ignored",
        sceneId: null,
        suggestionId: null,
        fields: [],
      });
      continue;
    }
    if (target) {
      const synced = link?.synced ?? null;
      const fields: TakeoverField[] = [];
      const compare = (
        field: TakeoverField["field"],
        from: string | number | null,
        to: string | number,
      ) => {
        if (from === to) return;
        const syncedValue = synced?.[field];
        const handEdited = synced ? syncedValue !== from : from !== null && from !== "";
        fields.push({ field, from, to, handEdited, preselect: !handEdited });
      };
      compare("title", target.title, title);
      compare("durationMinutes", target.durationMinutes, durationMinutes);
      result.push({
        sceneKey: scene.sceneKey,
        scriptTitle: scene.title,
        title,
        durationMinutes,
        status: "linked",
        sceneId: target.id,
        suggestionId: null,
        fields,
      });
      continue;
    }
    const key = titleKey(scene.title);
    const suggestion = input.showScenes.find(
      (s) => !taken.has(s.id) && key && titleKey(s.title) === key,
    );
    if (suggestion) taken.add(suggestion.id);
    result.push({
      sceneKey: scene.sceneKey,
      scriptTitle: scene.title,
      title,
      durationMinutes,
      status: "new",
      sceneId: null,
      suggestionId: suggestion?.id ?? null,
      fields: [],
    });
  }
  return result;
}

export type AppearanceChange = { sceneId: string; characterId: string };

/**
 * Auftritte: Wer laut Skript in einer verknüpften Szene steht (spricht oder in Regie genannt),
 * gegen die Auftritte im Stück. Entfernen wird nur vorgeschlagen für Auftritte aus einer früheren
 * Übernahme (`source = script`), nie für von Hand gepflegte.
 */
export function planAppearances(input: {
  /** sceneId → Stück-Rollen laut Skript */
  wanted: Map<string, Set<string>>;
  existing: { sceneId: string; characterId: string; source: "manual" | "script" }[];
  /** Stück-Rollen, die überhaupt mit dem Skript verknüpft sind. */
  managed: ReadonlySet<string>;
}) {
  const add: AppearanceChange[] = [];
  const remove: AppearanceChange[] = [];
  const has = new Set(input.existing.map((e) => `${e.sceneId}|${e.characterId}`));
  for (const [sceneId, characters] of input.wanted) {
    for (const characterId of characters) {
      if (!has.has(`${sceneId}|${characterId}`)) add.push({ sceneId, characterId });
    }
  }
  for (const e of input.existing) {
    if (e.source !== "script" || !input.wanted.has(e.sceneId) || !input.managed.has(e.characterId))
      continue;
    if (!input.wanted.get(e.sceneId)?.has(e.characterId))
      remove.push({ sceneId: e.sceneId, characterId: e.characterId });
  }
  return { add, remove };
}
