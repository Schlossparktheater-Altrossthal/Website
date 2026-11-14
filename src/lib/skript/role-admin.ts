import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { loadScriptReader } from "./reader";
import { characterIdsFor, type GroupMode, type RoleKind } from "./role-links";
import { roleKey } from "./roles";
import { blockText } from "./diff";

/**
 * Reiter „Rollen“ im Skript (docs/Plan/skript-uebernahme-plan.md, Phase 2–3): Skript-Rollen
 * umbenennen, Art festlegen, mit Stück-Rollen verknüpfen, zusammenführen (mit Rückgängig) und
 * Gruppen pflegen. Ändert nur Zuordnungen, nie den Text einer Fassung (E5).
 */

export class ScriptRoleAdminError extends Error {}

export type AdminRole = {
  id: string;
  name: string;
  aliases: string[];
  kind: RoleKind;
  groupMode: GroupMode | null;
  linked: boolean;
  /** Verknüpfte bzw. per Name vorgeschlagene Stück-Rollen. */
  characterIds: string[];
  lines: number;
  words: number;
  scenes: number;
  /** Kommt in der aktuellen Fassung vor. */
  current: boolean;
  /** Szenen der aktuellen Fassung, in denen die Rolle spricht. */
  sceneKeys: string[];
  /** Abgetrennt von (Name) und in welchen Szenen. */
  splitFrom: { name: string; sceneKeys: string[] } | null;
};

export type AdminGroupRule = {
  id: string;
  groupRoleId: string;
  memberRoleId: string;
  sceneKey: string | null;
  lineageId: string | null;
  mode: "include" | "exclude";
};

/** Regel mit einer Personengruppe als Mitglied (docs/Plan/gruppen-plan.md). */
export type AdminGroupSetRule = {
  id: string;
  groupRoleId: string;
  setId: string;
  sceneKey: string | null;
  lineageId: string | null;
  mode: "include" | "exclude";
};

export type AdminRoleSet = { id: string; name: string; memberRoleIds: string[] };

export type AdminGroupBlock = {
  lineageId: string;
  sceneKey: string;
  speaker: string | null;
  text: string;
  roleIds: string[];
  memberRoleIds: string[];
};

export type ScriptRoleAdminData = {
  showId: string;
  version: { id: string; label: string } | null;
  roles: AdminRole[];
  characters: { id: string; name: string; castNames: string[] }[];
  scenes: { sceneKey: string; title: string }[];
  groupBlocks: AdminGroupBlock[];
  rules: AdminGroupRule[];
  setRules: AdminGroupSetRule[];
  sets: AdminRoleSet[];
  merges: {
    id: string;
    targetRoleId: string;
    sourceName: string;
    createdAt: string;
    createdByName: string | null;
  }[];
};

/** Fassung, an der Zahlen und Gruppen gezeigt werden: neueste freigegebene, sonst neuester Entwurf. */
async function currentVersion(showId: string) {
  return (
    (await prisma.scriptVersion.findFirst({
      where: { showId, status: "released" },
      orderBy: { releasedAt: "desc" },
      select: { id: true, label: true },
    })) ??
    (await prisma.scriptVersion.findFirst({
      where: { showId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true },
    }))
  );
}

