import type { ReaderBlock, ReaderRole, ReaderScene } from "./reader";
import { splitTail } from "./reader-logic";
import type { CueCategory, ScriptPart } from "./types";

/**
 * Auswertungen einer Fassung (docs/Plan/skript-auswertungen-plan.md, Phase 2): rein, testbar,
 * client-sicher. Gemeinsame Repliken zählen voll für jede beteiligte Rolle (E4); Dauern sind
 * geschätzt, solange keine gemessene Zeit vorliegt (E3).
 */

export const STATS_WORDS_PER_MINUTE = 130;
export const CUE_CATEGORIES: CueCategory[] = [
  "ton",
  "licht",
  "nebel",
  "effekt",
  "umbau",
  "aus",
  "technik",
];

export type StatsInput = {
  scenes: Pick<ReaderScene, "id" | "title">[];
  blocks: Pick<
    ReaderBlock,
    "id" | "sceneId" | "kind" | "speaker" | "roleIds" | "parts" | "words" | "page"
  >[];
  roles: Pick<ReaderRole, "id" | "name">[];
  /** Gemessene Szenendauer in Sekunden (z. B. aus Durchläufen); hat Vorrang vor der Schätzung. */
  measuredSeconds?: ReadonlyMap<string, number>;
};

export type Duration = { seconds: number; estimated: boolean };

export type RoleStat = {
  id: string;
  name: string;
  words: number;
  passages: number;
  /** Anteil an allen gesprochenen Wörtern (0–1). */
  share: number;
  longestPassage: number;
  sceneIds: string[];
};

export type CueEntry = {
  /** Laufende Nummer je Kategorie über das ganze Stück. */
  number: number;
  category: CueCategory;
  text: string;
  sceneId: string;
  blockId: string;
  page: number | null;
  /** Letzte gesprochene Wörter davor (Stichwort fürs Pult). */
  after: string;
};

export type SceneStat = {
  id: string;
  title: string;
  words: number;
  passages: number;
  pages: { from: number; to: number } | null;
  duration: Duration;
  /** Sprechende Rollen, nach Wörtern absteigend. */
  roles: { id: string; words: number; passages: number }[];
  /** Nur in Regieanweisungen genannt (stumm auf der Bühne?). */
  mentionedRoleIds: string[];
  cues: Record<CueCategory, CueEntry[]>;
};

export type RoleGap = {
  roleId: string;
  afterSceneId: string;
  untilSceneId: string;
  scenes: number;
};

export type CueScriptLine = {
  blockId: string;
  sceneId: string;
  /** Wer davor spricht und die letzten Wörter („Stichwort“). */
  cueSpeaker: string | null;
  cue: string;
  text: string;
};

export type ScriptStats = {
  totalWords: number;
  totalPassages: number;
  duration: Duration;
  roles: RoleStat[];
  scenes: SceneStat[];
  cues: CueEntry[];
  /** Pausen je Rolle zwischen zwei Auftritten (Szenen ohne Text). */
  gaps: RoleGap[];
};

const textOf = (parts: readonly ScriptPart[], kinds: ScriptPart["kind"][]) =>
  parts
    .filter((part) => kinds.includes(part.kind))
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export function estimateSeconds(words: number) {
  return Math.round((words / STATS_WORDS_PER_MINUTE) * 60);
}

