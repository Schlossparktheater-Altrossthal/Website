import type {
  AudienceRuleType,
  CharacterCastingType,
  ParticipantOverride,
  ParticipationLevel,
} from "@prisma/client";

/**
 * Zielgruppe eines Termins: Regeln schlagen Teilnehmer vor, Handänderungen der Planung gehen vor.
 * Reine Funktionen, damit Editor (Vorschau) und Server dasselbe Ergebnis berechnen.
 */

export const AUDIENCE_RULE_TYPES = [
  "PRODUCTION_ALL",
  "ALL_CAST",
  "ALL_CREW",
  "DEPARTMENT",
  "CHARACTER",
  "SCENE",
  "USER",
] as const satisfies readonly AudienceRuleType[];

export const PARTICIPATION_LEVELS = [
  "REQUIRED",
  "OPTIONAL",
] as const satisfies readonly ParticipationLevel[];

export const PARTICIPATION_LEVEL_LABELS: Record<ParticipationLevel, string> = {
  REQUIRED: "benötigt",
  OPTIONAL: "optional",
};

/** Regeltypen, die ein Ziel brauchen (Gewerk, Rolle, Szene, Person). */
export const TARGETED_RULE_TYPES: ReadonlySet<AudienceRuleType> = new Set([
  "DEPARTMENT",
  "CHARACTER",
  "SCENE",
  "USER",
]);

/** Zweit- und Coverbesetzungen kommen automatisch als optional dazu. */
const SECOND_CAST_TYPES: ReadonlySet<CharacterCastingType> = new Set(["alternate", "cover"]);

export type AudienceRule = {
  type: AudienceRuleType;
  targetId: string | null;
  level: ParticipationLevel;
};

export type AudienceOverride = {
  userId: string;
  override: ParticipantOverride | null;
  level: ParticipationLevel | null;
};

export type AudienceContext = {
  /** Ohne Produktion: alle aktiven Mitglieder. */
  hasProduction: boolean;
  members: { id: string; name: string }[];
  castings: { characterId: string; userId: string; type: CharacterCastingType }[];
  characters: { id: string; name: string }[];
  scenes: { id: string; label: string; characterIds: string[] }[];
  departments: { id: string; name: string; memberIds: string[] }[];
};

export type ResolvedParticipant = {
  userId: string;
  name: string;
  /** Wirksame Verbindlichkeit (Handänderung vor Regel). */
  level: ParticipationLevel;
  /** Verbindlichkeit laut Regeln, null wenn keine Regel greift. */
  ruleLevel: ParticipationLevel | null;
  reasons: string[];
  override: ParticipantOverride | null;
  levelOverride: ParticipationLevel | null;
  /** Von Hand ausgenommen: bleibt in der Liste sichtbar, wird aber nicht eingeladen. */
  excluded: boolean;
};

export const MANUAL_REASON = "Von Hand hinzugefügt";

type Candidate = {
  level: ParticipationLevel;
  /** Grund → Szenen, in denen er gilt (leer = ohne Szenenbezug). */
  reasons: Map<string, Set<string>>;
};

function stronger(a: ParticipationLevel, b: ParticipationLevel): ParticipationLevel {
  return a === "REQUIRED" || b === "REQUIRED" ? "REQUIRED" : "OPTIONAL";
}

function addCandidate(
  candidates: Map<string, Candidate>,
  userId: string,
  level: ParticipationLevel,
  reason: string,
  scene?: string,
) {
  const entry = candidates.get(userId) ?? { level, reasons: new Map() };
  entry.level = candidates.has(userId) ? stronger(entry.level, level) : level;
  const scenes = entry.reasons.get(reason) ?? new Set<string>();
  if (scene) scenes.add(scene);
  entry.reasons.set(reason, scenes);
  candidates.set(userId, entry);
}

function formatReasons(reasons: Map<string, Set<string>>) {
  return Array.from(reasons, ([reason, scenes]) =>
    scenes.size ? `${reason} (${Array.from(scenes).join(", ")})` : reason,
  );
}

function castingReason(characterName: string, type: CharacterCastingType) {
  return SECOND_CAST_TYPES.has(type) ? `Zweitbesetzung ${characterName}` : characterName;
}

function addCastOf(
  candidates: Map<string, Candidate>,
  context: AudienceContext,
  characterId: string,
  level: ParticipationLevel,
  scene?: string,
) {
  const character = context.characters.find((entry) => entry.id === characterId);
  if (!character) return;
  for (const casting of context.castings) {
    if (casting.characterId !== characterId) continue;
    const castLevel = SECOND_CAST_TYPES.has(casting.type) ? "OPTIONAL" : level;
    addCandidate(
      candidates,
      casting.userId,
      castLevel,
      castingReason(character.name, casting.type),
      scene,
    );
  }
}