export async function loadScriptRoleAdmin(showId: string): Promise<ScriptRoleAdminData> {
  const version = await currentVersion(showId);
  const [roles, characters, rules, setRules, sets, merges, reader] = await Promise.all([
    prisma.scriptRole.findMany({
      where: { showId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        aliases: true,
        kind: true,
        groupMode: true,
        linkedAt: true,
        splitFromId: true,
        splitSceneKeys: true,
        links: { select: { characterId: true } },
      },
    }),
    prisma.character.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        castings: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.scriptGroupRule.findMany({
      where: { groupRole: { showId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        groupRoleId: true,
        memberRoleId: true,
        sceneKey: true,
        lineageId: true,
        mode: true,
      },
    }),
    prisma.scriptGroupSetRule.findMany({
      where: { groupRole: { showId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        groupRoleId: true,
        setId: true,
        sceneKey: true,
        lineageId: true,
        mode: true,
      },
    }),
    prisma.scriptRoleSet.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, members: { select: { roleId: true } } },
    }),
    prisma.scriptRoleMerge.findMany({
      where: { showId, undoneAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, targetRoleId: true, source: true, createdAt: true, createdById: true },
    }),
    version ? loadScriptReader(version.id, null) : null,
  ]);

  const creatorIds = [...new Set(merges.map((m) => m.createdById).filter(Boolean))] as string[];
  const creators = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  );
  const stats = new Map(reader?.roles.map((r) => [r.id, r]) ?? []);
  const sceneKeys = new Map<string, string>();
  const scenes: ScriptRoleAdminData["scenes"] = [];
  if (version) {
    for (const scene of await prisma.scriptScene.findMany({
      where: { versionId: version.id },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true, sceneKey: true },
    })) {
      sceneKeys.set(scene.id, scene.sceneKey);
      scenes.push({ sceneKey: scene.sceneKey, title: scene.title });
    }
  }
  const groupIds = new Set(roles.filter((r) => r.kind === "group").map((r) => r.id));
  const groupBlocks: AdminGroupBlock[] = (reader?.blocks ?? [])
    .filter((block) => block.roleIds.some((id) => groupIds.has(id)))
    .map((block) => ({
      lineageId: block.lineageId,
      sceneKey: sceneKeys.get(block.sceneId) ?? "",
      speaker: block.speaker,
      text: blockText(block).slice(0, 140),
      roleIds: block.roleIds,
      memberRoleIds: block.memberRoleIds,
    }));

  const characterList = characters.map((c) => ({ id: c.id, name: c.name, shortName: c.shortName }));
  return {
    showId,
    version,
    roles: roles.map((role) => {
      const entry = stats.get(role.id);
      return {
        id: role.id,
        name: role.name,
        aliases: role.aliases,
        kind: role.kind,
        groupMode: role.groupMode,
        linked: !!role.linkedAt,
        characterIds: characterIdsFor(
          {
            ...role,
            linked: !!role.linkedAt,
            characterIds: role.links.map((l) => l.characterId),
          },
          characterList,
        ),
        lines: entry?.lines ?? 0,
        words: entry?.words ?? 0,
        scenes: entry?.sceneIds.length ?? 0,
        current: !!entry,
        sceneKeys: (entry?.sceneIds ?? []).map((id) => sceneKeys.get(id) ?? "").filter(Boolean),
        splitFrom: role.splitFromId
          ? {
              name: roles.find((r) => r.id === role.splitFromId)?.name ?? "(gelöscht)",
              sceneKeys: role.splitSceneKeys,
            }
          : null,
      };
    }),
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      castNames: c.castings.map((cast) => cast.user.name).filter((n): n is string => !!n),
    })),
    scenes,
    groupBlocks,
    rules,
    setRules,
    sets: sets.map((set) => ({
      id: set.id,
      name: set.name,
      memberRoleIds: set.members.map((m) => m.roleId),
    })),
    merges: merges.map((merge) => ({
      id: merge.id,
      targetRoleId: merge.targetRoleId,
      sourceName: readMergeSource(merge.source)?.name ?? "?",
      createdAt: merge.createdAt.toISOString(),
      createdByName: merge.createdById ? (creators.get(merge.createdById) ?? null) : null,
    })),
  };
}

async function requireRole(showId: string, roleId: string) {
  const role = await prisma.scriptRole.findFirst({
    where: { id: roleId, showId },
    select: { id: true, name: true, aliases: true },
  });
  if (!role) throw new ScriptRoleAdminError("Rolle nicht gefunden.");
  return role;
}

/** Umbenennen; der alte Name bleibt als Schreibweise, damit neue Fassungen ihn wiedererkennen. */
export async function renameScriptRole(showId: string, roleId: string, name: string) {
  const role = await requireRole(showId, roleId);
  const clean = name.trim();
  if (!clean) throw new ScriptRoleAdminError("Name fehlt.");
  if (clean === role.name) return;
  const clash = await prisma.scriptRole.findFirst({
    where: { showId, name: clean, id: { not: roleId } },
    select: { id: true },
  });
  if (clash) throw new ScriptRoleAdminError(`„${clean}“ gibt es schon – zusammenführen?`);
  const aliases = [...new Set([...role.aliases, roleKey(role.name)])].filter(
    (alias) => alias !== roleKey(clean),
  );
  await prisma.scriptRole.update({ where: { id: roleId }, data: { name: clean, aliases } });
}

