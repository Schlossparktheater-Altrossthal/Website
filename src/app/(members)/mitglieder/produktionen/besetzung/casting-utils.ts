import { CharacterCastingType } from "@prisma/client";

import { getUserDisplayName } from "@/lib/names";
import {
  getRolePreferenceTitle,
  listRolePreferenceDefinitions,
} from "@/lib/onboarding/role-preferences";

export type DisplayUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string | null;
  email: string | null;
};

export type CharacterCasting = {
  id: string;
  type: CharacterCastingType;
  notes: string | null;
  user: DisplayUser | null;
};

export type Character = {
  id: string;
  name: string;
  shortName: string | null;
  rolePreferenceCode: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  order: number | null;
  castings: CharacterCasting[];
};

export type ExportCharacter = {
  id: string;
  name: string;
  shortName: string | null;
  rolePreferenceCode: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  castings: Array<{
    id: string;
    type: CharacterCastingType;
    notes: string | null;
    userName: string;
  }>;
};

export const CASTING_LABELS: Partial<Record<CharacterCastingType, string>> = {
  primary: "Primär",
  alternate: "Sekundär",
};

export const CASTING_ORDER: CharacterCastingType[] = [
  CharacterCastingType.primary,
  CharacterCastingType.alternate,
];

export const ROLE_PREFERENCE_OPTIONS = listRolePreferenceDefinitions("acting");

export const DESCRIPTION_PREVIEW_LENGTH = 100;

export const selectSmallClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function formatUserName(user?: DisplayUser | null) {
  if (!user) return "Unbekannt";
  return getUserDisplayName(user, "Unbekannt");
}

export function getCastingLabel(type: CharacterCastingType) {
  return CASTING_LABELS[type] ?? "Weitere";
}

export function getCastingOrderIndex(type: CharacterCastingType) {
  const index = CASTING_ORDER.indexOf(type);
  return index === -1 ? CASTING_ORDER.length : index;
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function resolveRoleSizeLabel(rolePreferenceCode: string | null) {
  return rolePreferenceCode ? getRolePreferenceTitle(rolePreferenceCode) : "Keine Rollengröße";
}