function emptyCues(): Record<CueCategory, CueEntry[]> {
  return { ton: [], licht: [], nebel: [], effekt: [], umbau: [], aus: [], technik: [] };
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function computeScriptStats(input: StatsInput): ScriptStats {
  const roleName = new Map(input.roles.map((role) => [role.id, role.name]));
  const roleStats = new Map<string, RoleStat>();
  const sceneStats = new Map<string, SceneStat>();
  for (const scene of input.scenes) {
    sceneStats.set(scene.id, {
      id: scene.id,
      title: scene.title,
      words: 0,
      passages: 0,
      pages: null,
      duration: { seconds: 0, estimated: true },
      roles: [],
      mentionedRoleIds: [],
      cues: emptyCues(),
    });
  }
  const sceneRoles = new Map<string, Map<string, { words: number; passages: number }>>();
  const directionText = new Map<string, string[]>();
  const cues: CueEntry[] = [];
  const numbers = new Map<CueCategory, number>();
  let lastSpoken = "";
  let totalWords = 0;
  let totalPassages = 0;

  for (const block of input.blocks) {
    const scene = sceneStats.get(block.sceneId);
    if (!scene) continue;
    if (block.page != null) {
      scene.pages = scene.pages
        ? { from: Math.min(scene.pages.from, block.page), to: Math.max(scene.pages.to, block.page) }
        : { from: block.page, to: block.page };
    }
    const directions = textOf(block.parts, ["direction"]);
    if (directions) {
      const list = directionText.get(block.sceneId) ?? [];
      list.push(directions);
      directionText.set(block.sceneId, list);
    }
    // Hinweise der Reihe nach; Stichwort = gesprochener Text davor (auch im selben Absatz).
    let spokenBefore = lastSpoken;
    for (const part of block.parts) {
      if (part.kind === "text") {
        spokenBefore = `${spokenBefore} ${part.text}`;
      } else if (part.kind === "cue") {
        const number = (numbers.get(part.category) ?? 0) + 1;
        numbers.set(part.category, number);
        const entry: CueEntry = {
          number,
          category: part.category,
          text: part.text.trim(),
          sceneId: block.sceneId,
          blockId: block.id,
          page: block.page,
          after: splitTail(spokenBefore.replace(/\s+/g, " ").trim(), 8)[1],
        };
        cues.push(entry);
        scene.cues[part.category].push(entry);
      }
    }
    if (block.kind !== "speech") continue;
    const spoken = textOf(block.parts, ["text"]);
    if (spoken) lastSpoken = spoken;
    totalWords += block.words;
    totalPassages += 1;
    scene.words += block.words;
    scene.passages += 1;
    const perScene = sceneRoles.get(block.sceneId) ?? new Map();
    sceneRoles.set(block.sceneId, perScene);
    for (const roleId of new Set(block.roleIds)) {
      const stat = roleStats.get(roleId) ?? {
        id: roleId,
        name: roleName.get(roleId) ?? roleId,
        words: 0,
        passages: 0,
        share: 0,
        longestPassage: 0,
        sceneIds: [],
      };
      stat.words += block.words;
      stat.passages += 1;
      stat.longestPassage = Math.max(stat.longestPassage, block.words);
      if (!stat.sceneIds.includes(block.sceneId)) stat.sceneIds.push(block.sceneId);
      roleStats.set(roleId, stat);
      const cell = perScene.get(roleId) ?? { words: 0, passages: 0 };
      cell.words += block.words;
      cell.passages += 1;
      perScene.set(roleId, cell);
    }
  }

  let totalSeconds = 0;
  let anyEstimated = false;
  for (const scene of sceneStats.values()) {
    const measured = input.measuredSeconds?.get(scene.id);
    scene.duration =
      measured != null
        ? { seconds: measured, estimated: false }
        : { seconds: estimateSeconds(scene.words), estimated: true };
    totalSeconds += scene.duration.seconds;
    if (scene.duration.estimated && scene.words) anyEstimated = true;
    scene.roles = [...(sceneRoles.get(scene.id) ?? new Map())]
      .map(([id, cell]) => ({ id, ...cell }))
      .sort((a, b) => b.words - a.words);
    const speaking = new Set(scene.roles.map((r) => r.id));
    const directions = (directionText.get(scene.id) ?? []).join(" ");
    scene.mentionedRoleIds = directions
      ? input.roles
          .filter(
            (role) =>
              !speaking.has(role.id) &&
              role.name.length > 2 &&
              new RegExp(`(^|[^\\p{L}])${escapeRe(role.name)}($|[^\\p{L}])`, "iu").test(directions),
          )
          .map((role) => role.id)
      : [];
  }

  const sceneOrder = new Map(input.scenes.map((scene, index) => [scene.id, index]));
  const roles = [...roleStats.values()]
    .map((stat) => ({
      ...stat,
      share: totalWords ? stat.words / totalWords : 0,
      sceneIds: [...stat.sceneIds].sort(
        (a, b) => (sceneOrder.get(a) ?? 0) - (sceneOrder.get(b) ?? 0),
      ),
    }))
    .sort((a, b) => b.words - a.words || a.name.localeCompare(b.name, "de"));

  const gaps: RoleGap[] = [];
  for (const role of roles) {
    for (let i = 1; i < role.sceneIds.length; i++) {
      const from = sceneOrder.get(role.sceneIds[i - 1]) ?? 0;
      const to = sceneOrder.get(role.sceneIds[i]) ?? 0;
      if (to - from > 1) {
        gaps.push({
          roleId: role.id,
          afterSceneId: role.sceneIds[i - 1],
          untilSceneId: role.sceneIds[i],
          scenes: to - from - 1,
        });
      }
    }
  }

  return {
    totalWords,
    totalPassages,
    duration: { seconds: totalSeconds, estimated: anyEstimated },
    roles,
    scenes: input.scenes.map((scene) => sceneStats.get(scene.id) as SceneStat),
    cues,
    gaps,
  };
}

/**
 * Stichwortheft: eigene Repliken mit den letzten Wörtern der Replik davor. Direkt aufeinander
 * folgende eigene Repliken bekommen kein Stichwort.
 */
export function cueScript(input: StatsInput, roleIds: readonly string[], cueWords = 8) {
  const own = new Set(roleIds);
  const lines: CueScriptLine[] = [];
  let previous: { speaker: string | null; text: string; own: boolean } | null = null;
  for (const block of input.blocks) {
    if (block.kind !== "speech") continue;
    const text = textOf(block.parts, ["text"]);
    const mine = block.roleIds.some((id) => own.has(id));
    if (mine) {
      lines.push({
        blockId: block.id,
        sceneId: block.sceneId,
        cueSpeaker: previous && !previous.own ? previous.speaker : null,
        cue: previous && !previous.own ? splitTail(previous.text, cueWords)[1] : "",
        text,
      });
    }
    previous = { speaker: block.speaker, text, own: mine };
  }
  return lines;
}

/** „1:05 h“, „12 min“, mit „ca.“ bei Schätzung. */
export function formatDuration(duration: Duration) {
  const minutes = Math.round(duration.seconds / 60);
  const value =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`
      : `${minutes} min`;
  return duration.estimated ? `ca. ${value}` : value;
}
