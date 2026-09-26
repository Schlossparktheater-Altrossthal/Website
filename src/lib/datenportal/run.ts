import type { AllergyLevel } from "@prisma/client";

import { ROLE_LABELS, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  type DataPortalQuery,
  type DataSource,
  type FieldDefinition,
  type FieldValue,
} from "./fields";

export type PortalRow = Record<string, FieldValue>;

const ALLERGY_LEVEL_LABELS: Record<AllergyLevel, string> = {
  MILD: "leicht",
  MODERATE: "mittel",
  SEVERE: "schwer",
  LETHAL: "lebensbedrohlich",
};

const EDUCATION_CATEGORY_LABELS: Record<string, string> = {
  school: "Schule",
  work: "Beruf",
  university: "Studium",
  other: "Sonstiges",
};

const MEMBERSHIP_STATUS_LABELS = {
  invited: "eingeladen",
  onboarding: "im Onboarding",
  active: "aktiv",
  left: "ausgetreten",
} as const;

const CONSENT_LABELS = {
  pending: "in Prüfung",
  approved: "erteilt",
  rejected: "abgelehnt",
} as const;

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    user.email ||
    "Unbekannt"
  );
}

export function ageOn(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const birthdayPassed =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() >= dateOfBirth.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

/** Lädt die Rohzeilen einer Quelle für genau eine Produktion. Deaktivierte/anonymisierte Personen entfallen. */
export async function loadSourceRows(
  source: DataSource,
  showId: string,
  options: { includeInactive: boolean; now?: Date },
): Promise<PortalRow[]> {
  const now = options.now ?? new Date();
  const memberships = await prisma.productionMembership.findMany({
    where: {
      showId,
      ...(options.includeInactive ? {} : { status: { not: "left" } }),
      user: { anonymizedAt: null, ...(options.includeInactive ? {} : { deactivatedAt: null }) },
    },
    select: {
      status: true,
      joinedAt: true,
      roles: true,
      function: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          dateOfBirth: true,
          onboardingProfile: {
            select: {
              gender: true,
              educationCategory: true,
              educationSchoolName: true,
              educationClassName: true,
              dietaryPreference: true,
            },
          },
          dietaryRestrictions: {
            where: { isActive: true },
            orderBy: { allergen: "asc" },
            select: {
              allergen: true,
              level: true,
              symptoms: true,
              treatment: true,
              note: true,
            },
          },
          photoConsents: { where: { showId }, select: { status: true, revokedAt: true } },
        },
      },
    },
  });

  const rows: PortalRow[] = [];
  for (const membership of memberships) {
    const { user } = membership;
    const roles = membership.roles.map((role: Role) => ROLE_LABELS[role] ?? role).join(", ");
    const name = displayName(user);
    if (source === "allergies") {
      for (const item of user.dietaryRestrictions) {
        rows.push({
          name,
          roles,
          allergen: item.allergen,
          level: ALLERGY_LEVEL_LABELS[item.level],
          symptoms: item.symptoms,
          treatment: item.treatment,
          note: item.note,
        });
      }
      continue;
    }
    const profile = user.onboardingProfile;
    const consent = user.photoConsents[0];
    rows.push({
      name,
      email: user.email,
      roles,
      function: membership.function,
      status: MEMBERSHIP_STATUS_LABELS[membership.status],
      joinedAt: membership.joinedAt,
      photoConsent: !consent
        ? "keine"
        : consent.revokedAt
          ? "widerrufen"
          : CONSENT_LABELS[consent.status],
      age: user.dateOfBirth ? ageOn(user.dateOfBirth, now) : null,
      dateOfBirth: user.dateOfBirth,
      gender: profile?.gender ?? null,
      educationCategory: profile?.educationCategory
        ? (EDUCATION_CATEGORY_LABELS[profile.educationCategory] ?? profile.educationCategory)
        : null,
      school: profile?.educationSchoolName ?? null,
      schoolClass: profile?.educationClassName ?? null,
      hasAllergy: user.dietaryRestrictions.length > 0,
      allergies: user.dietaryRestrictions
        .map((item) => `${item.allergen} (${ALLERGY_LEVEL_LABELS[item.level]})`)
        .join(", "),
      dietaryPreference: profile?.dietaryPreference ?? null,
    });
  }
  return rows;
}

