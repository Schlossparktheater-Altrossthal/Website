import type { Role } from "@prisma/client";

export type OnboardingVariant = "default" | "regie";

const VARIANT_BASE_PATH: Record<OnboardingVariant, string> = {
  default: "/onboarding",
  regie: "/onboarding/regie",
};

function ensureArray<T>(value: readonly T[] | null | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

export function resolveOnboardingVariant(roles: readonly Role[] | null | undefined): OnboardingVariant {
  const roleSet = new Set(ensureArray(roles));
  if (roleSet.has("board") && !roleSet.has("cast")) {
    return "regie";
  }
  return "default";
}

export function onboardingBasePath(roles: readonly Role[] | null | undefined): string {
  const variant = resolveOnboardingVariant(roles);
  return VARIANT_BASE_PATH[variant];
}

function buildVariantPath(base: string, segment: string | null | undefined) {
  if (!segment) {
    return base;
  }
  const trimmed = segment.trim();
  if (!trimmed) {
    return base;
  }
  return `${base}/${encodeURIComponent(trimmed)}`;
}

export function onboardingPathForToken(token: string, roles: readonly Role[] | null | undefined) {
  return buildVariantPath(onboardingBasePath(roles), token);
}

export function onboardingPathForHash(tokenHash: string, roles: readonly Role[] | null | undefined) {
  return buildVariantPath(onboardingBasePath(roles), tokenHash);
}

export function onboardingShortPathForInvite(inviteId: string, roles: readonly Role[] | null | undefined) {
  const base = onboardingBasePath(roles);
  if (!inviteId) {
    return base;
  }
  return `${base}/i/${encodeURIComponent(inviteId.trim())}`;
}
