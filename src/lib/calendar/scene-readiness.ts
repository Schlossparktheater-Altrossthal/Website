import type { AudienceContext } from "@/lib/calendar/audience";

/** Warum jemand an einem Tag nicht (voll) da ist. `limited` zählt als „eingeschränkt“. */
export type Absence = {
  kind: "blocked" | "limited" | "declined" | "parallel";
  reason?: string | null;
};

export type SceneReadinessStatus = "ready" | "alternate" | "limited" | "missing";

export type RoleIssue = {
  characterId: string;
  characterName: string;
  status: Exclude<SceneReadinessStatus, "ready">;
  /** Hauptbesetzung, die fehlt oder eingeschränkt ist. */
  absent: { userId: string; name: string; absence: Absence }[];
  /** Wer stattdessen spielen kann (Zweitbesetzung/Cover). */
  substitute: { userId: string; name: string } | null;
};

/** Eine Rolle der Szene mit der Person, die an dem Tag spielt (oder fehlt). */
export type RoleCast = {
  characterId: string;
  characterName: string;
  /** Kurzname der Rolle, sonst der Name. */
  short: string;
  /** Wer die Rolle an dem Tag spielt (Hauptbesetzung, sonst Zweitbesetzung). */
  player: { userId: string; name: string } | null;
  status: SceneReadinessStatus;
};

export type SceneReadiness = {
  sceneId: string;
  label: string;
  status: SceneReadinessStatus;
  issues: RoleIssue[];
  /** Rollen der Szene ohne Besetzung. */
  uncast: string[];
  /** Alle besetzten Rollen der Szene in Stückreihenfolge. */
  roles: RoleCast[];
  /**
   * Jede Rolle hat jemanden. Szenen ohne Rollen oder mit unbesetzten Rollen lassen sich
   * nicht planen und werden beim Anlegen von Proben ausgeblendet.
   */
  fullyCast: boolean;
};

type ReadinessContext = Pick<AudienceContext, "scenes" | "castings" | "characters" | "members">;

const RANK: Record<SceneReadinessStatus, number> = {
  ready: 0,
  alternate: 1,
  limited: 2,
  missing: 3,
};

export const READINESS_ORDER: SceneReadinessStatus[] = ["ready", "alternate", "limited", "missing"];

export const READINESS_LABEL: Record<SceneReadinessStatus, string> = {
  ready: "vollständig",
  alternate: "mit Zweitbesetzung",
  limited: "eingeschränkt",
  missing: "fehlt jemand",
};

const ABSENCE_LABEL: Record<Absence["kind"], string> = {
  blocked: "gesperrt",
  limited: "eingeschränkt",
  declined: "abgesagt",
  parallel: "anderer Termin",
};

export function describeAbsence(absence: Absence) {
  const reason = absence.reason?.trim();
  return reason ? reason : ABSENCE_LABEL[absence.kind];
}

/**
 * Probbarkeit jeder Szene an einem Tag: Hauptbesetzung da → vollständig; sonst Zweitbesetzung
 * oder Cover → „mit Zweitbesetzung“; nur eingeschränkt verfügbar → „eingeschränkt“; niemand → fehlt.
 * Bei mehreren Hauptbesetzungen einer Rolle (Gruppen, Doppelbesetzung) reicht eine.
 */
