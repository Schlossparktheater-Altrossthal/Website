import { z } from "zod";

export const DATA_PORTAL_PERMISSIONS = {
  view: "PRIVATE.DATA.PORTAL.VIEW",
  export: "PRIVATE.DATA.PORTAL.EXPORT",
  education: "PRIVATE.DATA.PORTAL.EDUCATION",
  health: "PRIVATE.DATA.PORTAL.HEALTH",
} as const;

export type FieldGroup = "base" | "education" | "health";

export const FIELD_GROUP_PERMISSION: Record<FieldGroup, string> = {
  base: DATA_PORTAL_PERMISSIONS.view,
  education: DATA_PORTAL_PERMISSIONS.education,
  health: DATA_PORTAL_PERMISSIONS.health,
};

export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  base: "Allgemein",
  education: "Schule & Alter",
  health: "Gesundheit",
};

export type FieldType = "text" | "number" | "date" | "boolean";

export type FieldValue = string | number | boolean | Date | null;

export type FieldDefinition = {
  key: string;
  label: string;
  group: FieldGroup;
  type: FieldType;
};

export const DATA_SOURCES = ["participants", "allergies"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  participants: "Teilnehmende einer Produktion",
  allergies: "Allergien & Unverträglichkeiten (eine Zeile je Eintrag)",
};

/** Feldkatalog je Datenquelle. Nur hier gelistete Felder sind abfragbar. */
export const SOURCE_FIELDS: Record<DataSource, readonly FieldDefinition[]> = {
  participants: [
    { key: "name", label: "Name", group: "base", type: "text" },
    { key: "email", label: "E-Mail", group: "base", type: "text" },
    { key: "roles", label: "Rollen in der Produktion", group: "base", type: "text" },
    { key: "function", label: "Funktion", group: "base", type: "text" },
    { key: "status", label: "Status", group: "base", type: "text" },
    { key: "joinedAt", label: "Beigetreten am", group: "base", type: "date" },
    { key: "photoConsent", label: "Fotoerlaubnis", group: "base", type: "text" },
    { key: "age", label: "Alter", group: "education", type: "number" },
    { key: "dateOfBirth", label: "Geburtsdatum", group: "education", type: "date" },
    { key: "gender", label: "Geschlecht", group: "education", type: "text" },
    { key: "educationCategory", label: "Bildungsstand", group: "education", type: "text" },
    { key: "school", label: "Schule", group: "education", type: "text" },
    { key: "schoolClass", label: "Klasse", group: "education", type: "text" },
    { key: "hasAllergy", label: "Hat Allergie", group: "health", type: "boolean" },
    { key: "allergies", label: "Allergien", group: "health", type: "text" },
    { key: "dietaryPreference", label: "Ernährungsweise", group: "health", type: "text" },
  ],
  allergies: [
    { key: "name", label: "Name", group: "health", type: "text" },
    { key: "roles", label: "Rollen in der Produktion", group: "health", type: "text" },
    { key: "allergen", label: "Allergen", group: "health", type: "text" },
    { key: "level", label: "Schweregrad", group: "health", type: "text" },
    { key: "symptoms", label: "Symptome", group: "health", type: "text" },
    { key: "treatment", label: "Notfallbehandlung", group: "health", type: "text" },
    { key: "note", label: "Notiz", group: "health", type: "text" },
  ],
};

export const FILTER_OPERATORS = [
  "contains",
  "equals",
  "notEquals",
  "isEmpty",
  "notEmpty",
  "gt",
  "lt",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "enthält",
  equals: "ist gleich",
  notEquals: "ist nicht",
  isEmpty: "ist leer",
  notEmpty: "ist nicht leer",
  gt: "größer / später als",
  lt: "kleiner / früher als",
};

export const OPERATORS_BY_TYPE: Record<FieldType, readonly FilterOperator[]> = {
  text: ["contains", "equals", "notEquals", "isEmpty", "notEmpty"],
  number: ["equals", "notEquals", "gt", "lt", "isEmpty", "notEmpty"],
  date: ["equals", "gt", "lt", "isEmpty", "notEmpty"],
  boolean: ["equals"],
};

export const dataPortalQuerySchema = z.object({
  source: z.enum(DATA_SOURCES),
  showId: z.string().min(1),
  filters: z
    .array(
      z.object({
        field: z.string().min(1),
        op: z.enum(FILTER_OPERATORS),
        value: z.string().max(200).optional(),
      }),
    )
    .max(12)
    .default([]),
  columns: z.array(z.string().min(1)).min(1).max(30),
  sort: z.object({ field: z.string().min(1), dir: z.enum(["asc", "desc"]) }).optional(),
  includeInactive: z.boolean().default(false),
});
export type DataPortalQuery = z.infer<typeof dataPortalQuerySchema>;

/** Felder, die für die gegebenen Rechte sichtbar sind. */
export function allowedFields(
  source: DataSource,
  grants: Readonly<Record<FieldGroup, boolean>>,
): FieldDefinition[] {
  return SOURCE_FIELDS[source].filter((field) => grants[field.group]);
}
