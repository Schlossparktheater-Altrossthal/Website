import { roleKey } from "./roles";

/**
 * Skript-Rolle ↔ Besetzung und Gruppenrollen („Alle“, „Chor“) – reine Logik ohne DB
 * (docs/Plan/skript-uebernahme-plan.md).
 */

export type RoleKind = "person" | "group" | "ignore";
export type GroupMode = "cast" | "present" | "fixed";

export type LinkRole = {
  id: string;
  name: string;
  aliases: string[];
  kind: RoleKind;
  groupMode: GroupMode | null;
  /** Von Hand zugeordnet → nur `characterIds` zählen, sonst Namensgleichheit. */
  linked: boolean;
  characterIds: string[];
};

export type LinkCasting = {
  userId: string;
  characterId: string;
  name: string;
  shortName: string | null;
};

export type GroupRule = {
  groupRoleId: string;
  memberRoleId: string;
  sceneKey: string | null;
  lineageId: string | null;
  mode: "include" | "exclude";
};

/** Namensvergleich wie bisher: Stück-Rolle heißt wie die Skript-Rolle oder einer ihrer Aliase. */
export function nameMatches(role: Pick<LinkRole, "name" | "aliases">, names: (string | null)[]) {
  const keys = new Set(names.filter((n): n is string => !!n).map(roleKey));
  return [role.name, ...role.aliases].some((name) => keys.has(roleKey(name)));
}

/** Stück-Rollen, zu denen eine Skript-Rolle gehört (verknüpft oder per Name vorgeschlagen). */
export function characterIdsFor(
  role: LinkRole,
  characters: { id: string; name: string; shortName: string | null }[],
) {
  if (role.linked) return role.characterIds;
  if (role.kind === "ignore") return [];
  return characters.filter((c) => nameMatches(role, [c.name, c.shortName])).map((c) => c.id);
}

/**
 * Skript-Rollen je Person. Gruppenrollen bekommt nur, wer über eine verknüpfte Stück-Rolle
 * dazugehört (z. B. „Ensemble“) oder besetzt ist, aber keine eigene Sprechrolle hat – sonst
 * entscheidet die Gruppenauflösung je Absatz.
 */
export function roleIdsByUser(roles: LinkRole[], castings: LinkCasting[]) {
  const characters = new Map<string, { id: string; name: string; shortName: string | null }>();
  const usersByCharacter = new Map<string, Set<string>>();
  for (const casting of castings) {
    characters.set(casting.characterId, {
      id: casting.characterId,
      name: casting.name,
      shortName: casting.shortName,
    });
    const users = usersByCharacter.get(casting.characterId) ?? new Set<string>();
    users.add(casting.userId);
    usersByCharacter.set(casting.characterId, users);
  }
  const list = [...characters.values()];
  const result = new Map<string, string[]>();
  const add = (userId: string, roleId: string) => {
    const ids = result.get(userId) ?? [];
    if (!ids.includes(roleId)) ids.push(roleId);
    result.set(userId, ids);
  };
  for (const role of roles) {
    if (role.kind === "ignore") continue;
    if (role.kind === "group" && !role.linked) continue;
    for (const characterId of characterIdsFor(role, list)) {
      for (const userId of usersByCharacter.get(characterId) ?? []) add(userId, role.id);
    }
  }
  const castOnly = [...new Set(castings.map((c) => c.userId))].filter((u) => !result.has(u));
  for (const role of roles) {
    if (role.kind !== "group" || role.groupMode !== "cast") continue;
    for (const userId of castOnly) add(userId, role.id);
  }
  return result;
}

export type GroupBlock = { lineageId: string; sceneKey: string; roleIds: string[] };

/**
 * Wer spricht bei einer Gruppenrolle in einem Absatz mit. Vorrang: Absatz vor Szene vor
 * Grundregel. Auf jeder Ebene ersetzen „include“-Regeln die Liste („hier nur …“),
 * „exclude“-Regeln nehmen heraus („ohne …“).
 *
 * @param castRoleIds Personen-Rollen mit Besetzung (Grundregel `cast`)
 * @param sceneRoleIds Personen-Rollen, die in der Szene vorkommen (Grundregel `present`)
 */
export function resolveGroupMembers(input: {
  group: Pick<LinkRole, "id" | "groupMode">;
  rules: GroupRule[];
  block: GroupBlock;
  castRoleIds: readonly string[];
  sceneRoleIds: readonly string[];
}): string[] {
  const { group, block } = input;
  const rules = input.rules.filter((rule) => rule.groupRoleId === group.id);
  const base = rules.filter((r) => !r.sceneKey && !r.lineageId);
  let members: Set<string>;
  switch (group.groupMode ?? "present") {
    case "cast":
      members = new Set(input.castRoleIds);
      break;
    case "present":
      members = new Set(input.sceneRoleIds);
      break;
    case "fixed":
      members = new Set(base.filter((r) => r.mode === "include").map((r) => r.memberRoleId));
      break;
  }
  if (group.groupMode !== "fixed") {
    for (const r of base) {
      if (r.mode === "include") members.add(r.memberRoleId);
    }
  }
  for (const r of base) if (r.mode === "exclude") members.delete(r.memberRoleId);

  const apply = (level: GroupRule[]) => {
    const includes = level.filter((r) => r.mode === "include").map((r) => r.memberRoleId);
    if (includes.length) members = new Set(includes);
    for (const r of level) if (r.mode === "exclude") members.delete(r.memberRoleId);
  };
  apply(rules.filter((r) => r.sceneKey === block.sceneKey && !r.lineageId));
  apply(rules.filter((r) => r.lineageId === block.lineageId));

  members.delete(group.id);
  return [...members];
}

/** Gehört der Absatz zu den gewählten Rollen – direkt oder über eine Gruppe? */
export function blockHasRole(
  block: { roleIds: string[]; memberRoleIds?: string[] },
  roleIds: ReadonlySet<string>,
  includeGroups = true,
) {
  if (block.roleIds.some((id) => roleIds.has(id))) return true;
  return includeGroups && !!block.memberRoleIds?.some((id) => roleIds.has(id));
}

/**
 * Rollen, unter denen ein Absatz gelernt wird: die eigenen direkt, sonst die Gruppenrolle(n),
 * über die man dazugehört.
 */
export function learnRoleIds(
  block: { roleIds: string[]; memberRoleIds?: string[] },
  selected: ReadonlySet<string>,
  includeGroups: boolean,
  groupRoleIds: ReadonlySet<string>,
) {
  const direct = block.roleIds.filter((id) => selected.has(id));
  if (direct.length || !includeGroups) return direct;
  if (!block.memberRoleIds?.some((id) => selected.has(id))) return [];
  return block.roleIds.filter((id) => groupRoleIds.has(id));
}
