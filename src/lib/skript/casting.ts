import type { ScriptStats } from "./stats";

/**
 * Szenenspiegel und Doppelbesetzung (docs/Plan/szenenspiegel-plan.md): Rollen nach Gewicht
 * gruppieren, Anwesenheit je Szene, verträgliche Rollen und ein Bündelvorschlag.
 *
 * Entscheidungen: „nur in Regieanweisungen genannt“ zählt als anwesend; zwischen zwei
 * Auftritten derselben Person liegt standardmäßig mindestens eine Szene (Umziehen);
 * Sammelrollen („Alle“, „Chor“, „Händler“ …) zählen nicht als Person.
 */

export type RoleTier = "main" | "supporting" | "small" | "ensemble";
export type Presence = "speaks" | "mentioned";

export const ROLE_TIER_LABELS: Record<RoleTier, string> = {
  main: "Hauptrollen",
  supporting: "Nebenrollen",
  small: "Kleine Rollen",
  ensemble: "Ensemble & Gruppen",
};

const ENSEMBLE =
  /^(?:alle|beide|weitere|andere|der chor|die chor|chor|ensemble|gruppe|volk|menge|demonstranten|stimmen)\b|\bchor\b/iu;

export function isEnsembleRole(name: string) {
  return ENSEMBLE.test(name.trim());
}

/** Gruppe oder ignoriert: gepflegte Art vor Namensregel (docs/Plan/skript-uebernahme-plan.md). */
export function isEnsembleStat(role: { name: string; kind?: "person" | "group" | "ignore" }) {
  return role.kind ? role.kind !== "person" : isEnsembleRole(role.name);
}

/** Gliederung („1. TEIL“, „2. AKT“) und leere Szenen tragen keine Auftritte. */
export function isPartHeading(title: string) {
  return /^\s*(?:\d+\.?\s*(?:teil|akt)|(?:teil|akt)\s+\d+)\b/iu.test(title);
}

export type CastingRole = {
  id: string;
  name: string;
  tier: RoleTier;
  words: number;
  /** Index in `scenes` → Anwesenheit. */
  presence: Map<number, Presence>;
};

export type CastingScene = {
  id: string;
  title: string;
  seconds: number;
  /** Beginnt hier ein neuer Teil/Akt (Überschrift davor)? */
  part: string | null;
};

export type CastingModel = { scenes: CastingScene[]; roles: CastingRole[] };

export function buildCastingModel(stats: ScriptStats): CastingModel {
  const scenes: CastingScene[] = [];
  let part: string | null = null;
  const index = new Map<string, number>();
  for (const scene of stats.scenes) {
    if (isPartHeading(scene.title)) {
      part = scene.title.trim();
      continue;
    }
    if (!scene.passages && !scene.mentionedRoleIds.length) continue;
    index.set(scene.id, scenes.length);
    scenes.push({ id: scene.id, title: scene.title, seconds: scene.duration.seconds, part });
    part = null;
  }

  const presence = new Map<string, Map<number, Presence>>();
  for (const scene of stats.scenes) {
    const i = index.get(scene.id);
    if (i == null) continue;
    for (const id of scene.mentionedRoleIds) {
      if (!presence.has(id)) presence.set(id, new Map());
      presence.get(id)!.set(i, "mentioned");
    }
    for (const role of scene.roles) {
      if (!presence.has(role.id)) presence.set(role.id, new Map());
      presence.get(role.id)!.set(i, "speaks");
    }
  }

  const roles = stats.roles
    .map((role) => {
      const map = presence.get(role.id) ?? new Map<number, Presence>();
      const count = map.size;
      const tier: RoleTier = isEnsembleStat(role)
        ? "ensemble"
        : role.share >= 0.08 || count >= Math.max(4, scenes.length * 0.4)
          ? "main"
          : count >= 3
            ? "supporting"
            : "small";
      return { id: role.id, name: role.name, tier, words: role.words, presence: map };
    })
    .filter((role) => role.presence.size > 0);

  const order: RoleTier[] = ["main", "supporting", "small", "ensemble"];
  const first = (role: CastingRole) => Math.min(...role.presence.keys());
  roles.sort(
    (a, b) =>
      order.indexOf(a.tier) - order.indexOf(b.tier) ||
      (a.tier === "main" ? b.words - a.words : first(a) - first(b) || b.words - a.words),
  );
  return { scenes, roles };
}

/**
 * Kleinster Abstand zwischen Auftritten zweier Rollen in Szenen (0 = gleiche Szene,
 * 1 = direkt hintereinander). `Infinity`, wenn eine Rolle gar nicht auftritt.
 */
