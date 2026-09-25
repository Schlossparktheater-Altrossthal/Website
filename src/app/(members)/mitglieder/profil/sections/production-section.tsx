"use client";

import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";

import type { ProfileClientProps } from "../profile-shared";
import { OnboardingSection } from "./onboarding-section";
import { RolePreferencesSection } from "./role-preferences-section";

type ProductionSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
  rolePreferences: ProfileClientProps["rolePreferences"];
  onRolePreferencesChange: (next: ProfileClientProps["rolePreferences"]) => void;
  onWhatsAppVisit: () => Promise<{ visitedAt: string | null; alreadyVisited: boolean }>;
  availableOnboardings: OnboardingSummary[];
};

/** „Meine Produktion“: Produktion und Team-Chat, Rollenwünsche, Angaben zur Person. */
export function ProductionSection({
  onboarding,
  onOnboardingChange,
  rolePreferences,
  onRolePreferencesChange,
  onWhatsAppVisit,
  availableOnboardings,
}: ProductionSectionProps) {
  return (
    <div className="space-y-4">
      <OnboardingSection
        onboarding={onboarding}
        onOnboardingChange={onOnboardingChange}
        rolePreferences={rolePreferences}
        availableOnboardings={availableOnboardings}
        whatsappVisitedAt={onboarding?.whatsappLinkVisitedAt ?? null}
        onWhatsAppVisit={onWhatsAppVisit}
      >
        <RolePreferencesSection
          onboarding={onboarding}
          rolePreferences={rolePreferences}
          onRolePreferencesChange={onRolePreferencesChange}
          onOnboardingChange={onOnboardingChange}
        />
      </OnboardingSection>
    </div>
  );
}
