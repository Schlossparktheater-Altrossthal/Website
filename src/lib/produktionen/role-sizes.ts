import { listRolePreferenceDefinitions } from "@/lib/onboarding/role-preferences";

/** Rollengrößen aus den Onboarding-Wünschen (Statist bis Große Rolle), klein nach groß. */
export const ROLE_SIZE_OPTIONS = listRolePreferenceDefinitions("acting").map((definition) => ({
  code: definition.code,
  title: definition.title,
}));

export function getRoleSizeCodes() {
  return ROLE_SIZE_OPTIONS.map((option) => option.code);
}

export function getRoleSizeTitle(code: string | null) {
  return ROLE_SIZE_OPTIONS.find((option) => option.code === code)?.title ?? null;
}
