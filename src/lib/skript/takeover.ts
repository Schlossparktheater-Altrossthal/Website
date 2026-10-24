import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ensureUniqueSceneSlug, slugify } from "@/lib/produktionen/actions-helpers";
import { renumberScenes } from "@/lib/produktionen/scene-order";

import { loadScriptReader } from "./reader";
import { characterIdsFor } from "./role-links";
import { setScriptRoleLinks } from "./role-admin";
import { computeScriptStats } from "./stats";
import {
  planAppearances,
  planScenes,
  prettyName,
  type AppearanceChange,
  type SyncedScene,
  type TakeoverScene,
} from "./takeover-plan";

/**
 * Übernahme-Assistent „Ins Stück übernehmen“ (docs/Plan/skript-uebernahme-plan.md, Phase 7).
 * Drei Schritte: Szenen, Rollen, Auftritte. Löscht nie eine Szene oder Rolle; Auftritte entfernt
 * er nur, wenn sie aus einer früheren Übernahme stammen und ausdrücklich gewählt sind.
 */

export class TakeoverError extends Error {}

export type TakeoverRole = {
  id: string;
  name: string;
  suggestedName: string;
  kind: "person" | "group";
  linked: boolean;
  characterIds: string[];
  lines: number;
};

export type TakeoverData = {
  showId: string;
  version: { id: string; label: string };
  scenes: TakeoverScene[];
  roles: TakeoverRole[];
  showScenes: { id: string; label: string }[];
  characters: { id: string; name: string }[];
  appearances: { add: AppearanceChange[]; remove: AppearanceChange[] };
  includeMembers: boolean;
};

const syncedSchema = z.object({
  title: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
});

function readSynced(value: unknown): SyncedScene | null {
  const parsed = syncedSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function loadContext(showId: string, includeMembers: boolean) {
  const version = await prisma.scriptVersion.findFirst({
    where: { showId, status: "released" },
    orderBy: { releasedAt: "desc" },
    select: { id: true, label: true },
  });
  if (!version) return null;
  const [reader, scriptScenes, showScenes, links, characters, roles, existing] = await Promise.all([
    loadScriptReader(version.id, null),
    prisma.scriptScene.findMany({
      where: { versionId: version.id },
      orderBy: { sequence: "asc" },
      select: { id: true, sceneKey: true, title: true },
    }),
    prisma.scene.findMany({
      where: { showId },
      orderBy: [{ act: "asc" }, { sequence: "asc" }],
      select: { id: true, identifier: true, title: true, durationMinutes: true, act: true },
    }),
    prisma.scriptSceneLink.findMany({
      where: { showId },
      select: { sceneKey: true, sceneId: true, synced: true },
    }),
    prisma.character.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, shortName: true },
    }),
    prisma.scriptRole.findMany({
      where: { showId },
      select: {
        id: true,
        name: true,
        aliases: true,
        kind: true,
        groupMode: true,
        linkedAt: true,
        links: { select: { characterId: true } },
      },
    }),
    prisma.sceneCharacter.findMany({
      where: { scene: { showId } },
      select: { sceneId: true, characterId: true, source: true },
    }),
  ]);
  if (!reader) return null;

  const stats = computeScriptStats({
    scenes: reader.scenes,
    blocks: reader.blocks,
    roles: reader.roles,
  });
  const statById = new Map(stats.scenes.map((s) => [s.id, s]));
  const scenes = planScenes({
    scriptScenes: scriptScenes.map((scene) => {
      const stat = statById.get(scene.id);
      return {
        sceneKey: scene.sceneKey,
        title: scene.title,
        seconds: stat?.duration.seconds ?? 0,
        hasContent: !!stat && (stat.passages > 0 || stat.mentionedRoleIds.length > 0),
      };
    }),
    showScenes,
    links: links.map((l) => ({ ...l, synced: readSynced(l.synced) })),
  });

  const charsByRole = new Map(
    roles.map((role) => [
      role.id,
      characterIdsFor(
        {
          ...role,
          linked: !!role.linkedAt,
          characterIds: role.links.map((l) => l.characterId),
        },
        characters,
      ),
    ]),
  );
  const kindById = new Map(roles.map((r) => [r.id, r.kind]));

  // Auftritte je verknüpfter Szene: sprechende und in Regie genannte Rollen (wie der Spiegel).
  const sceneIdByKey = new Map(
    scenes.filter((s) => s.status === "linked").map((s) => [s.sceneKey, s.sceneId!]),
  );
  const keyByScriptScene = new Map(scriptScenes.map((s) => [s.id, s.sceneKey]));
  const wanted = new Map<string, Set<string>>();
  const addRole = (sceneId: string, roleId: string) => {
    const set = wanted.get(sceneId) ?? new Set<string>();
    for (const characterId of charsByRole.get(roleId) ?? []) set.add(characterId);
    wanted.set(sceneId, set);
  };
  for (const stat of stats.scenes) {
    const sceneId = sceneIdByKey.get(keyByScriptScene.get(stat.id) ?? "");
    if (!sceneId) continue;
    if (!wanted.has(sceneId)) wanted.set(sceneId, new Set());
    for (const role of stat.roles) addRole(sceneId, role.id);
    for (const roleId of stat.mentionedRoleIds) addRole(sceneId, roleId);
  }
  if (includeMembers) {
    for (const block of reader.blocks) {
      const sceneId = sceneIdByKey.get(keyByScriptScene.get(block.sceneId) ?? "");
      if (sceneId) for (const roleId of block.memberRoleIds) addRole(sceneId, roleId);
    }
  }
  const managed = new Set([...charsByRole.values()].flat());
  const appearances = planAppearances({ wanted, existing, managed });

  const takeoverRoles: TakeoverRole[] = reader.roles
    .filter((role) => !role.id.startsWith("name:"))
    .flatMap((role) => {
      const kind = kindById.get(role.id);
      if (kind !== "person" && kind !== "group") return [];
      const source = roles.find((r) => r.id === role.id);
      return [
        {
          id: role.id,
          name: role.name,
          suggestedName: prettyName(role.name),
          kind,
          linked: !!source?.linkedAt,
          characterIds: charsByRole.get(role.id) ?? [],
          lines: role.lines,
        },
      ];
    });

  return {
    version,
    scenes,
    showScenes,
    characters,
    roles: takeoverRoles,
    appearances,
  };
}

