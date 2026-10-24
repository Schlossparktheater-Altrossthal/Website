import { prisma } from "@/lib/prisma";

import { blockText, diffScripts, wordDiff, type WordDiffToken } from "./diff";
import { loadScriptReader, type ReaderBlock, type ScriptReaderData } from "./reader";
import type { CueCategory } from "./types";

/** Fassungsvergleich A → B (docs/Plan/skript-plan.md, Phase 7). */

export type CompareBlock = {
  type: "same" | "changed" | "added" | "removed";
  /** Absatz der neuen Fassung (bei „gestrichen“ der alten). */
  block: ReaderBlock;
  before: ReaderBlock | null;
  /** Rollen aus alter und neuer Fassung (inkl. Gruppenmitglieder) – „betrifft mich“ gilt für beide Seiten. */
  roleIds: string[];
  /** Gewerke, deren Hinweise sich hier geändert haben. */
  cueCategories: CueCategory[];
  /** Sprecher geändert (z. B. Replik umbesetzt). */
  speakerChanged: boolean;
  /** Wortweiser Unterschied des gesprochenen Texts, nur bei „geändert“. */
  words: WordDiffToken[] | null;
};

export type CompareScene = {
  key: string;
  title: string;
  previousTitle: string | null;
  type: "same" | "changed" | "added" | "removed";
  blocks: CompareBlock[];
};

export type ScriptComparison = {
  before: ScriptReaderData["version"];
  after: ScriptReaderData["version"];
  scenes: CompareScene[];
  stats: { same: number; changed: number; added: number; removed: number };
  roles: ScriptReaderData["roles"];
  ownRoleIds: string[];
};

export type ScriptVersionOption = {
  id: string;
  label: string;
  status: "draft" | "released";
};

function cueKey(block: ReaderBlock | null) {
  const map = new Map<CueCategory, string>();
  for (const part of block?.parts ?? []) {
    if (part.kind !== "cue") continue;
    map.set(part.category, `${map.get(part.category) ?? ""}|${part.text}`);
  }
  return map;
}

function changedCues(before: ReaderBlock | null, after: ReaderBlock | null): CueCategory[] {
  const a = cueKey(before);
  const b = cueKey(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter((key) => a.get(key) !== b.get(key));
}

function toScenes(data: ScriptReaderData) {
  return data.scenes.map((scene) => ({
    title: scene.title,
    blocks: data.blocks.filter((block) => block.sceneId === scene.id),
  }));
}

export function compareReaderData(
  before: ScriptReaderData,
  after: ScriptReaderData,
): ScriptComparison {
  const diff = diffScripts(toScenes(before), toScenes(after));
  const scenes: CompareScene[] = diff.scenes.map((scene, index) => ({
    key: `${index}`,
    title: scene.title,
    previousTitle: scene.previousTitle ?? null,
    type: scene.type,
    blocks: scene.blocks.map((change): CompareBlock => {
      const old = "before" in change ? change.before : null;
      const now = "after" in change ? change.after : null;
      const block = now ?? old;
      if (!block) throw new Error("Leerer Vergleichseintrag");
      return {
        type: change.type,
        block,
        before: old,
        roleIds: [
          ...new Set([old, now].flatMap((b) => (b ? [...b.roleIds, ...b.memberRoleIds] : []))),
        ],
        cueCategories: change.type === "same" ? [] : changedCues(old, now),
        speakerChanged: !!old && !!now && old.speaker !== now.speaker,
        words:
          change.type === "changed" && old && now ? wordDiff(blockText(old), blockText(now)) : null,
      };
    }),
  }));
  const roles = new Map(before.roles.map((role) => [role.id, role]));
  for (const role of after.roles) roles.set(role.id, role);
  return {
    before: before.version,
    after: after.version,
    scenes,
    stats: diff.stats,
    roles: [...roles.values()].sort(
      (a, b) => b.words - a.words || a.name.localeCompare(b.name, "de"),
    ),
    ownRoleIds: [...new Set([...before.ownRoleIds, ...after.ownRoleIds])],
  };
}

export async function loadScriptComparison(
  beforeId: string,
  afterId: string,
  userId: string | null,
): Promise<ScriptComparison | null> {
  const [before, after] = await Promise.all([
    loadScriptReader(beforeId, userId),
    loadScriptReader(afterId, userId),
  ]);
  if (!before || !after || before.version.showId !== after.version.showId) return null;
  return compareReaderData(before, after);
}

/** Fassungen eines Stücks für die Auswahl, neueste zuerst. Entwürfe nur für Verwalter. */
export async function listComparableVersions(
  showId: string,
  includeDrafts: boolean,
): Promise<ScriptVersionOption[]> {
  return prisma.scriptVersion.findMany({
    where: { showId, ...(includeDrafts ? {} : { status: "released" }) },
    orderBy: [{ versionDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, label: true, status: true },
  });
}

/** Standard-Vergleichspartner: die Vorfassung, sonst die nächstältere freigegebene Fassung. */
export async function previousVersion(
  versionId: string,
): Promise<{ id: string; label: string } | null> {
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: {
      showId: true,
      createdAt: true,
      basedOn: { select: { id: true, label: true } },
    },
  });
  if (!version) return null;
  if (version.basedOn) return version.basedOn;
  return prisma.scriptVersion.findFirst({
    where: {
      showId: version.showId,
      status: "released",
      id: { not: versionId },
      createdAt: { lt: version.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true },
  });
}