export function sceneDistance(a: CastingRole, b: CastingRole) {
  let best = Infinity;
  for (const i of a.presence.keys()) {
    for (const j of b.presence.keys()) best = Math.min(best, Math.abs(i - j));
  }
  return best;
}

/** Zwei Rollen sind kombinierbar, wenn mindestens `minGap` Szenen zwischen ihnen liegen. */
export function compatible(a: CastingRole, b: CastingRole, minGap: number) {
  return sceneDistance(a, b) > minGap;
}

export type Bundle = { roleIds: string[]; scenes: number };

/**
 * Bündelvorschlag (Graphfärbung nach DSatur): Hauptrollen behalten je eine eigene Person,
 * Neben- und kleine Rollen werden so zusammengelegt, dass möglichst wenige Personen nötig sind.
 * `maxRoles` begrenzt die Rollen je Person (0 = beliebig viele). Heuristisch, aber für ~50 Rollen nahe am Optimum.
 */
export function suggestBundles(model: CastingModel, minGap: number, maxRoles = 0): Bundle[] {
  const people = model.roles.filter((r) => r.tier !== "ensemble");
  const byId = new Map(people.map((r) => [r.id, r]));
  const bundles: { roleIds: string[]; locked: boolean }[] = people
    .filter((r) => r.tier === "main")
    .map((r) => ({ roleIds: [r.id], locked: true }));
  const fits = (bundle: { roleIds: string[] }, role: CastingRole) =>
    (!maxRoles || bundle.roleIds.length < maxRoles) &&
    bundle.roleIds.every((id) => compatible(byId.get(id)!, role, minGap));

  const open = people.filter((r) => r.tier !== "main");
  const conflicts = new Map(
    open.map((r) => [r.id, open.filter((o) => o !== r && !compatible(o, r, minGap)).length]),
  );
  const placed = new Map<string, number>();
  while (placed.size < open.length) {
    // Rolle mit den meisten bereits blockierten Bündeln zuerst, dann die meistbelegte.
    let pick: CastingRole | null = null;
    let pickSat = -1;
    for (const role of open) {
      if (placed.has(role.id)) continue;
      const sat = bundles.filter((b) => !b.locked && !fits(b, role)).length;
      const better =
        sat > pickSat ||
        (sat === pickSat &&
          (conflicts.get(role.id)! > conflicts.get(pick!.id)! ||
            (conflicts.get(role.id) === conflicts.get(pick!.id) &&
              role.presence.size > pick!.presence.size)));
      if (better) {
        pick = role;
        pickSat = sat;
      }
    }
    const role = pick!;
    // Ins vollste passende Bündel – so bleiben wenige, gut ausgelastete Personen übrig.
    let target = -1;
    let best = -1;
    bundles.forEach((b, i) => {
      if (b.locked || !fits(b, role)) return;
      const load = b.roleIds.reduce((n, id) => n + byId.get(id)!.presence.size, 0);
      if (load > best) {
        best = load;
        target = i;
      }
    });
    if (target < 0) {
      bundles.push({ roleIds: [role.id], locked: false });
      target = bundles.length - 1;
    } else {
      bundles[target].roleIds.push(role.id);
    }
    placed.set(role.id, target);
  }
  return bundles.map((b) => ({
    roleIds: b.roleIds,
    scenes: b.roleIds.reduce((n, id) => n + byId.get(id)!.presence.size, 0),
  }));
}

/** Untergrenze: so viele Personen stehen in der vollsten Szene gleichzeitig auf der Bühne. */
export function minimumCast(model: CastingModel) {
  let max = 0;
  model.scenes.forEach((_, i) => {
    max = Math.max(
      max,
      model.roles.filter((r) => r.tier !== "ensemble" && r.presence.has(i)).length,
    );
  });
  return max;
}

/** Konflikte innerhalb eines Bündels: Rollenpaare, die zu dicht beieinander auftreten. */
export function bundleConflicts(model: CastingModel, roleIds: string[], minGap: number) {
  const byId = new Map(model.roles.map((r) => [r.id, r]));
  const result: { a: string; b: string; distance: number }[] = [];
  for (let i = 0; i < roleIds.length; i++) {
    for (let j = i + 1; j < roleIds.length; j++) {
      const a = byId.get(roleIds[i]);
      const b = byId.get(roleIds[j]);
      if (!a || !b) continue;
      const distance = sceneDistance(a, b);
      if (distance <= minGap) result.push({ a: a.id, b: b.id, distance });
    }
  }
  return result;
}