export function computeSceneReadiness(
  context: ReadinessContext,
  absences: Partial<Record<string, Absence>>,
): SceneReadiness[] {
  const names = new Map(context.members.map((member) => [member.id, member.name]));
  const characterById = new Map(context.characters.map((entry) => [entry.id, entry]));
  const nameOf = (userId: string) => names.get(userId) ?? "Unbekannt";
  const isFree = (userId: string) => !absences[userId];
  const isLimited = (userId: string) => absences[userId]?.kind === "limited";

  return context.scenes.map((scene) => {
    const issues: RoleIssue[] = [];
    const uncast: string[] = [];
    const roles: RoleCast[] = [];
    for (const characterId of scene.characterIds) {
      const character = characterById.get(characterId);
      const characterName = character?.name ?? "Rolle";
      const short = character?.shortName?.trim() || characterName;
      const castings = context.castings.filter(
        (entry) => entry.characterId === characterId && entry.type !== "cameo",
      );
      if (!castings.length) {
        uncast.push(characterName);
        continue;
      }
      const primaries = castings.filter((entry) => entry.type === "primary");
      const others = castings.filter((entry) => entry.type !== "primary");
      const freePrimary = primaries.find((entry) => isFree(entry.userId));
      if (freePrimary) {
        roles.push({
          characterId,
          characterName,
          short,
          player: { userId: freePrimary.userId, name: nameOf(freePrimary.userId) },
          status: "ready",
        });
        continue;
      }

      const absent = primaries.map((entry) => ({
        userId: entry.userId,
        name: nameOf(entry.userId),
        absence: absences[entry.userId] ?? { kind: "blocked" as const },
      }));
      const freeOther = others.find((entry) => isFree(entry.userId));
      let status: RoleIssue["status"];
      let substitute: RoleIssue["substitute"] = null;
      if (freeOther) {
        status = "alternate";
        substitute = { userId: freeOther.userId, name: nameOf(freeOther.userId) };
      } else if (castings.some((entry) => isLimited(entry.userId))) {
        status = "limited";
      } else {
        status = "missing";
      }
      issues.push({ characterId, characterName, status, absent, substitute });
      const fallback = substitute ?? absent[0] ?? null;
      roles.push({
        characterId,
        characterName,
        short,
        player: fallback ? { userId: fallback.userId, name: fallback.name } : null,
        status,
      });
    }
    const status = issues.reduce<SceneReadinessStatus>(
      (worst, issue) => (RANK[issue.status] > RANK[worst] ? issue.status : worst),
      "ready",
    );
    return {
      sceneId: scene.id,
      label: scene.label,
      status,
      issues,
      uncast,
      roles,
      fullyCast: scene.characterIds.length > 0 && uncast.length === 0,
    };
  });
}

/** Kurztext einer Szene, z. B. „Titania fehlt (Katharina: Urlaub)“. */
export function describeReadiness(entry: SceneReadiness) {
  return entry.issues
    .map((issue) => {
      const who = issue.absent
        .map((person) => `${person.name.split(" ")[0]}: ${describeAbsence(person.absence)}`)
        .join(", ");
      if (issue.status === "alternate" && issue.substitute)
        return `${issue.characterName}: ${issue.substitute.name.split(" ")[0]} statt ${who}`;
      const verb = issue.status === "limited" ? "eingeschränkt" : "fehlt";
      return `${issue.characterName} ${verb}${who ? ` (${who})` : ""}`;
    })
    .join(" · ");
}

/** Vorname – kurz für enge Zeilen. */
export function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

/** Rollen einer Szene als Text: „Oberon · Titania fehlt (Kat) · Helena: Emma“. */
export function describeCast(entry: Pick<SceneReadiness, "roles" | "issues">) {
  const issues = new Map(entry.issues.map((issue) => [issue.characterId, issue]));
  return [...entry.roles]
    .sort((a, b) => Number(issues.has(b.characterId)) - Number(issues.has(a.characterId)))
    .map((role) => {
      const issue = issues.get(role.characterId);
      if (!issue) return role.short;
      if (issue.status === "alternate" && issue.substitute)
        return `${role.short}: ${firstName(issue.substitute.name)}`;
      const who = issue.absent.map((person) => firstName(person.name)).join(", ");
      return `${role.short} ${issue.status === "limited" ? "eingeschränkt" : "fehlt"}${who ? ` (${who})` : ""}`;
    })
    .join(" · ");
}

/** Nur planbare Szenen (alle Rollen besetzt). */
export function plannableScenes<T extends Pick<SceneReadiness, "fullyCast">>(
  entries: readonly T[],
) {
  return entries.filter((entry) => entry.fullyCast);
}

/** Rollen je Person aus der Besetzung (Haupt- und Zweitbesetzung, ohne Cameo). */
export function rolesByPerson(context: Pick<AudienceContext, "castings" | "characters">) {
  const byId = new Map(context.characters.map((entry) => [entry.id, entry]));
  const result = new Map<string, string[]>();
  for (const casting of context.castings) {
    if (casting.type === "cameo") continue;
    const character = byId.get(casting.characterId);
    if (!character) continue;
    const base = character.shortName?.trim() || character.name;
    const label = casting.type === "primary" ? base : `${base} (2.)`;
    const list = result.get(casting.userId) ?? [];
    if (!list.includes(label)) list.push(label);
    result.set(casting.userId, list);
  }
  return result;
}

/** Szenenanzahl je Zustand. */
export function countReadiness(entries: readonly SceneReadiness[]) {
  const counts: Record<SceneReadinessStatus, number> = {
    ready: 0,
    alternate: 0,
    limited: 0,
    missing: 0,
  };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}
