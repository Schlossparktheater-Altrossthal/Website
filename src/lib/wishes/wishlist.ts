import type { OnboardingFocus, RolePreferenceDomain } from "@prisma/client";

import { AVATAR_USER_SELECT, toAvatarFields, type AvatarFields } from "@/lib/avatar-fields";
import { listCrewWishOptions } from "@/lib/onboarding/crew-options";
import { listRolePreferenceDefinitions } from "@/lib/onboarding/role-preferences";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";

import { isTopWish, topWishFlags, wishLevelOf, type WishLevel } from "./levels";
import { canEditWishArea } from "./permissions";

export { canEditWishArea };

/** Ein wählbarer Bereich: eine Rollengröße oder ein Gewerks-Wunsch der Produktion. */
export type WishlistArea = {
  /** Wunsch-Code, unter dem nachgetragen wird (`acting_lead`, `tpl:…`, `crew_direction`). */
  code: string;
  domain: RolePreferenceDomain;
  title: string;
  /** Kurzer Titel für die Matrix. */
  shortTitle: string;
  color: string | null;
  /** Gespeicherte Codes, die als dieser Bereich gelten (Alt-Codes der Blaupause). */
  matchCodes: string[];
  /** Gewerke der Produktion, die diesen Wunsch abdecken (leer: kein Gewerk vorhanden). */
  departmentIds: string[];
};

export type WishlistWish = {
  areaCode: string;
  weight: number;
  level: WishLevel;
  /** Name der Person, die den Wunsch nachgetragen hat; `null` = selbst angegeben. */
  enteredBy: string | null;
  /** Gewerk aktiv bzw. Rolle dieser Größe besetzt. */
  assigned: boolean;
  /** Höchster Wunsch der Person (bei Gleichstand mehrere). */
  top: boolean;
};

export type WishlistPerson = AvatarFields & {
  id: string;
  name: string;
  focus: OnboardingFocus | null;
  isReturning: boolean;
  onboardingDone: boolean;
  interests: string[];
  /** Erstes Jahr im Verein (Onboarding-Profil). */
  memberSince: number | null;
  /** Hinweis der Person aus dem Onboarding. */
  onboardingNote: string | null;
  /** Interne Notiz der Verantwortlichen. */
  note: { text: string; by: string | null; at: string } | null;
  wishes: WishlistWish[];
  /** Aktive Gewerke dieser Produktion (Namen). */
  departments: string[];
  /** Besetzte Rollen (Namen). */
  roles: string[];
};

export type WishlistData = {
  showId: string;
  showTitle: string | null;
  areas: WishlistArea[];
  people: WishlistPerson[];
  fulfillment: WishFulfillment;
};

export type WishFulfillment = {
  /** Personen mit Wünschen und mindestens einer Zuteilung. */
  assigned: number;
  /** Davon mit mindestens einem erfüllten Top-Wunsch. */
  fulfilled: number;
  /** Zugeteilte ohne erfüllten Top-Wunsch (IDs). */
  missedIds: string[];
};

const SHORT_TITLES: Record<string, string> = {
  acting_lead: "Groß",
  acting_medium: "Mittel",
  acting_scout: "Schnupper",
  acting_statist: "Statist",
};

/** Reihenfolge der Rollengrößen: groß zuerst. */
const ACTING_ORDER = ["acting_lead", "acting_medium", "acting_scout", "acting_statist"];

export function shortAreaTitle(title: string) {
  const first = title.split(/\s*[&,/]\s*|\s+und\s+/)[0] ?? title;
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
}

type AreaDepartment = { id: string; template: { id: string } | null };