export async function loadTakeover(
  showId: string,
  includeMembers = false,
): Promise<TakeoverData | null> {
  const ctx = await loadContext(showId, includeMembers);
  if (!ctx) return null;
  return {
    showId,
    version: ctx.version,
    scenes: ctx.scenes,
    roles: ctx.roles,
    showScenes: ctx.showScenes.map((s) => ({
      id: s.id,
      label: [s.identifier, s.title].filter(Boolean).join(" ") || "Szene",
    })),
    characters: ctx.characters.map((c) => ({ id: c.id, name: c.name })),
    appearances: ctx.appearances,
    includeMembers,
  };
}

async function requireContext(showId: string, includeMembers = false) {
  const ctx = await loadContext(showId, includeMembers);
  if (!ctx) throw new TakeoverError("Es gibt noch keine freigegebene Fassung.");
  return ctx;
}

export type SceneTakeoverItem = {
  sceneKey: string;
  /** Stück-Szene, „new“ = anlegen, „ignore“ = nicht übernehmen. */
  target: string;
  fields: ("title" | "durationMinutes")[];
};

/** Schritt 1: Szenen zuordnen, anlegen oder ignorieren; gewählte Felder übernehmen. */
export async function applySceneTakeover(
  showId: string,
  userId: string,
  items: SceneTakeoverItem[],
) {
  const ctx = await requireContext(showId);
  const plans = new Map(ctx.scenes.map((s) => [s.sceneKey, s]));
  const showSceneIds = new Set(ctx.showScenes.map((s) => s.id));
  const previous = new Map(
    (
      await prisma.scriptSceneLink.findMany({
        where: { showId },
        select: { sceneKey: true, synced: true },
      })
    ).map((l) => [l.sceneKey, readSynced(l.synced) ?? {}]),
  );
  let created = 0;
  let updated = 0;
  let nextSequence =
    ((await prisma.scene.aggregate({ where: { showId }, _max: { sequence: true } }))._max
      .sequence ?? 0) + 1;
  const act = ctx.showScenes.at(-1)?.act ?? 1;
  for (const item of items) {
    const plan = plans.get(item.sceneKey);
    if (!plan) continue;
    const link = { showId, sceneKey: item.sceneKey };
    if (item.target === "ignore") {
      await prisma.scriptSceneLink.upsert({
        where: { showId_sceneKey: link },
        create: { ...link, sceneId: null, createdById: userId },
        update: { sceneId: null },
      });
      continue;
    }
    const values: SyncedScene = {};
    if (item.fields.includes("title")) values.title = plan.title;
    if (item.fields.includes("durationMinutes")) values.durationMinutes = plan.durationMinutes;
    let sceneId: string;
    if (item.target === "new") {
      const slug = await ensureUniqueSceneSlug(
        showId,
        slugify(plan.title) || `szene-${Date.now()}`,
      );
      const scene = await prisma.scene.create({
        data: {
          showId,
          slug,
          act,
          sequence: nextSequence++,
          title: plan.title,
          durationMinutes: plan.durationMinutes,
        },
        select: { id: true },
      });
      sceneId = scene.id;
      values.title = plan.title;
      values.durationMinutes = plan.durationMinutes;
      created++;
    } else {
      if (!showSceneIds.has(item.target)) throw new TakeoverError("Szene im Stück nicht gefunden.");
      sceneId = item.target;
      if (Object.keys(values).length) {
        await prisma.scene.update({ where: { id: sceneId }, data: values });
        updated++;
      }
    }
    const synced = { ...(previous.get(item.sceneKey) ?? {}), ...values };
    await prisma.scriptSceneLink.upsert({
      where: { showId_sceneKey: link },
      create: { ...link, sceneId, synced, syncedAt: new Date(), createdById: userId },
      update: { sceneId, synced, syncedAt: new Date() },
    });
  }
  if (created) await renumberScenes(showId);
  return { created, updated };
}

