import type { OnboardingSectionProps } from "../profile-client";
import { OnboardingSection } from "../profile-client";

const title = "Members/Profile/OnboardingSection";

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
  show: { title: "Sommerproduktion", year: 2025 },
  ...overrides,
});

const baseProps: OnboardingSectionProps = {
  onboarding: createOnboarding(),
  onOnboardingChange: () => undefined,
  whatsappLink: "https://example.com/whatsapp",
  whatsappVisitedAt: null,
  onWhatsAppVisit: async () => ({ visitedAt: new Date().toISOString(), alreadyVisited: false }),
  dietaryPreference: { label: "Vegetarisch", strictnessLabel: "Flexibel" },
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