function buildAreas(
  crewOptions: Awaited<ReturnType<typeof listCrewWishOptions>>,
  departments: AreaDepartment[],
): WishlistArea[] {
  const actingDefinitions = listRolePreferenceDefinitions("acting").sort(
    (a, b) => ACTING_ORDER.indexOf(a.code) - ACTING_ORDER.indexOf(b.code),
  );
  return [
    ...actingDefinitions.map((definition) => ({
      code: definition.code,
      domain: "acting" as const,
      title: definition.title,
      shortTitle: SHORT_TITLES[definition.code] ?? shortAreaTitle(definition.title),
      color: null,
      matchCodes: [definition.code],
      departmentIds: [],
    })),
    ...crewOptions.map((option) => ({
      code: option.code,
      domain: "crew" as const,
      title: option.title,
      shortTitle: shortAreaTitle(option.title),
      color: option.color,
      matchCodes: option.matchCodes,
      departmentIds: departments
        .filter((department) => option.templateId && department.template?.id === option.templateId)
        .map((department) => department.id),
    })),
  ];
}

/** Nur die Bereiche einer Produktion (für Rechteprüfung beim Nachtragen). */
export async function loadWishlistAreas(showId: string): Promise<WishlistArea[]> {
  const [crewOptions, departments] = await Promise.all([
    listCrewWishOptions(showId),
    prisma.department.findMany({
      where: { showId, archivedAt: null },
      select: { id: true, template: { select: { id: true } } },
    }),
  ]);
  return buildAreas(crewOptions, departments);
}

export function markTopWishes(wishes: WishlistWish[]): WishlistWish[] {
  const flags = topWishFlags(wishes.map((wish) => wish.weight));
  return wishes.map((wish, index) => ({ ...wish, top: flags[index] }));
}

/** Wunscherfüllung: wer etwas zugeteilt bekam, hat dabei einen Top-Wunsch erhalten? */
export function computeFulfillment(people: WishlistPerson[]): WishFulfillment {
  let assigned = 0;
  let fulfilled = 0;
  const missedIds: string[] = [];
  for (const person of people) {
    if (!person.wishes.length) continue;
    if (!person.departments.length && !person.roles.length) continue;
    assigned += 1;
    const max = Math.max(...person.wishes.map((wish) => wish.weight));
    const hit = person.wishes.some((wish) => wish.assigned && isTopWish(wish.weight, max));
    if (hit) fulfilled += 1;
    else missedIds.push(person.id);
  }
  return { assigned, fulfilled, missedIds };
}

/**
 * Wünsche aller aktiven Mitglieder einer Produktion, je Bereich mit Stufe, Herkunft und
 * Ist-Stand (Gewerk/Rolle). Nur Wünsche dieser Produktion – keine Altwünsche.
 */