function isEmptyValue(value: FieldValue): boolean {
  return value === null || value === "" || (typeof value === "number" && Number.isNaN(value));
}

function comparable(value: FieldValue, field: FieldDefinition): number | string | boolean | null {
  if (value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (field.type === "date" && typeof value === "string") return Date.parse(value);
  return value;
}

function matches(
  row: PortalRow,
  filter: DataPortalQuery["filters"][number],
  field: FieldDefinition,
): boolean {
  const value = row[field.key] ?? null;
  switch (filter.op) {
    case "isEmpty":
      return isEmptyValue(value);
    case "notEmpty":
      return !isEmptyValue(value);
    default:
      break;
  }
  const raw = filter.value?.trim() ?? "";
  if (field.type === "boolean") {
    return value === (raw === "true");
  }
  if (isEmptyValue(value)) return filter.op === "notEquals";
  if (field.type === "text") {
    const left = String(value).toLocaleLowerCase("de");
    const right = raw.toLocaleLowerCase("de");
    if (filter.op === "contains") return left.includes(right);
    if (filter.op === "equals") return left === right;
    if (filter.op === "notEquals") return left !== right;
    return false;
  }
  const left = comparable(value, field);
  const right = field.type === "date" ? Date.parse(raw) : Number(raw);
  if (typeof left !== "number" || Number.isNaN(right)) return false;
  if (filter.op === "equals") return left === right;
  if (filter.op === "notEquals") return left !== right;
  if (filter.op === "gt") return left > right;
  if (filter.op === "lt") return left < right;
  return false;
}

/** Filtert und sortiert. Felder außerhalb von `fields` (Rechte/Katalog) führen zu einem Fehler. */
export function applyQuery(
  rows: readonly PortalRow[],
  query: Pick<DataPortalQuery, "filters" | "sort">,
  fields: readonly FieldDefinition[],
): PortalRow[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const resolved = query.filters.map((filter) => {
    const field = byKey.get(filter.field);
    if (!field) throw new PortalFieldError(filter.field);
    return { filter, field };
  });
  let result = rows.filter((row) =>
    resolved.every(({ filter, field }) => matches(row, filter, field)),
  );
  if (query.sort) {
    const field = byKey.get(query.sort.field);
    if (!field) throw new PortalFieldError(query.sort.field);
    const direction = query.sort.dir === "desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const left = comparable(a[field.key] ?? null, field);
      const right = comparable(b[field.key] ?? null, field);
      if (left === right) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      if (typeof left === "string" && typeof right === "string") {
        return left.localeCompare(right, "de") * direction;
      }
      return (left < right ? -1 : 1) * direction;
    });
  }
  return result;
}

export class PortalFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Feld nicht verfügbar: ${field}`);
  }
}

/** Reduziert Zeilen auf die gewählten (erlaubten) Spalten. */
export function projectRows(
  rows: readonly PortalRow[],
  columns: readonly string[],
  fields: readonly FieldDefinition[],
): { columns: FieldDefinition[]; rows: PortalRow[] } {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const selected = columns.map((key) => {
    const field = byKey.get(key);
    if (!field) throw new PortalFieldError(key);
    return field;
  });
  return {
    columns: selected,
    rows: rows.map((row) => Object.fromEntries(selected.map((f) => [f.key, row[f.key] ?? null]))),
  };
}

export const GROUP_COUNT_FIELD: FieldDefinition = {
  key: "count",
  label: "Anzahl",
  group: "base",
  type: "number",
};

const EMPTY_GROUP_LABEL = "(leer)";

/** Zählt Zeilen je Wert eines Feldes, absteigend nach Anzahl. */
export function groupRows(
  rows: readonly PortalRow[],
  groupField: FieldDefinition,
): { columns: FieldDefinition[]; rows: PortalRow[] } {
  if (groupField.type === "date") throw new PortalFieldError(groupField.key);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[groupField.key] ?? null;
    const label = isEmptyValue(value)
      ? EMPTY_GROUP_LABEL
      : typeof value === "boolean"
        ? value
          ? "ja"
          : "nein"
        : String(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const grouped = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .map(([label, count]): PortalRow => ({ group: label, count }));
  return {
    columns: [{ ...groupField, key: "group", type: "text" }, GROUP_COUNT_FIELD],
    rows: grouped,
  };
}
