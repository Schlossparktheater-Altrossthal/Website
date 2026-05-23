import { hasPermission } from "@/lib/permissions";

export type FrontendEditingFeatureKey = "mystery.launch-countdown" | "website.premiere-countdown" | "website.production-flyer" | "chronik.performance-dates";

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
    key: "mystery.launch-countdown",
    label: "Mystery-Timer",
    description: "Countdown und Hinweistext für die Mystery-Startseite verwalten.",
    permissionKey: "PRIVATE.MYSTERY.TIMER.EDIT",
  },
  {
    key: "website.premiere-countdown",
    label: "Premieren-Countdown",
    description: "Countdown für die öffentliche Startseite anpassen.",
    permissionKey: "PRIVATE.WEBSITE.COUNTDOWN.EDIT",
  },
  {
    key: "website.production-flyer",
    label: "Homepage-Flyer",
    description: "Flyer-Sektion für die öffentliche Startseite anpassen.",
    permissionKey: "PRIVATE.WEBSITE.COUNTDOWN.EDIT",
  },
  {
    key: "chronik.performance-dates",
    label: "Chronik-Termine",
    description: "Aufführungstermine in der öffentlichen Chronik bearbeiten.",
    permissionKey: "PRIVATE.WEBSITE.CHRONIK.EDIT",
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
