"use client";

import {
  ArrowRightIcon,
  CreditCardIcon,
  EyeIcon,
  HeartIcon,
  MessageCircleIcon,
  SparklesIcon,
  TheaterIcon,
  UserIcon,
  UtensilsIcon,
} from "@/components/ui/action-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import { buildProfileChecklist, type ProfileChecklistTarget } from "@/lib/profile-completion";
import { getUserDisplayName } from "@/lib/names";
import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import type { PhotoConsentSummary } from "@/types/photo-consent";
import { type Role } from "@prisma/client";
import { ProfileCompletionProvider, useProfileCompletion } from "./profile-completion-context";
import { ProfileOverviewCard } from "./profile-overview-card";
import { BasicsSection } from "./sections/basics-section";
import { PaymentSection } from "./sections/payment-section";
import { NutritionSection } from "./sections/nutrition-section";
import { InterestsSection } from "./sections/interests-section";
import { OnboardingSection } from "./sections/onboarding-section";
import { RolePreferencesSection } from "./sections/role-preferences-section";
import {
  CHECKLIST_TARGETS,
  formatDateLabel,
  ProfileClientProps,
  ProfileUser,
  Allergy,
  OnboardingProfile,
  isProfilePaymentComplete,
  ChecklistState,
  HighlightTileConfig,
} from "./profile-shared";

export function ProfileClient({
  user,
  rolePreferences,
  onboarding,
  interests,
  allergies,
  checklist,
  availableOnboardings,
}: ProfileClientProps) {
  return (
    <ProfileCompletionProvider initialSummary={checklist}>
      <ProfileClientInner
        initialUser={user}
        initialRolePreferences={rolePreferences}
        initialOnboarding={onboarding}
        initialInterests={interests}
        initialAllergies={allergies}
        availableOnboardings={availableOnboardings}
      />
    </ProfileCompletionProvider>
  );
}

type ProfileClientInnerProps = {
  initialUser: ProfileUser;
  initialRolePreferences: ProfileClientProps["rolePreferences"];
  initialOnboarding: ProfileClientProps["onboarding"];
  initialInterests: string[];
  initialAllergies: ProfileClientProps["allergies"];
  availableOnboardings: OnboardingSummary[];
};

