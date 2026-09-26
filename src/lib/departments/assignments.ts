import type {
  CharacterCastingType,
  DepartmentAssignmentSource,
  DepartmentMembershipRole,
} from "@prisma/client";

import { getRolePreferenceTitle } from "@/lib/onboarding/role-preferences";
import { getUserDisplayName, getNameInitials } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";

export type AssignmentDepartment = {
  id: string;
  name: string;
  color: string | null;
  requiresJoinApproval: boolean;
  /** Onboarding-Wunsch-Codes, die zu diesem Gewerk führen. */
  preferenceCodes: string[];
};

export type AssignmentMembership = {
  id: string;
  departmentId: string;
  role: DepartmentMembershipRole;
  status: "requested" | "active";
  source: DepartmentAssignmentSource;
};

export type AssignmentWish = {
  code: string;
  title: string;
  weight: number;
  domain: "acting" | "crew";
};

export type AssignmentPerson = {
  id: string;
  name: string;
  initials: string;
  wishes: AssignmentWish[];
  memberships: AssignmentMembership[];
  castings: { characterId: string; type: CharacterCastingType }[];
  notes: string | null;
};

export type AssignmentCharacter = {
  id: string;
  name: string;
  color: string | null;
  /** Wunsch-Code der Rollengröße (`acting_lead` …). */
  sizeCode: string | null;
  sizeLabel: string | null;
};

export type AssignmentData = {
  showId: string;
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  characters: AssignmentCharacter[];
};

/**
 * Alles, was die Zuweisungsseite braucht: Personen der Produktion mit ihren Wünschen
 * (Onboarding), Gewerk-Zugehörigkeiten und Besetzungen.
 */
export async function loadAssignmentData(showId: string): Promise<AssignmentData> {
  const [departments, memberships, preferences, characters, onboardings] = await Promise.all([
    prisma.department.findMany({
      where: { showId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        requiresJoinApproval: true,
        template: { select: { preferenceCodes: true } },
      },
    }),
    prisma.productionMembership.findMany({
      where: { showId, ...currentMembershipWhere() },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            deactivatedAt: true,
          },
        },
      },
    }),
    prisma.memberRolePreference.findMany({
      where: { showId, weight: { gt: 0 } },
      select: { userId: true, code: true, domain: true, weight: true },
    }),
    prisma.character.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        rolePreferenceCode: true,
        castings: { select: { userId: true, type: true } },
      },
    }),
    prisma.productionOnboarding.findMany({
      where: { showId },
      select: { userId: true, notes: true },
    }),
  ]);

  const departmentIds = departments.map((department) => department.id);
  const departmentMemberships = await prisma.departmentMembership.findMany({
    where: { departmentId: { in: departmentIds }, status: { in: ["requested", "active"] } },
    select: {
      id: true,
      departmentId: true,
      userId: true,
      role: true,
      status: true,
      source: true,
      user: {
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      },
    },
  });

  const people = new Map<string, AssignmentPerson>();
  const ensurePerson = (user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  }) => {
    let person = people.get(user.id);
    if (!person) {
      person = {
        id: user.id,
        name: getUserDisplayName(user),
        initials: getNameInitials(user),
        wishes: [],
        memberships: [],
        castings: [],
        notes: null,
      };
      people.set(user.id, person);
    }
    return person;
  };

  for (const entry of memberships) {
    if (entry.user.deactivatedAt) continue;
    ensurePerson(entry.user);
  }
  // Wer bereits einem Gewerk angehört, erscheint auch ohne Produktions-Mitgliedschaft.
  for (const entry of departmentMemberships) {
    ensurePerson(entry.user);
  }

  for (const preference of preferences) {
    const person = people.get(preference.userId);
    if (!person) continue;
    person.wishes.push({
      code: preference.code,
      title: getRolePreferenceTitle(preference.code),
      weight: preference.weight,
      domain: preference.domain,
    });
  }
  for (const person of people.values()) {
    person.wishes.sort((a, b) => b.weight - a.weight);
  }

  for (const entry of departmentMemberships) {
    people.get(entry.userId)?.memberships.push({
      id: entry.id,
      departmentId: entry.departmentId,
      role: entry.role,
      status: entry.status === "requested" ? "requested" : "active",
      source: entry.source,
    });
  }

  for (const character of characters) {
    for (const casting of character.castings) {
      people.get(casting.userId)?.castings.push({
        characterId: character.id,
        type: casting.type,
      });
    }
  }

  for (const onboarding of onboardings) {
    const person = people.get(onboarding.userId);
    if (person) person.notes = onboarding.notes?.trim() || null;
  }

  return {
    showId,
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      color: department.color,
      requiresJoinApproval: department.requiresJoinApproval,
      preferenceCodes: department.template?.preferenceCodes ?? [],
    })),
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "de")),
    characters: characters.map((character) => ({
      id: character.id,
      name: character.name,
      color: character.color,
      sizeCode: character.rolePreferenceCode,
      sizeLabel: character.rolePreferenceCode
        ? getRolePreferenceTitle(character.rolePreferenceCode)
        : null,
    })),
  };
}