export async function setScriptRoleKind(
  showId: string,
  roleId: string,
  kind: RoleKind,
  groupMode: GroupMode | null,
) {
  await requireRole(showId, roleId);
  await prisma.scriptRole.update({
    where: { id: roleId },
    data: { kind, groupMode: kind === "group" ? (groupMode ?? "present") : null },
  });
}

/** Stück-Rollen festlegen; ab jetzt gilt nur noch diese Verknüpfung (auch leer). */
export async function setScriptRoleLinks(
  showId: string,
  roleId: string,
  characterIds: string[],
  userId: string,
) {
  await requireRole(showId, roleId);
  const valid = await prisma.character.findMany({
    where: { showId, id: { in: characterIds } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.scriptRoleLink.deleteMany({ where: { scriptRoleId: roleId } }),
    prisma.scriptRoleLink.createMany({
      data: valid.map((c) => ({ scriptRoleId: roleId, characterId: c.id, createdById: userId })),
    }),
    prisma.scriptRole.update({ where: { id: roleId }, data: { linkedAt: new Date() } }),
  ]);
}

/** Zurück zur Namensgleichheit. */
export async function resetScriptRoleLinks(showId: string, roleId: string) {
  await requireRole(showId, roleId);
  await prisma.$transaction([
    prisma.scriptRoleLink.deleteMany({ where: { scriptRoleId: roleId } }),
    prisma.scriptRole.update({ where: { id: roleId }, data: { linkedAt: null } }),
  ]);
}

const mergeSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  kind: z.enum(["person", "group", "ignore"]),
  groupMode: z.enum(["cast", "present", "fixed"]).nullable(),
  linkedAt: z.string().nullable(),
  createdById: z.string().nullable(),
  characterIds: z.array(z.string()),
  /** Absätze, die vorher schon der Zielrolle gehörten (Rückgängig lässt sie dort). */
  sharedBlockIds: z.array(z.string()),
  /** Was die Zielrolle dazubekam. */
  addedAliases: z.array(z.string()),
  addedCharacterIds: z.array(z.string()),
  targetLinkedAt: z.string().nullable(),
  /** Regeln, in denen die Rolle Mitglied war (umgehängt) bzw. Gruppe war (gelöscht). */
  movedRuleIds: z.array(z.string()),
  droppedRules: z.array(
    z.object({
      groupRoleId: z.string(),
      memberRoleId: z.string(),
      sceneKey: z.string().nullable(),
      lineageId: z.string().nullable(),
      mode: z.enum(["include", "exclude"]),
    }),
  ),
  /** Personengruppen der Rolle bzw. was die Zielrolle davon neu bekam (ältere Protokolle: leer). */
  setIds: z.array(z.string()).default([]),
  addedSetIds: z.array(z.string()).default([]),
});
type MergeSource = z.infer<typeof mergeSourceSchema>;

