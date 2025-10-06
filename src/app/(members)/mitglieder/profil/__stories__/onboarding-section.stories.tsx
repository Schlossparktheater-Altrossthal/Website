import type { OnboardingSectionProps } from "../profile-client";
import { OnboardingSection } from "../profile-client";

const title = "Members/Profile/OnboardingSection";

const defaultPreferences: OnboardingSectionProps["rolePreferences"] = [
  { code: "acting_lead", domain: "acting", weight: 80 },
  { code: "crew_stage", domain: "crew", weight: 60 },
];

const createOnboarding = (
  overrides: Partial<NonNullable<OnboardingSectionProps["onboarding"]>> = {},
): NonNullable<OnboardingSectionProps["onboarding"]> => ({
  focus: "acting",
  background: "Musikschule",
  backgroundClass: null,
  notes: "Interessiert an Technik",
  memberSinceYear: 2022,
  dietaryPreference: "Vegetarisch",
  dietaryPreferenceStrictness: "Flexibel",
  whatsappLinkVisitedAt: null,
  updatedAt: new Date().toISOString(),
  preferences: defaultPreferences,
  show: {
    id: "show-1",
    title: "Sommerproduktion",
    year: 2025,
    periodLabel: "Juni 2025",
    status: "active",
  },
  whatsappLink: "https://example.com/whatsapp",
  ...overrides,
});

const baseProps: OnboardingSectionProps = {
  onboarding: createOnboarding(),
  onOnboardingChange: () => undefined,
  rolePreferences: defaultPreferences,
  availableOnboardings: [
    { id: "show-1", title: "Sommerproduktion", periodLabel: "Juni 2025", status: "active" },
    { id: "show-2", title: "Winterrevue", periodLabel: "Dezember 2025", status: "draft" },
  ],
  whatsappVisitedAt: null,
  onWhatsAppVisit: async () => ({ visitedAt: new Date().toISOString(), alreadyVisited: false }),
  dietaryPreference: { label: "Vegetarisch", strictnessLabel: "Flexibel" },
  onFocusChange: () => undefined,
};

const meta = { title };

export default meta;

export const WhatsAppCalloutPending = () => (
  <div className="max-w-xl space-y-4 p-6">
    <OnboardingSection {...baseProps} />
  </div>
);

export const WhatsAppCalloutConfirmed = () => {
  const visitedAt = "2025-01-02T00:00:00.000Z";
  return (
    <div className="max-w-xl space-y-4 p-6">
      <OnboardingSection
        {...baseProps}
        onboarding={createOnboarding({ whatsappLinkVisitedAt: visitedAt })}
        whatsappVisitedAt={visitedAt}
        onWhatsAppVisit={async () => ({ visitedAt, alreadyVisited: true })}
      />
    </div>
  );
};
