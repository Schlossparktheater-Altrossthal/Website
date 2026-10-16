"use client";

import type { ProfileClientProps } from "../profile-shared";
import { OnboardingSection } from "./onboarding-section";
import { RolePreferencesSection } from "./role-preferences-section";

type ProductionSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
  rolePreferences: ProfileClientProps["rolePreferences"];
  crewWishOptions: ProfileClientProps["crewWishOptions"];
  onRolePreferencesChange: (next: ProfileClientProps["rolePreferences"]) => void;
  onWhatsAppVisit: () => Promise<{ visitedAt: string | null; alreadyVisited: boolean }>;
  preferencesInheritedFrom: string | null;
  preferencesEnteredBy: { code: string; by: string }[];
};

/** „Meine Produktion“: Produktion und Team-Chat, Rollenwünsche, Angaben zur Person. */
export function ProductionSection({
  onboarding,
  onOnboardingChange,
  rolePreferences,
  crewWishOptions,
  onRolePreferencesChange,
  onWhatsAppVisit,
  preferencesInheritedFrom,
  preferencesEnteredBy,
}: ProductionSectionProps) {
  return (
    <div className="space-y-4">
      <OnboardingSection
        onboarding={onboarding}
        onOnboardingChange={onOnboardingChange}
        rolePreferences={rolePreferences}
        whatsappVisitedAt={onboarding?.whatsappLinkVisitedAt ?? null}
        onWhatsAppVisit={onWhatsAppVisit}
      >
        <RolePreferencesSection
          onboarding={onboarding}
          rolePreferences={rolePreferences}
          crewWishOptions={crewWishOptions}
          onRolePreferencesChange={onRolePreferencesChange}
          onOnboardingChange={onOnboardingChange}
          inheritedFromLabel={preferencesInheritedFrom}
          enteredBy={preferencesEnteredBy}
        />
      </OnboardingSection>
    </div>
  );
}
