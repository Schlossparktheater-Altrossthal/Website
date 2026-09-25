"use client";

import { ChevronLeftIcon } from "@/components/ui/action-icons";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import { buildProfileChecklist } from "@/lib/profile-completion";
import { getUserDisplayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { PhotoConsentSummary } from "@/types/photo-consent";
import { ProfileHeader } from "./profile-header";
import { PROFILE_SECTIONS, resolveProfileSection, type ProfileSectionId } from "./profile-sections";
import { ProfileSectionNav, type ProfileSectionStatus } from "./profile-section-nav";
import { BasicsSection } from "./sections/basics-section";
import { PaymentSection } from "./sections/payment-section";
import { NutritionSection } from "./sections/nutrition-section";
import { InterestsSection } from "./sections/interests-section";
import { ProductionSection } from "./sections/production-section";
import {
  PAYOUT_METHOD_OPTIONS,
  ProfileClientProps,
  ProfileUser,
  Allergy,
  OnboardingProfile,
  isProfilePaymentComplete,
} from "./profile-shared";

const EMPTY_ONBOARDING: OnboardingProfile = {
  focus: "acting",
  background: null,
  backgroundClass: null,
  notes: null,
  memberSinceYear: null,
  dietaryPreference: null,
  dietaryPreferenceStrictness: null,
  whatsappLinkVisitedAt: null,
  updatedAt: null,
  preferences: [],
  show: null,
  whatsappLink: null,
};

export function ProfileClient({
  user: initialUser,
  rolePreferences: initialRolePreferences,
  onboarding: initialOnboarding,
  interests: initialInterests,
  allergies: initialAllergies,
  checklist: initialChecklist,
  availableOnboardings,
  history,
}: ProfileClientProps) {
  const { update: refreshSession } = useSession();
  const searchParams = useSearchParams();
  const selectedSection = resolveProfileSection(searchParams?.get("bereich"));
  // Desktop zeigt immer einen Bereich; mobil ohne Auswahl die Bereichsliste.
  const desktopSection: ProfileSectionId = selectedSection ?? "stammdaten";

  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [onboarding, setOnboarding] = useState<ProfileClientProps["onboarding"]>(initialOnboarding);
  const [rolePreferences, setRolePreferences] =
    useState<ProfileClientProps["rolePreferences"]>(initialRolePreferences);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [allergies, setAllergies] = useState<Allergy[]>(initialAllergies);
  const [photoConsentGiven, setPhotoConsentGiven] = useState<boolean | undefined>(
    () => initialChecklist.items.find((item) => item.id === "photo-consent")?.complete,
  );

  const summary = useMemo(
    () =>
      buildProfileChecklist({
        hasBasicData: Boolean(user.firstName?.trim() && user.email?.trim()),
        hasBirthdate: Boolean(user.dateOfBirth),
        hasPaymentDetails: isProfilePaymentComplete(user),
        hasDietaryPreference: Boolean(onboarding?.dietaryPreference?.trim()),
        photoConsent:
          photoConsentGiven === undefined ? undefined : { consentGiven: photoConsentGiven },
      }),
    [onboarding?.dietaryPreference, photoConsentGiven, user],
  );

  const displayName = useMemo(
    () =>
      getUserDisplayName(
        {
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.displayName,
          email: user.email,
        },
        user.displayName,
      ),
    [user.displayName, user.email, user.firstName, user.lastName],
  );

  const handleUserUpdated = useCallback(
    async (nextUser: ProfileUser) => {
      setUser(nextUser);
      try {
        await refreshSession?.({
          user: {
            id: nextUser.id,
            firstName: nextUser.firstName,
            lastName: nextUser.lastName,
            name: nextUser.displayName,
            email: nextUser.email,
            avatarSource: nextUser.avatarSource,
            avatarUpdatedAt: nextUser.avatarUpdatedAt,
          },
        });
      } catch (error) {
        console.error("[profile][session-update]", error);
      }
    },
    [refreshSession],
  );

  const handleDietaryUpdated = useCallback(
    (preference: { label: string | null; strictnessLabel: string | null }) => {
      setOnboarding((prev) => ({
        ...(prev ?? EMPTY_ONBOARDING),
        dietaryPreference: preference.label,
        dietaryPreferenceStrictness: preference.strictnessLabel,
      }));
    },
    [],
  );

  const handlePhotoConsentSummary = useCallback((nextSummary: PhotoConsentSummary | null) => {
    setPhotoConsentGiven(Boolean(nextSummary && nextSummary.status === "approved"));
  }, []);

  const handleWhatsAppVisit = useCallback(async () => {
    const whatsappLink = onboarding?.whatsappLink ?? null;
    if (!whatsappLink) {
      throw new Error("Kein WhatsApp-Link verfügbar.");
    }

    const alreadyVisited = Boolean(onboarding?.whatsappLinkVisitedAt);
    window.open(whatsappLink, "_blank", "noopener,noreferrer");

    const response = await fetch("/api/onboarding/whatsapp-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: unknown;
      visitedAt?: unknown;
    } | null;

    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string" && data.error.trim() ? data.error : "Aktion fehlgeschlagen",
      );
    }

    const visitedAt =
      typeof data?.visitedAt === "string" && data.visitedAt
        ? data.visitedAt
        : new Date().toISOString();
    setOnboarding((prev) => ({ ...(prev ?? EMPTY_ONBOARDING), whatsappLinkVisitedAt: visitedAt }));
    return { visitedAt, alreadyVisited } as const;
  }, [onboarding?.whatsappLink, onboarding?.whatsappLinkVisitedAt]);

  const sectionStatus = useMemo<Record<ProfileSectionId, ProfileSectionStatus>>(() => {
    const missing = new Set(
      summary.items.filter((item) => !item.complete).map((item) => item.targetSection),
    );
    const payoutLabel =
      PAYOUT_METHOD_OPTIONS.find((option) => option.value === user.payoutMethod)?.label ?? null;
    const show = onboarding?.show ?? null;
    return {
      stammdaten: {
        missing: missing.has("stammdaten"),
        summary: missing.has("stammdaten")
          ? user.dateOfBirth
            ? "Vorname"
            : "Geburtsdatum"
          : "Name, Profilbild, Konto",
      },
      zahlungen: {
        missing: missing.has("zahlungen"),
        summary: missing.has("zahlungen") ? "Auszahlungsweg" : (payoutLabel ?? "Hinterlegt"),
      },
      ernaehrung: {
        missing: missing.has("ernaehrung"),
        summary: [
          onboarding?.dietaryPreference ?? "Ernährungsstil",
          allergies.length
            ? `${allergies.length} ${allergies.length === 1 ? "Allergie" : "Allergien"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      freigaben: {
        missing: missing.has("freigaben"),
        summary: missing.has("freigaben") ? "Einverständnis" : "Erteilt",
      },
      interessen: {
        missing: false,
        summary: interests.length
          ? interests.slice(0, 3).join(", ") + (interests.length > 3 ? " …" : "")
          : "Noch keine",
      },
      produktion: {
        missing: false,
        summary: show
          ? (show.title ?? `Produktion ${show.year}`)
          : rolePreferences.length
            ? `${rolePreferences.filter((pref) => pref.weight > 0).length} Wünsche`
            : "Rollen- und Gewerkewünsche",
      },
    };
  }, [
    allergies.length,
    interests,
    onboarding,
    rolePreferences,
    summary.items,
    user.dateOfBirth,
    user.payoutMethod,
  ]);

  const renderSection = (section: ProfileSectionId) => {
    switch (section) {
      case "stammdaten":
        return <BasicsSection user={user} onUserUpdated={handleUserUpdated} />;
      case "zahlungen":
        return <PaymentSection user={user} onUserUpdated={handleUserUpdated} />;
      case "ernaehrung":
        return (
          <NutritionSection
            onboarding={onboarding}
            allergies={allergies}
            onAllergiesChange={setAllergies}
            onDietaryUpdated={handleDietaryUpdated}
          />
        );
      case "interessen":
        return <InterestsSection interests={interests} onInterestsChange={setInterests} />;
      case "freigaben":
        return <PhotoConsentCard onSummaryChange={handlePhotoConsentSummary} />;
      case "produktion":
        return (
          <ProductionSection
            onboarding={onboarding}
            onOnboardingChange={setOnboarding}
            rolePreferences={rolePreferences}
            onRolePreferencesChange={setRolePreferences}
            onWhatsAppVisit={handleWhatsAppVisit}
            availableOnboardings={availableOnboardings}
          />
        );
    }
  };

  const mobileSection = selectedSection;
  const activeDefinition = PROFILE_SECTIONS.find((entry) => entry.id === desktopSection);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className={cn(mobileSection ? "hidden lg:block" : "block")}>
        <ProfileHeader user={user} displayName={displayName} summary={summary} history={history} />
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav
          aria-label="Profilbereiche"
          className={cn("lg:sticky lg:top-24", mobileSection ? "hidden lg:block" : "block")}
        >
          <ProfileSectionNav activeSection={desktopSection} status={sectionStatus} />
        </nav>

        <section
          aria-labelledby="profile-section-title"
          className={cn("min-w-0 space-y-4", mobileSection ? "block" : "hidden lg:block")}
        >
          <div className="space-y-1">
            <Link
              href="/mitglieder/profil"
              className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden />
              Profil
            </Link>
            <h2
              id="profile-section-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {activeDefinition?.label}
            </h2>
            {activeDefinition?.description ? (
              <p className="text-sm text-muted-foreground">{activeDefinition.description}</p>
            ) : null}
          </div>
          {renderSection(desktopSection)}
        </section>
      </div>
    </div>
  );
}

export { OnboardingSection } from "./sections/onboarding-section";
export type { OnboardingSectionProps } from "./sections/onboarding-section";