function ProfileClientInner({
  initialUser,
  initialRolePreferences,
  initialOnboarding,
  initialInterests,
  initialAllergies,
  availableOnboardings,
}: ProfileClientInnerProps) {
  const { summary, replaceSummary } = useProfileCompletion();
  const { update: refreshSession } = useSession();

  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [onboarding, setOnboarding] = useState<ProfileClientProps["onboarding"]>(initialOnboarding);
  const [rolePreferences, setRolePreferences] =
    useState<ProfileClientProps["rolePreferences"]>(initialRolePreferences);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [allergies, setAllergies] = useState<Allergy[]>(initialAllergies);
  const [activeTab, setActiveTab] = useState<string>("stammdaten");
  const whatsappLink = onboarding?.whatsappLink ?? null;
  const activeChecklistTarget = useMemo<ProfileChecklistTarget | undefined>(() => {
    const maybeTarget = activeTab as ProfileChecklistTarget;
    return CHECKLIST_TARGETS.includes(maybeTarget) ? maybeTarget : undefined;
  }, [activeTab]);

  const [checklistState, setChecklistState] = useState<ChecklistState>(() => ({
    hasBasicData: Boolean(initialUser.firstName?.trim() && initialUser.email?.trim()),
    hasBirthdate: Boolean(initialUser.dateOfBirth),
    hasPaymentDetails: isProfilePaymentComplete(initialUser),
    hasDietaryPreference: Boolean(initialOnboarding?.dietaryPreference?.trim()),
    photoConsentGiven:
      summary.items.find((item) => item.id === "photo-consent")?.complete ?? undefined,
    hasWhatsappVisit: initialOnboarding?.whatsappLink
      ? Boolean(initialOnboarding.whatsappLinkVisitedAt)
      : undefined,
  }));

  const buildSummaryFromState = useCallback(
    (state: ChecklistState) =>
      buildProfileChecklist({
        hasBasicData: state.hasBasicData,
        hasBirthdate: state.hasBirthdate,
        hasPaymentDetails: state.hasPaymentDetails,
        hasDietaryPreference: state.hasDietaryPreference,
        photoConsent:
          state.photoConsentGiven === undefined
            ? undefined
            : { consentGiven: Boolean(state.photoConsentGiven) },
        hasWhatsappVisit: whatsappLink ? state.hasWhatsappVisit : undefined,
      }),
    [whatsappLink],
  );

  const updateChecklist = useCallback((patch: Partial<ChecklistState> = {}) => {
    setChecklistState((prev) => ({ ...prev, ...patch }));
  }, []);

  const checklistMountedRef = useRef(false);
  useEffect(() => {
    if (!checklistMountedRef.current) {
      checklistMountedRef.current = true;
      return;
    }
    replaceSummary(buildSummaryFromState(checklistState));
  }, [checklistState, buildSummaryFromState, replaceSummary]);

  const hasPhotoConsentChecklist = useMemo(
    () => summary.items.some((item) => item.id === "photo-consent"),
    [summary.items],
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

  const sortedRoles = useMemo(() => Array.from(new Set<Role>(user.roles)).sort(), [user.roles]);

  const createdAtLabel = useMemo(() => formatDateLabel(user.createdAt), [user.createdAt]);
  const memberSinceLabel = useMemo(() => {
    if (onboarding?.memberSinceYear) {
      return `Seit ${onboarding.memberSinceYear}`;
    }
    if (createdAtLabel) {
      return `Seit ${createdAtLabel}`;
    }
    return null;
  }, [createdAtLabel, onboarding]);

  const whatsappVisitedAt = onboarding?.whatsappLinkVisitedAt ?? null;
  const whatsappVisitedAtLabel = useMemo(
    () => formatDateLabel(whatsappVisitedAt),
    [whatsappVisitedAt],
  );

  useEffect(() => {
    if (!whatsappLink) {
      updateChecklist({ hasWhatsappVisit: undefined });
      return;
    }
    updateChecklist({ hasWhatsappVisit: Boolean(onboarding?.whatsappLinkVisitedAt) });
  }, [onboarding?.whatsappLinkVisitedAt, updateChecklist, whatsappLink]);

  const percentComplete = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;

  const handleUserUpdated = useCallback(
    async (nextUser: ProfileUser) => {
      setUser(nextUser);
      const basicsComplete = Boolean(nextUser.firstName?.trim() && nextUser.email?.trim());
      updateChecklist({
        hasBasicData: basicsComplete,
        hasBirthdate: Boolean(nextUser.dateOfBirth),
        hasPaymentDetails: isProfilePaymentComplete(nextUser),
      });
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
    [refreshSession, updateChecklist],
  );

  const handleDietaryUpdated = useCallback(
    (preference: { label: string | null; strictnessLabel: string | null }) => {
      setOnboarding((prev) => {
        if (!prev) {
          return {
            focus: "acting",
            background: null,
            backgroundClass: null,
            notes: null,
            memberSinceYear: null,
            dietaryPreference: preference.label,
            dietaryPreferenceStrictness: preference.strictnessLabel,
            whatsappLinkVisitedAt: null,
            updatedAt: null,
            preferences: [],
            show: null,
            whatsappLink: null,
          } satisfies OnboardingProfile;
        }
        return {
          ...prev,
          dietaryPreference: preference.label,
          dietaryPreferenceStrictness: preference.strictnessLabel,
        };
      });
      updateChecklist({ hasDietaryPreference: Boolean(preference.label?.trim()) });
    },
    [updateChecklist],
  );

  const handlePhotoConsentSummary = useCallback(
    (nextSummary: PhotoConsentSummary | null) => {
      if (!hasPhotoConsentChecklist) {
        return;
      }
      updateChecklist({
        photoConsentGiven: Boolean(nextSummary && nextSummary.status === "approved"),
      });
    },
    [hasPhotoConsentChecklist, updateChecklist],
  );

  const handleWhatsAppVisit = useCallback(async () => {
    if (!whatsappLink) {
      throw new Error("Kein WhatsApp-Link verfügbar.");
    }

    const alreadyVisited = Boolean(onboarding?.whatsappLinkVisitedAt);
    window.open(whatsappLink, "_blank", "noopener,noreferrer");

    try {
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
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "Aktion fehlgeschlagen";
        throw new Error(message);
      }

      const visitedAt =
        typeof data?.visitedAt === "string" && data.visitedAt
          ? data.visitedAt
          : new Date().toISOString();

      setOnboarding((prev) => {
        if (!prev) {
          return {
            focus: "acting",
            background: null,
            backgroundClass: null,
            notes: null,
            memberSinceYear: null,
            dietaryPreference: null,
            dietaryPreferenceStrictness: null,
            whatsappLinkVisitedAt: visitedAt,
            updatedAt: null,
            preferences: [],
            show: null,
            whatsappLink: null,
          } satisfies OnboardingProfile;
        }

        return { ...prev, whatsappLinkVisitedAt: visitedAt } satisfies OnboardingProfile;
      });

      updateChecklist({ hasWhatsappVisit: true });

      return { visitedAt, alreadyVisited } as const;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Aktion fehlgeschlagen");
    }
  }, [onboarding, updateChecklist, whatsappLink]);

  const dietaryPreference = useMemo(
    () => ({
      label: onboarding?.dietaryPreference ?? null,
      strictnessLabel: onboarding?.dietaryPreferenceStrictness ?? null,
    }),
    [onboarding?.dietaryPreference, onboarding?.dietaryPreferenceStrictness],
  );

  const highlightTiles = useMemo<HighlightTileConfig[]>(() => {
    if (!whatsappLink) {
      return [];
    }

    return [
      {
        id: "whatsapp",
        icon: <MessageCircleIcon className="h-5 w-5" aria-hidden />,
        title: "Team-Chat",
        description: whatsappVisitedAtLabel
          ? `Bereits geöffnet am ${whatsappVisitedAtLabel}.`
          : "Öffne den WhatsApp-Infokanal für aktuelle Updates.",
        hint: whatsappVisitedAtLabel ? null : "Der Link öffnet sich in einem neuen Tab.",
        tone: whatsappVisitedAt ? "success" : "info",
        action: (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 w-full justify-between rounded-full border-border/60 text-sm font-semibold"
            onClick={() => {
              void handleWhatsAppVisit()
                .then(({ alreadyVisited }) => {
                  toast.success(
                    alreadyVisited ? "WhatsApp-Link geöffnet" : "WhatsApp-Besuch vermerkt",
                  );
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen";
                  toast.error(message);
                });
            }}
          >
            <span>{whatsappVisitedAt ? "Erneut öffnen" : "Chat öffnen"}</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden />
          </Button>
        ),
      },
    ];
  }, [whatsappLink, whatsappVisitedAt, whatsappVisitedAtLabel, handleWhatsAppVisit]);

  const tabOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; icon: typeof UserIcon }> = [
      { value: "stammdaten", label: "Stammdaten", icon: UserIcon },
      { value: "zahlungen", label: "Zahlungsdaten", icon: CreditCardIcon },
      { value: "ernaehrung", label: "Ernährung", icon: UtensilsIcon },
      { value: "interessen", label: "Interessen", icon: HeartIcon },
      { value: "freigaben", label: "Freigaben", icon: EyeIcon },
      { value: "onboarding", label: "Onboarding", icon: SparklesIcon },
      { value: "rollen", label: "Präferenzen", icon: TheaterIcon },
    ];

    return options;
  }, []);

  return (
    <div className="space-y-8">
      <ProfileOverviewCard
        user={user}
        displayName={displayName}
        sortedRoles={sortedRoles}
        summary={summary}
        onboarding={onboarding}
        createdAtLabel={createdAtLabel}
        memberSinceLabel={memberSinceLabel}
        percentComplete={percentComplete}
        highlights={highlightTiles}
        activeChecklistTarget={activeChecklistTarget}
        onChecklistNavigate={(target) => setActiveTab(target)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col gap-3">
          {/* Mobile: Kompakte Navigation mit Icons */}
          <div className="xl:hidden -mx-4 sm:-mx-6">
            <div className="overflow-x-auto px-4 sm:px-6 pb-px scrollbar-hide">
              <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 sm:grid-cols-3">
                {tabOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = activeTab === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setActiveTab(option.value)}
                      className={`flex min-w-0 flex-col items-center gap-1 rounded-md px-2.5 py-2 text-center text-xs font-medium transition-all ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
                      <span className="truncate max-w-full">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop: Pill-Tabs */}
          <TabsList className="hidden w-full flex-nowrap items-center justify-between gap-1 overflow-x-auto rounded-full border border-border/60 bg-background/80 p-1 text-muted-foreground shadow-inner ring-1 ring-primary/10 backdrop-blur xl:flex">
            {tabOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="inline-flex min-w-0 flex-1 basis-0 items-center justify-center whitespace-nowrap px-2.5 py-2 text-[0.65rem] font-semibold uppercase tracking-wide transition text-center leading-tight xl:px-3.5 xl:text-[0.75rem]"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="stammdaten" className="space-y-6">
          <BasicsSection user={user} onUserUpdated={handleUserUpdated} />
        </TabsContent>

        <TabsContent value="zahlungen" className="space-y-6">
          <PaymentSection user={user} onUserUpdated={handleUserUpdated} />
        </TabsContent>

        <TabsContent value="ernaehrung" className="space-y-6">
          <NutritionSection
            onboarding={onboarding}
            allergies={allergies}
            onAllergiesChange={setAllergies}
            onDietaryUpdated={handleDietaryUpdated}
          />
        </TabsContent>

        <TabsContent value="interessen" className="space-y-6">
          <InterestsSection interests={interests} onInterestsChange={setInterests} />
        </TabsContent>

        <TabsContent value="freigaben" className="space-y-4">
          <PhotoConsentCard onSummaryChange={handlePhotoConsentSummary} />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <OnboardingSection
            onboarding={onboarding}
            onOnboardingChange={setOnboarding}
            rolePreferences={rolePreferences}
            whatsappVisitedAt={whatsappVisitedAt}
            onWhatsAppVisit={handleWhatsAppVisit}
            dietaryPreference={dietaryPreference}
            availableOnboardings={availableOnboardings}
          />
        </TabsContent>

        <TabsContent value="rollen" className="space-y-6">
          <RolePreferencesSection
            onboarding={onboarding}
            rolePreferences={rolePreferences}
            onRolePreferencesChange={setRolePreferences}
            onOnboardingChange={setOnboarding}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { OnboardingSection } from "./sections/onboarding-section";
export type { OnboardingSectionProps } from "./sections/onboarding-section";
