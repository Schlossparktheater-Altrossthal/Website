import { hasPermission } from "@/lib/permissions";

export type FrontendEditingFeatureKey = "mystery.timer";

export type FrontendEditingFeature = {
  key: FrontendEditingFeatureKey;
  label: string;
  description?: string;
};

type FeatureDefinition = FrontendEditingFeature & {
  permissionKey?: string;
};

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "mystery.timer",
    label: "Mystery-Timer",
    description: "Countdown und Hinweistext für die Mystery-Startseite verwalten.",
    permissionKey: "mitglieder.mystery.timer",
  },
];

type UserLike = Parameters<typeof hasPermission>[0];

export async function resolveFrontendEditingFeatures(user: UserLike) {
  if (!user?.id) {
    return [] as FrontendEditingFeature[];
  }

  const entries = await Promise.all(
    FEATURE_DEFINITIONS.map(async (definition) => {
      if (!definition.permissionKey) {
        return definition;
      }
      const allowed = await hasPermission(user, definition.permissionKey);
      return allowed ? definition : null;
    }),
  );

  return entries
    .filter((entry): entry is FeatureDefinition => Boolean(entry))
    .map<FrontendEditingFeature>((entry) => ({
      key: entry.key,
      label: entry.label,
      description: entry.description,
    }));
}

export function isFrontendEditingFeatureKey(value: string | null | undefined): value is FrontendEditingFeatureKey {
  if (!value) return false;
  return FEATURE_DEFINITIONS.some((definition) => definition.key === value);
}