function applyRule(
  candidates: Map<string, Candidate>,
  rule: AudienceRule,
  context: AudienceContext,
) {
  switch (rule.type) {
    case "PRODUCTION_ALL":
      for (const member of context.members) {
        addCandidate(
          candidates,
          member.id,
          rule.level,
          context.hasProduction ? "Ganze Produktion" : "Alle Mitglieder",
        );
      }
      return;
    case "ALL_CAST":
      for (const character of context.characters) {
        addCastOf(candidates, context, character.id, rule.level);
      }
      return;
    case "ALL_CREW":
      for (const department of context.departments) {
        for (const userId of department.memberIds) {
          addCandidate(candidates, userId, rule.level, `Gewerk ${department.name}`);
        }
      }
      return;
    case "DEPARTMENT": {
      const department = context.departments.find((entry) => entry.id === rule.targetId);
      for (const userId of department?.memberIds ?? []) {
        addCandidate(candidates, userId, rule.level, `Gewerk ${department?.name}`);
      }
      return;
    }
    case "CHARACTER":
      if (rule.targetId) addCastOf(candidates, context, rule.targetId, rule.level);
      return;
    case "SCENE": {
      const scene = context.scenes.find((entry) => entry.id === rule.targetId);
      for (const characterId of scene?.characterIds ?? []) {
        addCastOf(candidates, context, characterId, rule.level, scene?.label);
      }
      return;
    }
    case "USER":
      if (rule.targetId) addCandidate(candidates, rule.targetId, rule.level, "Einzeln eingeladen");
      return;
  }
}

/** Alle Personen, die Regeln oder Handänderungen betreffen – ausgenommene mit `excluded`. */
export function resolveAudience(
  rules: readonly AudienceRule[],
  overrides: readonly AudienceOverride[],
  context: AudienceContext,
): ResolvedParticipant[] {
  const candidates = new Map<string, Candidate>();
  for (const rule of rules) applyRule(candidates, rule, context);

  const overrideByUser = new Map(overrides.map((entry) => [entry.userId, entry]));
  const names = new Map(context.members.map((member) => [member.id, member.name]));
  const userIds = new Set([...candidates.keys(), ...overrideByUser.keys()]);

  const resolved: ResolvedParticipant[] = [];
  for (const userId of userIds) {
    const candidate = candidates.get(userId);
    const manual = overrideByUser.get(userId);
    const override = manual?.override ?? null;
    if (!candidate && override !== "INCLUDED") continue;
    const ruleLevel = candidate?.level ?? null;
    const levelOverride = manual?.level ?? null;
    resolved.push({
      userId,
      name: names.get(userId) ?? "Unbekannt",
      level: levelOverride ?? ruleLevel ?? "REQUIRED",
      ruleLevel,
      reasons: candidate ? formatReasons(candidate.reasons) : [MANUAL_REASON],
      override,
      levelOverride,
      excluded: override === "EXCLUDED",
    });
  }
  return resolved.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export type AudienceDrift = {
  added: ResolvedParticipant[];
  removed: { userId: string; name: string }[];
  levelChanged: ResolvedParticipant[];
};

/** Unterschied zwischen gespeicherten Eingeladenen und der aktuellen Auflösung der Regeln. */
export function computeAudienceDrift(
  stored: readonly { userId: string; name: string; level: ParticipationLevel }[],
  resolved: readonly ResolvedParticipant[],
): AudienceDrift {
  const invited = resolved.filter((entry) => !entry.excluded);
  const storedById = new Map(stored.map((entry) => [entry.userId, entry]));
  const invitedIds = new Set(invited.map((entry) => entry.userId));
  return {
    added: invited.filter((entry) => !storedById.has(entry.userId)),
    removed: stored.filter((entry) => !invitedIds.has(entry.userId)),
    levelChanged: invited.filter((entry) => {
      const previous = storedById.get(entry.userId);
      return previous !== undefined && previous.level !== entry.level;
    }),
  };
}

export function hasAudienceDrift(drift: AudienceDrift) {
  return drift.added.length + drift.removed.length + drift.levelChanged.length > 0;
}

/** Kurzer Titel einer Regel für Chips, z. B. „Rollen aus Szene 3“. */
export function describeAudienceRule(rule: AudienceRule, context: AudienceContext) {
  const target = rule.targetId;
  switch (rule.type) {
    case "PRODUCTION_ALL":
      return context.hasProduction ? "Ganze Produktion" : "Alle Mitglieder";
    case "ALL_CAST":
      return "Alle Schauspieler";
    case "ALL_CREW":
      return "Alle Gewerke";
    case "DEPARTMENT":
      return `Gewerk ${context.departments.find((entry) => entry.id === target)?.name ?? "?"}`;
    case "CHARACTER":
      return `Rolle ${context.characters.find((entry) => entry.id === target)?.name ?? "?"}`;
    case "SCENE":
      return `Rollen aus ${context.scenes.find((entry) => entry.id === target)?.label ?? "?"}`;
    case "USER":
      return context.members.find((entry) => entry.id === target)?.name ?? "Person";
  }
}

/** Wie viele Personen eine einzelne Regel erfasst (für die Chips). */
export function countAudienceRule(rule: AudienceRule, context: AudienceContext) {
  return resolveAudience([rule], [], context).length;
}
