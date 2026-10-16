import type { AudienceContext } from "@/lib/calendar/audience";
import { rolesByPerson } from "@/lib/calendar/scene-readiness";

export type MemberGroup<T> = {
  key: string;
  label: string;
  entries: (T & { roles: string[]; extra: string[] })[];
};

type GroupContext = Pick<AudienceContext, "castings" | "characters"> & {
  departments?: AudienceContext["departments"];
};

/**
 * Personen nach Zugehörigkeit gruppieren: zuerst die Besetzung (mit Rollen), dann je Gewerk,
 * zuletzt alle anderen. Wer in mehreren steht, landet in der ersten Gruppe; weitere Gewerke
 * kommen als `extra` mit. Reihenfolge innerhalb einer Gruppe bleibt wie übergeben.
 */
export function groupMembers<T extends { userId: string }>(
  entries: readonly T[],
  context: GroupContext,
): MemberGroup<T>[] {
  const roles = rolesByPerson(context);
  const departments = context.departments ?? [];
  const departmentsOf = (userId: string) =>
    departments.filter((department) => department.memberIds.includes(userId));

  const cast: MemberGroup<T> = { key: "cast", label: "Besetzung", entries: [] };
  const byDepartment = new Map<string, MemberGroup<T>>(
    departments.map((department) => [
      department.id,
      { key: `d-${department.id}`, label: department.name, entries: [] },
    ]),
  );
  const other: MemberGroup<T> = { key: "other", label: "Weitere", entries: [] };

  for (const entry of entries) {
    const personRoles = roles.get(entry.userId) ?? [];
    const own = departmentsOf(entry.userId);
    if (personRoles.length) {
      cast.entries.push({ ...entry, roles: personRoles, extra: own.map((d) => d.name) });
    } else if (own.length) {
      byDepartment.get(own[0]!.id)!.entries.push({
        ...entry,
        roles: [],
        extra: own.slice(1).map((d) => d.name),
      });
    } else {
      other.entries.push({ ...entry, roles: [], extra: [] });
    }
  }
  return [cast, ...byDepartment.values(), other].filter((group) => group.entries.length);
}