export type RoleTakeoverItem = { scriptRoleId: string; target: string };

/** Schritt 2: Skript-Rollen einer Stück-Rolle zuordnen, neu anlegen oder bewusst ohne lassen. */
export async function applyRoleTakeover(showId: string, userId: string, items: RoleTakeoverItem[]) {
  const ctx = await requireContext(showId);
  const roles = new Map(ctx.roles.map((r) => [r.id, r]));
  const characterIds = new Set(ctx.characters.map((c) => c.id));
  let order =
    (await prisma.character.aggregate({ where: { showId }, _max: { order: true } }))._max.order ??
    -1;
  let created = 0;
  for (const item of items) {
    const role = roles.get(item.scriptRoleId);
    if (!role) continue;
    let ids: string[];
    if (item.target === "none") ids = [];
    else if (item.target === "new") {
      const character = await prisma.character.create({
        data: { showId, name: role.suggestedName, order: ++order },
        select: { id: true },
      });
      ids = [character.id];
      created++;
    } else {
      if (!characterIds.has(item.target)) throw new TakeoverError("Rolle im Stück nicht gefunden.");
      ids = [...new Set([...(role.linked ? role.characterIds : []), item.target])];
    }
    await setScriptRoleLinks(showId, role.id, ids, userId);
  }
  return { created };
}

/** Schritt 3: Auftritte anlegen/entfernen – nur, was der Plan gerade vorschlägt. */
export async function applyAppearanceTakeover(
  showId: string,
  input: { add: AppearanceChange[]; remove: AppearanceChange[]; includeMembers: boolean },
) {
  const ctx = await requireContext(showId, input.includeMembers);
  const key = (c: AppearanceChange) => `${c.sceneId}|${c.characterId}`;
  const allowedAdd = new Set(ctx.appearances.add.map(key));
  const allowedRemove = new Set(ctx.appearances.remove.map(key));
  const add = input.add.filter((c) => allowedAdd.has(key(c)));
  const remove = input.remove.filter((c) => allowedRemove.has(key(c)));
  await prisma.$transaction([
    prisma.sceneCharacter.createMany({
      data: add.map((c) => ({ ...c, source: "script" as const })),
      skipDuplicates: true,
    }),
    ...remove.map((c) =>
      prisma.sceneCharacter.deleteMany({
        where: { sceneId: c.sceneId, characterId: c.characterId, source: "script" },
      }),
    ),
  ]);
  return { added: add.length, removed: remove.length };
}

/** Kurzfassung für die Fassungsliste: „2 neue Szenen · 1 Rolle offen · 6 Auftritte“ (Phase 8). */
export async function takeoverSummary(showId: string): Promise<string | null> {
  const data = await loadTakeover(showId);
  if (!data) return null;
  const count = (n: number, one: string, many: string) =>
    n ? `${n} ${n === 1 ? one : many}` : null;
  const parts = [
    count(data.scenes.filter((s) => s.status === "new").length, "neue Szene", "neue Szenen"),
    count(
      data.scenes.filter((s) => s.status === "linked" && s.fields.length).length,
      "geänderte Szene",
      "geänderte Szenen",
    ),
    count(
      data.roles.filter((r) => !r.linked && !r.characterIds.length).length,
      "Rolle offen",
      "Rollen offen",
    ),
    count(data.appearances.add.length + data.appearances.remove.length, "Auftritt", "Auftritte"),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}