function readMergeSource(value: unknown): MergeSource | null {
  const parsed = mergeSourceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Rolle `sourceId` in `targetId` aufgehen lassen: Absätze aller Fassungen, Schreibweisen,
 * Lernkarten, Stück-Verknüpfungen und Gruppenregeln wandern mit. Lernkarten, die es für die
 * Zielrolle schon gibt, entfallen (die der Zielrolle bleiben).
 */
export async function mergeScriptRoles(
  showId: string,
  sourceId: string,
  targetId: string,
  userId: string,
) {
  if (sourceId === targetId) throw new ScriptRoleAdminError("Rolle mit sich selbst?");
  return prisma.$transaction(async (tx) => {
    const load = (id: string) =>
      tx.scriptRole.findFirst({
        where: { id, showId },
        select: {
          id: true,
          name: true,
          aliases: true,
          kind: true,
          groupMode: true,
          linkedAt: true,
          createdById: true,
          links: { select: { characterId: true } },
        },
      });
    const [source, target] = await Promise.all([load(sourceId), load(targetId)]);
    if (!source || !target) throw new ScriptRoleAdminError("Rolle nicht gefunden.");

    const [sourceBlocks, targetBlocks] = await Promise.all([
      tx.scriptBlockRole.findMany({ where: { roleId: sourceId }, select: { blockId: true } }),
      tx.scriptBlockRole.findMany({ where: { roleId: targetId }, select: { blockId: true } }),
    ]);
    const targetSet = new Set(targetBlocks.map((b) => b.blockId));
    const blockIds = sourceBlocks.map((b) => b.blockId);
    const movedBlocks = blockIds.filter((id) => !targetSet.has(id));
    await tx.scriptBlockRole.createMany({
      data: movedBlocks.map((blockId) => ({ blockId, roleId: targetId })),
      skipDuplicates: true,
    });
    await tx.scriptBlockRole.deleteMany({ where: { roleId: sourceId } });

    const [sourceCards, targetCards] = await Promise.all([
      tx.scriptLearnCard.findMany({
        where: { roleId: sourceId },
        select: { id: true, userId: true, lineageId: true, chunk: true },
      }),
      tx.scriptLearnCard.findMany({
        where: { roleId: targetId },
        select: { userId: true, lineageId: true, chunk: true },
      }),
    ]);
    const cardKey = (c: { userId: string; lineageId: string; chunk: number }) =>
      `${c.userId}|${c.lineageId}|${c.chunk}`;
    const taken = new Set(targetCards.map(cardKey));
    const learnCardIds = sourceCards.filter((c) => !taken.has(cardKey(c))).map((c) => c.id);
    await tx.scriptLearnCard.updateMany({
      where: { id: { in: learnCardIds } },
      data: { roleId: targetId },
    });

    const sourceKeys = [roleKey(source.name), ...source.aliases];
    const addedAliases = sourceKeys.filter(
      (alias) => !target.aliases.includes(alias) && alias !== roleKey(target.name),
    );
    const targetChars = new Set(target.links.map((l) => l.characterId));
    const addedCharacterIds = source.linkedAt
      ? source.links.map((l) => l.characterId).filter((id) => !targetChars.has(id))
      : [];
    await tx.scriptRoleLink.createMany({
      data: addedCharacterIds.map((characterId) => ({
        scriptRoleId: targetId,
        characterId,
        createdById: userId,
      })),
    });
    await tx.scriptRole.update({
      where: { id: targetId },
      data: {
        aliases: [...target.aliases, ...addedAliases],
        linkedAt: target.linkedAt ?? source.linkedAt,
      },
    });

    const memberRules = await tx.scriptGroupRule.findMany({
      where: { memberRoleId: sourceId, groupRoleId: { not: targetId } },
      select: { id: true },
    });
    await tx.scriptGroupRule.updateMany({
      where: { id: { in: memberRules.map((r) => r.id) } },
      data: { memberRoleId: targetId },
    });
    // Personengruppen: die Zielrolle übernimmt die Mitgliedschaften (Rückgängig nimmt sie zurück).
    const sourceSets = await tx.scriptRoleSetMember.findMany({
      where: { roleId: sourceId },
      select: { setId: true },
    });
    const targetSets = new Set(
      (
        await tx.scriptRoleSetMember.findMany({
          where: { roleId: targetId },
          select: { setId: true },
        })
      ).map((m) => m.setId),
    );
    const addedSetIds = sourceSets.map((m) => m.setId).filter((id) => !targetSets.has(id));
    await tx.scriptRoleSetMember.createMany({
      data: addedSetIds.map((setId) => ({ setId, roleId: targetId })),
    });
    const droppedRules = await tx.scriptGroupRule.findMany({
      where: { OR: [{ groupRoleId: sourceId }, { memberRoleId: sourceId }] },
      select: {
        groupRoleId: true,
        memberRoleId: true,
        sceneKey: true,
        lineageId: true,
        mode: true,
      },
    });

    const record: MergeSource = {
      id: source.id,
      name: source.name,
      aliases: source.aliases,
      kind: source.kind,
      groupMode: source.groupMode,
      linkedAt: source.linkedAt?.toISOString() ?? null,
      createdById: source.createdById,
      characterIds: source.links.map((l) => l.characterId),
      sharedBlockIds: blockIds.filter((id) => targetSet.has(id)),
      addedAliases,
      addedCharacterIds,
      targetLinkedAt: target.linkedAt?.toISOString() ?? null,
      movedRuleIds: memberRules.map((r) => r.id),
      droppedRules,
      setIds: sourceSets.map((m) => m.setId),
      addedSetIds,
    };
    await tx.scriptRole.delete({ where: { id: sourceId } });
    return tx.scriptRoleMerge.create({
      data: {
        showId,
        targetRoleId: targetId,
        source: record,
        blockIds: movedBlocks,
        learnCardIds,
        createdById: userId,
      },
      select: { id: true },
    });
  });
}

/** Zusammenführung zurücknehmen: Rolle mit gleicher ID neu anlegen und alles zurückhängen. */
export async function undoScriptRoleMerge(showId: string, mergeId: string) {
  await prisma.$transaction(async (tx) => {
    const merge = await tx.scriptRoleMerge.findFirst({
      where: { id: mergeId, showId, undoneAt: null },
    });
    if (!merge) throw new ScriptRoleAdminError("Zusammenführung nicht gefunden.");
    const source = readMergeSource(merge.source);
    if (!source) throw new ScriptRoleAdminError("Protokoll unlesbar.");
    const target = await tx.scriptRole.findFirst({
      where: { id: merge.targetRoleId, showId },
      select: { id: true, aliases: true },
    });
    if (!target) throw new ScriptRoleAdminError("Die Zielrolle gibt es nicht mehr.");
    const clash = await tx.scriptRole.findFirst({
      where: { showId, name: source.name },
      select: { id: true },
    });
    if (clash) throw new ScriptRoleAdminError(`Es gibt schon wieder eine Rolle „${source.name}“.`);

    await tx.scriptRole.create({
      data: {
        id: source.id,
        showId,
        name: source.name,
        aliases: source.aliases,
        kind: source.kind,
        groupMode: source.groupMode,
        linkedAt: source.linkedAt ? new Date(source.linkedAt) : null,
        createdById: source.createdById,
      },
    });
    const existingChars = await tx.character.findMany({
      where: { showId, id: { in: source.characterIds } },
      select: { id: true },
    });
    await tx.scriptRoleLink.createMany({
      data: existingChars.map((c) => ({ scriptRoleId: source.id, characterId: c.id })),
    });

    const blocks = await tx.scriptBlock.findMany({
      where: { id: { in: [...merge.blockIds, ...source.sharedBlockIds] } },
      select: { id: true },
    });
    await tx.scriptBlockRole.createMany({
      data: blocks.map((b) => ({ blockId: b.id, roleId: source.id })),
      skipDuplicates: true,
    });
    await tx.scriptBlockRole.deleteMany({
      where: { roleId: target.id, blockId: { in: merge.blockIds } },
    });
    await tx.scriptLearnCard.updateMany({
      where: { id: { in: merge.learnCardIds }, roleId: target.id },
      data: { roleId: source.id },
    });

    await tx.scriptRoleLink.deleteMany({
      where: { scriptRoleId: target.id, characterId: { in: source.addedCharacterIds } },
    });
    await tx.scriptRole.update({
      where: { id: target.id },
      data: {
        aliases: target.aliases.filter((alias) => !source.addedAliases.includes(alias)),
        linkedAt: source.targetLinkedAt ? new Date(source.targetLinkedAt) : null,
      },
    });
    await tx.scriptGroupRule.updateMany({
      where: { id: { in: source.movedRuleIds } },
      data: { memberRoleId: source.id },
    });
    const roleIds = new Set(
      (
        await tx.scriptRole.findMany({
          where: {
            showId,
            id: { in: source.droppedRules.flatMap((r) => [r.groupRoleId, r.memberRoleId]) },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    );
    await tx.scriptGroupRule.createMany({
      data: source.droppedRules.filter(
        (r) => roleIds.has(r.groupRoleId) && roleIds.has(r.memberRoleId),
      ),
    });
    const sets = await tx.scriptRoleSet.findMany({
      where: { showId, id: { in: source.setIds } },
      select: { id: true },
    });
    await tx.scriptRoleSetMember.createMany({
      data: sets.map((set) => ({ setId: set.id, roleId: source.id })),
      skipDuplicates: true,
    });
    await tx.scriptRoleSetMember.deleteMany({
      where: { roleId: target.id, setId: { in: source.addedSetIds } },
    });
    await tx.scriptRoleMerge.update({ where: { id: merge.id }, data: { undoneAt: new Date() } });
  });
}

/**
 * Gruppenregeln einer Ebene ersetzen: Grundliste (`sceneKey`/`lineageId` leer), eine Szene oder
 * ein Absatz. `include` leer + `exclude` leer = Ebene zurücksetzen („wie Standard“).
 */
export async function setScriptGroupRules(input: {
  showId: string;
  groupRoleId: string;
  sceneKey: string | null;
  lineageId: string | null;
  include: string[];
  exclude: string[];
  includeSets?: string[];
  excludeSets?: string[];
  userId: string;
}) {
  const includeSets = input.includeSets ?? [];
  const excludeSets = input.excludeSets ?? [];
  const group = await prisma.scriptRole.findFirst({
    where: { id: input.groupRoleId, showId: input.showId },
    select: { kind: true },
  });
  if (!group) throw new ScriptRoleAdminError("Rolle nicht gefunden.");
  if (group.kind !== "group") throw new ScriptRoleAdminError("Die Rolle ist keine Gruppe.");
  const members = new Set(
    (
      await prisma.scriptRole.findMany({
        where: { showId: input.showId, id: { in: [...input.include, ...input.exclude] } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const setIds = new Set(
    (
      await prisma.scriptRoleSet.findMany({
        where: { showId: input.showId, id: { in: [...includeSets, ...excludeSets] } },
        select: { id: true },
      })
    ).map((set) => set.id),
  );
  const level = {
    groupRoleId: input.groupRoleId,
    sceneKey: input.lineageId ? null : input.sceneKey,
    lineageId: input.lineageId,
  };
  await prisma.$transaction([
    prisma.scriptGroupRule.deleteMany({ where: level }),
    prisma.scriptGroupSetRule.deleteMany({ where: level }),
    prisma.scriptGroupSetRule.createMany({
      data: [
        ...includeSets.map((setId) => ({ setId, mode: "include" as const })),
        ...excludeSets.map((setId) => ({ setId, mode: "exclude" as const })),
      ]
        .filter((rule) => setIds.has(rule.setId))
        .map((rule) => ({ ...level, ...rule, createdById: input.userId })),
    }),
    prisma.scriptGroupRule.createMany({
      data: [
        ...input.include.map((id) => ({ memberRoleId: id, mode: "include" as const })),
        ...input.exclude.map((id) => ({ memberRoleId: id, mode: "exclude" as const })),
      ]
        .filter((rule) => members.has(rule.memberRoleId) && rule.memberRoleId !== input.groupRoleId)
        .map((rule) => ({ ...level, ...rule, createdById: input.userId })),
    }),
  ]);
}

/**
 * Rolle trennen (Phase 5): Absätze der Rolle in den gewählten Szenen gehören ab jetzt einer neuen
 * Rolle – in allen Fassungen, mit Lernkarten. Neue Fassungen machen das bei der Freigabe von
 * selbst (`splitSceneKeys`).
 */
export async function splitScriptRole(input: {
  showId: string;
  roleId: string;
  sceneKeys: string[];
  name: string;
  userId: string;
}) {
  const role = await prisma.scriptRole.findFirst({
    where: { id: input.roleId, showId: input.showId },
    select: { id: true, kind: true, groupMode: true },
  });
  if (!role) throw new ScriptRoleAdminError("Rolle nicht gefunden.");
  const name = input.name.trim();
  if (!name) throw new ScriptRoleAdminError("Name fehlt.");
  if (!input.sceneKeys.length) throw new ScriptRoleAdminError("Keine Szene gewählt.");
  const clash = await prisma.scriptRole.findFirst({
    where: { showId: input.showId, name },
    select: { id: true },
  });
  if (clash) throw new ScriptRoleAdminError(`„${name}“ gibt es schon – zusammenführen?`);
  return prisma.$transaction(async (tx) => {
    const created = await tx.scriptRole.create({
      data: {
        showId: input.showId,
        name,
        kind: role.kind,
        groupMode: role.groupMode,
        splitFromId: role.id,
        splitSceneKeys: input.sceneKeys,
        createdById: input.userId,
      },
      select: { id: true },
    });
    const moved = await moveSplitBlocks(tx, role.id, created.id, input.sceneKeys);
    return { id: created.id, moved };
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Absätze (optional nur einer Fassung) von `fromId` an `toId` in den Szenen geben. */
export async function moveSplitBlocks(
  tx: Tx,
  fromId: string,
  toId: string,
  sceneKeys: string[],
  versionId?: string,
) {
  const links = await tx.scriptBlockRole.findMany({
    where: {
      roleId: fromId,
      block: { scene: { sceneKey: { in: sceneKeys } }, ...(versionId ? { versionId } : {}) },
    },
    select: { blockId: true, block: { select: { lineageId: true } } },
  });
  if (!links.length) return 0;
  const blockIds = links.map((l) => l.blockId);
  await tx.scriptBlockRole.createMany({
    data: blockIds.map((blockId) => ({ blockId, roleId: toId })),
    skipDuplicates: true,
  });
  await tx.scriptBlockRole.deleteMany({ where: { roleId: fromId, blockId: { in: blockIds } } });
  if (!versionId) {
    const lineageIds = [...new Set(links.map((l) => l.block.lineageId))];
    const cards = await tx.scriptLearnCard.findMany({
      where: { roleId: fromId, lineageId: { in: lineageIds } },
      select: { id: true },
    });
    await tx.scriptLearnCard.updateMany({
      where: { id: { in: cards.map((c) => c.id) } },
      data: { roleId: toId },
    });
  }
  return blockIds.length;
}

/** Bei der Freigabe: abgetrennte Rollen bekommen ihre Szenen auch in der neuen Fassung. */
export async function applyRoleSplits(showId: string, versionId: string) {
  const splits = await prisma.scriptRole.findMany({
    where: { showId, splitFromId: { not: null } },
    select: { id: true, splitFromId: true, splitSceneKeys: true },
  });
  if (!splits.length) return 0;
  return prisma.$transaction(async (tx) => {
    let moved = 0;
    for (const split of splits) {
      moved += await moveSplitBlocks(
        tx,
        split.splitFromId!,
        split.id,
        split.splitSceneKeys,
        versionId,
      );
    }
    return moved;
  });
}

/** Personengruppe anlegen oder ändern (Name + Mitglieder, nur Personen-Rollen). */
export async function saveScriptRoleSet(input: {
  showId: string;
  setId: string | null;
  name: string;
  memberRoleIds: string[];
}) {
  const name = input.name.trim();
  if (!name) throw new ScriptRoleAdminError("Name fehlt.");
  const clash = await prisma.scriptRoleSet.findFirst({
    where: { showId: input.showId, name, ...(input.setId ? { id: { not: input.setId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ScriptRoleAdminError(`„${name}“ gibt es schon.`);
  const members = (
    await prisma.scriptRole.findMany({
      where: { showId: input.showId, id: { in: input.memberRoleIds }, kind: "person" },
      select: { id: true },
    })
  ).map((r) => r.id);
  return prisma.$transaction(async (tx) => {
    let setId = input.setId;
    if (setId) {
      const found = await tx.scriptRoleSet.findFirst({
        where: { id: setId, showId: input.showId },
        select: { id: true },
      });
      if (!found) throw new ScriptRoleAdminError("Personengruppe nicht gefunden.");
      await tx.scriptRoleSet.update({ where: { id: setId }, data: { name } });
      await tx.scriptRoleSetMember.deleteMany({ where: { setId } });
    } else {
      setId = (
        await tx.scriptRoleSet.create({
          data: { showId: input.showId, name },
          select: { id: true },
        })
      ).id;
    }
    await tx.scriptRoleSetMember.createMany({
      data: members.map((roleId) => ({ setId: setId!, roleId })),
    });
    return { id: setId };
  });
}

/** Personengruppe löschen – Regeln, die sie nutzen, entfallen mit. */
export async function deleteScriptRoleSet(showId: string, setId: string) {
  const { count } = await prisma.scriptRoleSet.deleteMany({ where: { id: setId, showId } });
  if (!count) throw new ScriptRoleAdminError("Personengruppe nicht gefunden.");
}

export type GroupPassageLevel = "block" | "scene" | "base";

/** Alles für „Wer spricht hier?“ an einer Gruppenpassage im Leser (docs/Plan/gruppen-plan.md). */
export type GroupPassageData = {
  showId: string;
  sceneKey: string;
  sceneTitle: string;
  groups: {
    id: string;
    name: string;
    groupMode: GroupMode;
    /** Auswahl je Ebene („Nur …“); bei `base` und nicht-fester Grundregel: wer *nicht* dabei ist. */
    levels: Record<GroupPassageLevel, { roleIds: string[]; setIds: string[] }>;
  }[];
  people: { id: string; name: string }[];
  sets: AdminRoleSet[];
};

export async function loadGroupPassage(
  versionId: string,
  lineageId: string,
): Promise<GroupPassageData> {
  const block = await prisma.scriptBlock.findFirst({
    where: { versionId, lineageId },
    select: {
      version: { select: { showId: true } },
      scene: { select: { sceneKey: true, title: true } },
      roles: {
        select: { role: { select: { id: true, name: true, kind: true, groupMode: true } } },
      },
    },
  });
  if (!block) throw new ScriptRoleAdminError("Absatz nicht gefunden.");
  const showId = block.version.showId;
  const groups = block.roles.map((r) => r.role).filter((r) => r.kind === "group");
  if (!groups.length) throw new ScriptRoleAdminError("Der Absatz gehört keiner Gruppe.");
  const groupIds = groups.map((g) => g.id);
  const [rules, setRules, sets, people] = await Promise.all([
    prisma.scriptGroupRule.findMany({
      where: { groupRoleId: { in: groupIds } },
      select: {
        groupRoleId: true,
        memberRoleId: true,
        sceneKey: true,
        lineageId: true,
        mode: true,
      },
    }),
    prisma.scriptGroupSetRule.findMany({
      where: { groupRoleId: { in: groupIds } },
      select: { groupRoleId: true, setId: true, sceneKey: true, lineageId: true, mode: true },
    }),
    prisma.scriptRoleSet.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, members: { select: { roleId: true } } },
    }),
    prisma.scriptRole.findMany({
      where: { showId, kind: "person" },
      select: { id: true, name: true, _count: { select: { blocks: true } } },
    }),
  ]);
  const sceneKey = block.scene.sceneKey;
  const pick = (
    groupId: string,
    match: (r: { sceneKey: string | null; lineageId: string | null }) => boolean,
    mode: "include" | "exclude",
  ) => ({
    roleIds: rules
      .filter((r) => r.groupRoleId === groupId && r.mode === mode && match(r))
      .map((r) => r.memberRoleId),
    setIds: setRules
      .filter((r) => r.groupRoleId === groupId && r.mode === mode && match(r))
      .map((r) => r.setId),
  });
  return {
    showId,
    sceneKey,
    sceneTitle: block.scene.title,
    groups: groups.map((group) => {
      const groupMode = group.groupMode ?? "present";
      return {
        id: group.id,
        name: group.name,
        groupMode,
        levels: {
          block: pick(group.id, (r) => r.lineageId === lineageId, "include"),
          scene: pick(group.id, (r) => r.sceneKey === sceneKey && !r.lineageId, "include"),
          base: pick(
            group.id,
            (r) => !r.sceneKey && !r.lineageId,
            groupMode === "fixed" ? "include" : "exclude",
          ),
        },
      };
    }),
    people: people
      .sort((a, b) => b._count.blocks - a._count.blocks || a.name.localeCompare(b.name, "de"))
      .map(({ id, name }) => ({ id, name })),
    sets: sets.map((set) => ({
      id: set.id,
      name: set.name,
      memberRoleIds: set.members.map((m) => m.roleId),
    })),
  };
}