export async function loadWishlist(showId: string): Promise<WishlistData> {
  const [show, crewOptions, departments, memberships, preferences, characters, onboardings, notes] =
    await Promise.all([
      prisma.show.findUnique({ where: { id: showId }, select: { title: true, year: true } }),
      listCrewWishOptions(showId),
      prisma.department.findMany({
        where: { showId, archivedAt: null },
        select: {
          id: true,
          name: true,
          template: { select: { id: true } },
          memberships: {
            where: { status: "active", user: { deactivatedAt: null } },
            select: { userId: true },
          },
        },
      }),
      prisma.productionMembership.findMany({
        where: { showId, ...currentMembershipWhere(), user: { deactivatedAt: null } },
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              ...AVATAR_USER_SELECT,
              interests: { select: { interest: { select: { name: true } } } },
              onboardingProfile: { select: { memberSinceYear: true } },
            },
          },
        },
      }),
      prisma.memberRolePreference.findMany({
        where: { showId, weight: { gt: 0 } },
        select: {
          userId: true,
          code: true,
          weight: true,
          enteredBy: { select: { firstName: true, lastName: true, name: true } },
        },
      }),
      prisma.character.findMany({
        where: { showId },
        select: { name: true, rolePreferenceCode: true, castings: { select: { userId: true } } },
      }),
      prisma.productionOnboarding.findMany({
        where: { showId },
        select: { userId: true, focus: true, isReturning: true, completedAt: true, notes: true },
      }),
      prisma.memberWishNote.findMany({
        where: { showId },
        select: {
          userId: true,
          text: true,
          updatedAt: true,
          updatedBy: { select: { firstName: true, lastName: true, name: true } },
        },
      }),
    ]);

  const areas = buildAreas(crewOptions, departments);
  const areaByCode = new Map<string, WishlistArea>();
  for (const area of areas) {
    for (const code of area.matchCodes) if (!areaByCode.has(code)) areaByCode.set(code, area);
  }

  const activeDepartments = new Map<string, Set<string>>();
  for (const department of departments) {
    for (const membership of department.memberships) {
      const set = activeDepartments.get(membership.userId) ?? new Set<string>();
      set.add(department.id);
      activeDepartments.set(membership.userId, set);
    }
  }
  const castSizes = new Map<string, Set<string>>();
  const castRoles = new Map<string, string[]>();
  for (const character of characters) {
    for (const casting of character.castings) {
      if (character.rolePreferenceCode) {
        const set = castSizes.get(casting.userId) ?? new Set<string>();
        set.add(character.rolePreferenceCode);
        castSizes.set(casting.userId, set);
      }
      castRoles.set(casting.userId, [...(castRoles.get(casting.userId) ?? []), character.name]);
    }
  }
  const onboardingByUser = new Map(onboardings.map((entry) => [entry.userId, entry]));
  const noteByUser = new Map(notes.map((entry) => [entry.userId, entry]));
  const departmentName = new Map(departments.map((department) => [department.id, department.name]));

  const people: WishlistPerson[] = memberships.map(({ user }) => {
    const onboarding = onboardingByUser.get(user.id);
    const note = noteByUser.get(user.id);
    const userDepartments = activeDepartments.get(user.id) ?? new Set<string>();

    // Je Bereich zählt der höchste gespeicherte Wunsch (Alt-Codes einer Blaupause fallen zusammen).
    const byArea = new Map<string, WishlistWish>();
    for (const preference of preferences) {
      if (preference.userId !== user.id) continue;
      const area = areaByCode.get(preference.code);
      if (!area) continue;
      const current = byArea.get(area.code);
      if (current && current.weight >= preference.weight) continue;
      byArea.set(area.code, {
        areaCode: area.code,
        weight: preference.weight,
        level: wishLevelOf(preference.weight),
        enteredBy: preference.enteredBy ? getUserDisplayName(preference.enteredBy) : null,
        assigned:
          area.domain === "acting"
            ? Boolean(castSizes.get(user.id)?.has(area.code))
            : area.departmentIds.some((id) => userDepartments.has(id)),
        top: false,
      });
    }

    return {
      id: user.id,
      name: getUserDisplayName(user),
      ...toAvatarFields(user),
      focus: onboarding?.focus ?? null,
      isReturning: onboarding?.isReturning ?? false,
      onboardingDone: Boolean(onboarding?.completedAt),
      interests: user.interests
        .map((entry) => entry.interest.name)
        .sort((a, b) => a.localeCompare(b, "de")),
      memberSince: user.onboardingProfile?.memberSinceYear ?? null,
      onboardingNote: onboarding?.notes?.trim() || null,
      note: note
        ? {
            text: note.text,
            by: note.updatedBy ? getUserDisplayName(note.updatedBy) : null,
            at: note.updatedAt.toISOString(),
          }
        : null,
      wishes: markTopWishes([...byArea.values()]).sort((a, b) => b.weight - a.weight),
      departments: [...userDepartments]
        .map((id) => departmentName.get(id))
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, "de")),
      roles: castRoles.get(user.id) ?? [],
    };
  });
  people.sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    showId,
    showTitle: show ? (show.title ?? String(show.year)) : null,
    areas,
    people,
    fulfillment: computeFulfillment(people),
  };
}
