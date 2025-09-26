"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AllergyLevel, MeasurementType, MeasurementUnit, Role } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { ProfileSummaryCard } from "@/components/members/profile-summary-card";
import { ProfileForm } from "@/components/members/profile-form";
import { ProfileInterestsCard } from "@/components/members/profile-interests-card";
import { MemberMeasurementsManager } from "@/components/members/measurements/member-measurements-manager";
import { ProfileCompletionProvider } from "@/components/members/profile-completion-context";
import { ProfileChecklistCard } from "@/components/members/profile-checklist-card";
import { ProfilePhotoConsentNotice } from "@/components/members/profile-photo-consent-notice";
import { ProfileDietaryPreferences } from "@/components/members/profile-dietary-preferences";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import {
  ProfileOnboardingEditor,
  type ProfileOnboardingState,
} from "@/components/members/profile-onboarding-editor";
import type { ProfileChecklistItem, ProfileChecklistTarget } from "@/lib/profile-completion";
import type { AvatarSource } from "@/components/user-avatar";
import type { PhotoConsentStatus, PhotoConsentSummary } from "@/types/photo-consent";
import type {
  DietaryStrictnessOption,
  DietaryStyleOption,
} from "@/data/dietary-preferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ROLE_BADGE_VARIANTS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/roles";
import { getUserDisplayName } from "@/lib/names";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileBadge,
  Gavel,
  IdCard,
  Mail,
  PiggyBank,
  Ruler,
  Sparkles,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  VenetianMask,
  Wrench,
  UtensilsCrossed,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  sortMeasurements,
} from "@/data/measurements";
import { resolveDietaryStyleLabel } from "@/data/dietary-preferences";

interface MeasurementEntry {
  id: string;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  note?: string | null;
  updatedAt: string;
}

interface AllergyEntry {
  allergen: string;
  level: AllergyLevel;
  symptoms?: string | null;
  treatment?: string | null;
  note?: string | null;
  updatedAt: string;
}

interface ProfileUserSummary {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email: string | null;
  roles: Role[];
  avatarSource: string | null;
  avatarUpdatedAt: string | null;
  dateOfBirth: string | null;
}

interface DietaryPreferenceState {
  style: DietaryStyleOption;
  customLabel: string | null;
  strictness: DietaryStrictnessOption;
}

function toAvatarSource(value: string | null): AvatarSource | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  return normalized === "GRAVATAR" || normalized === "UPLOAD" || normalized === "INITIALS"
    ? (normalized as AvatarSource)
    : null;
}

const ROLE_ICON_MAP: Record<Role, LucideIcon> = {
  member: UsersRound,
  cast: VenetianMask,
  tech: Wrench,
  board: Gavel,
  finance: PiggyBank,
  owner: Crown,
  admin: ShieldCheck,
};

const ROLE_ICON_ACCENTS: Record<Role, string> = {
  member: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200",
  cast: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-200",
  tech: "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-200",
  board: "border-teal-400/40 bg-teal-500/10 text-teal-600 dark:text-teal-200",
  finance: "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-200",
  owner: "border-purple-400/40 bg-purple-500/10 text-purple-600 dark:text-purple-200",
  admin: "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-200",
};

const ROLE_STATUS_BADGE_CLASSES =
  "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";

type ProfileTabId = ProfileChecklistTarget | "interessen" | "onboarding";

const summaryDateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

const summaryDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const EMPTY_VALUE_LABEL = "Nicht hinterlegt";

const AVATAR_SOURCE_LABELS: Record<AvatarSource, string> = {
  GRAVATAR: "Gravatar",
  INITIALS: "Initialen",
  UPLOAD: "Eigenes Bild",
};

const ALLERGY_LEVEL_STYLES: Record<AllergyLevel, string> = {
  MILD: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600",
  MODERATE: "border-amber-400/40 bg-amber-500/10 text-amber-600",
  SEVERE: "border-rose-400/40 bg-rose-500/10 text-rose-600",
  LETHAL: "border-red-500/50 bg-red-500/10 text-red-600",
};

const PHOTO_STATUS_BADGES: Record<PhotoConsentStatus, string> = {
  none: "border-border/60 bg-muted/30 text-muted-foreground",
  pending: "border-amber-400/40 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700",
  rejected: "border-rose-400/40 bg-rose-500/10 text-rose-700",
};

const PHOTO_STATUS_LABELS: Record<PhotoConsentStatus, string> = {
  none: "Keine Angaben",
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const ONBOARDING_FOCUS_LABELS: Record<"acting" | "tech" | "both", string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};

const ONBOARDING_FOCUS_DESCRIPTIONS: Record<"acting" | "tech" | "both", string> = {
  acting: "Du möchtest auf der Bühne wirken und Rollen gestalten.",
  tech: "Du möchtest hinter den Kulissen organisieren, bauen oder für Licht & Ton sorgen.",
  both: "Du bleibst flexibel zwischen Bühne und Gewerken und entscheidest situativ.",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return summaryDateFormatter.format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return summaryDateTimeFormatter.format(date);
}

function formatMeasurementValue(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })
    : "-";
}

function calculateAge(date: string | null) {
  if (!date) return null;
  const birthday = new Date(date);
  if (Number.isNaN(birthday.valueOf())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function renderText(value: string | null | undefined): ReactNode {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>;
  }
  return <span>{trimmed}</span>;
}

interface SummaryFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
}

function SummaryField({ label, description, children }: SummaryFieldProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="text-sm text-foreground">{children}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

interface ProfilePageClientProps {
  user: ProfileUserSummary;
  checklist: ProfileChecklistItem[];
  canManageMeasurements: boolean;
  measurements?: MeasurementEntry[];
  dietaryPreference: DietaryPreferenceState;
  allergies: AllergyEntry[];
  onboarding: ProfileOnboardingState;
  photoConsent: PhotoConsentSummary | null;
  whatsappLink: string | null;
  whatsappLinkVisitedAt: string | null;
}

function ProfileRolesCard({ roles }: { roles: Role[] }) {
  if (!roles.length) {
    return (
      <Card className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Rollen &amp; Berechtigungen</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
            Dir sind aktuell keine Rollen zugewiesen. Wende dich an die Produktionsleitung, wenn dir Inhalte fehlen.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/80 p-0 shadow-lg shadow-primary/10">
      <CardHeader className="space-y-3 px-6 pb-4 pt-6 sm:px-8">
        <CardTitle className="text-xl">Rollen &amp; Berechtigungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Deine Rollen steuern Sichtbarkeit und Handlungsrechte im Mitgliederportal. Wende dich bei fehlenden Rechten an die Administration.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 sm:px-8">
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Badge
              key={role}
              className={cn(
                "px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                ROLE_BADGE_VARIANTS[role],
              )}
            >
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
        </div>
        <ul className="space-y-3">
          {roles.map((role) => {
            const Icon = ROLE_ICON_MAP[role];
            const description =
              ROLE_DESCRIPTIONS[role] ?? "Diese Rolle ist aktuell aktiv.";
            return (
              <li
                key={role}
                className="flex gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur"
              >
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border text-sm",
                    ROLE_ICON_ACCENTS[role],
                  )}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {ROLE_LABELS[role] ?? role}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                        ROLE_STATUS_BADGE_CLASSES,
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Aktiv
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ProfilePageClient({
  user,
  checklist,
  canManageMeasurements,
  measurements,
  dietaryPreference,
  allergies,
  onboarding,
  photoConsent,
  whatsappLink,
  whatsappLinkVisitedAt,
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>("stammdaten");
  const [activeEditor, setActiveEditor] = useState<ProfileTabId | null>(null);
  const [profileUser, setProfileUser] = useState<ProfileUserSummary>(user);
  const [preferenceState, setPreferenceState] =
    useState<DietaryPreferenceState>(dietaryPreference);
  const [allergyState, setAllergyState] = useState<AllergyEntry[]>(allergies);
  const [photoSummary, setPhotoSummary] = useState<PhotoConsentSummary | null>(
    photoConsent,
  );
  const [measurementState, setMeasurementState] = useState<MeasurementEntry[]>(() =>
    canManageMeasurements ? sortMeasurements(measurements ?? []) : [],
  );
  const [onboardingState, setOnboardingState] =
    useState<ProfileOnboardingState>(onboarding);
  const [whatsappVisitedAtState, setWhatsappVisitedAtState] = useState<Date | null>(() => {
    if (!whatsappLinkVisitedAt) {
      return null;
    }
    const parsed = new Date(whatsappLinkVisitedAt);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  });
  const [whatsappPending, setWhatsappPending] = useState(false);

  const measurementEntries = canManageMeasurements ? measurementState : [];

  useEffect(() => {
    if (!whatsappLinkVisitedAt) {
      setWhatsappVisitedAtState(null);
      return;
    }
    const parsed = new Date(whatsappLinkVisitedAt);
    setWhatsappVisitedAtState(Number.isNaN(parsed.valueOf()) ? null : parsed);
  }, [whatsappLinkVisitedAt]);

  const displayName = getUserDisplayName(
    {
      firstName: profileUser.firstName,
      lastName: profileUser.lastName,
      name: profileUser.name,
      email: profileUser.email,
    },
    "",
  );

  const birthdate = formatDate(profileUser.dateOfBirth);
  const avatarSource = toAvatarSource(profileUser.avatarSource);
  const avatarSourceLabel = avatarSource
    ? AVATAR_SOURCE_LABELS[avatarSource]
    : "Automatisch";
  const avatarUpdatedAt = formatDate(profileUser.avatarUpdatedAt);
  const age = calculateAge(profileUser.dateOfBirth);

  const dietaryStyle = resolveDietaryStyleLabel(
    preferenceState.style,
    preferenceState.customLabel,
  );

  const onboardingUpdatedAtDate = formatDate(onboardingState.updatedAt);
  const onboardingUpdatedAtDetail = formatDateTime(onboardingState.updatedAt);
  const onboardingFocusLabel = onboardingState.focus
    ? ONBOARDING_FOCUS_LABELS[onboardingState.focus]
    : null;
  const onboardingFocusDescription = onboardingState.focus
    ? ONBOARDING_FOCUS_DESCRIPTIONS[onboardingState.focus]
    : null;
  const onboardingMemberSince = onboardingState.memberSinceYear
    ? `Seit ${onboardingState.memberSinceYear}`
    : null;

  const latestMeasurementUpdate = measurementEntries.reduce<string | null>(
    (latest, entry) => {
      if (!entry.updatedAt) return latest;
      if (!latest) return entry.updatedAt;
      const current = new Date(entry.updatedAt).getTime();
      const previous = new Date(latest).getTime();
      return current > previous ? entry.updatedAt : latest;
    },
    null,
  );

  const selectTab = useCallback(
    (section: ProfileTabId) => {
      if (section === "masse" && !canManageMeasurements) {
        return false;
      }
      setActiveTab(section);
      setActiveEditor(section);
      return true;
    },
    [canManageMeasurements],
  );

  const handleTabChange = useCallback(
    (value: string) => {
      selectTab(value as ProfileTabId);
    },
    [selectTab],
  );

  const handleNavigateToSection = useCallback(
    (section: ProfileTabId) => {
      const didSelect = selectTab(section);
      if (!didSelect) {
        return;
      }
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const element = document.getElementById("profile-tabs");
          if (element instanceof HTMLElement) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            element.classList.add("ring-2", "ring-primary/40");
            window.setTimeout(() => {
              element.classList.remove("ring-2", "ring-primary/40");
            }, 1200);
          }
        });
      }
    },
    [selectTab],
  );

  const closeEditor = useCallback(() => {
    setActiveEditor(null);
  }, []);

  const handleManagePhoto = useCallback(() => {
    selectTab("freigaben");
  }, [selectTab]);

  const handlePhotoSummaryChange = useCallback(
    (summary: PhotoConsentSummary | null) => {
      setPhotoSummary(summary);
    },
    [],
  );

  const photoStatus: PhotoConsentStatus = photoSummary?.status ?? "none";
  const photoStatusLabel = PHOTO_STATUS_LABELS[photoStatus];
  const photoStatusBadge = PHOTO_STATUS_BADGES[photoStatus];
  const photoUpdatedAt = formatDate(
    photoSummary?.updatedAt ?? photoSummary?.submittedAt ?? null,
  );

  const shouldShowPhotoNotice =
    !!photoSummary &&
    (photoSummary.status === "none" ||
      photoSummary.status === "rejected" ||
      photoSummary.requiresDateOfBirth ||
      (photoSummary.requiresDocument && !photoSummary.hasDocument));

  const rolesLabelList = profileUser.roles.map(
    (role) => ROLE_LABELS[role] ?? role,
  );

  const normalizedWhatsappLink = whatsappLink?.trim() ? whatsappLink.trim() : null;
  const showWhatsappNotice = Boolean(normalizedWhatsappLink && !whatsappVisitedAtState);

  const handleWhatsappVisit = useCallback(() => {
    if (!normalizedWhatsappLink || whatsappVisitedAtState || whatsappPending) {
      return;
    }

    setWhatsappPending(true);

    const send = async () => {
      try {
        const response = await fetch("/api/onboarding/whatsapp-visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
          keepalive: true,
        });

        if (!response.ok) {
          throw new Error(`RequestFailed:${response.status}`);
        }

        const data = (await response.json().catch(() => null)) as { visitedAt?: string } | null;
        const visitedIso = typeof data?.visitedAt === "string" ? data.visitedAt.trim() : "";
        const parsedVisited = visitedIso ? new Date(visitedIso) : new Date();
        const visitedDate = Number.isNaN(parsedVisited.valueOf()) ? new Date() : parsedVisited;
        setWhatsappVisitedAtState(visitedDate);
      } catch (error) {
        console.error("[profile.whatsapp] visit failed", error);
      } finally {
        setWhatsappPending(false);
      }
    };

    void send();
  }, [normalizedWhatsappLink, whatsappVisitedAtState, whatsappPending]);

  type HighlightItem = {
    key: string;
    label: string;
    icon: LucideIcon;
    value: ReactNode;
    hint?: ReactNode;
  };

  const highlightItems: HighlightItem[] = [
    {
      key: "photo",
      label: "Foto-Status",
      icon: FileBadge,
      value: (
        <Badge variant="outline" className={cn("text-xs", photoStatusBadge)}>
          {photoStatusLabel}
        </Badge>
      ),
      hint: photoUpdatedAt
        ? `Stand ${photoUpdatedAt}`
        : "Noch keine Freigabe abgeschlossen.",
    },
    {
      key: "onboarding",
      label: "Onboarding",
      icon: ClipboardList,
      value: onboardingFocusLabel ? (
        <span className="text-sm font-medium text-foreground">{onboardingFocusLabel}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
      ),
      hint: onboardingUpdatedAtDate
        ? `Zuletzt bearbeitet am ${onboardingUpdatedAtDate}`
        : "Noch keine Angaben aus dem Onboarding.",
    },
    {
      key: "roles",
      label: "Aktive Rollen",
      icon: UsersRound,
      value: (
        <span className="text-base font-semibold text-foreground">
          {profileUser.roles.length}
        </span>
      ),
      hint:
        rolesLabelList.length > 0
          ? rolesLabelList.slice(0, 2).join(", ")
          : "Keine Rollen hinterlegt.",
    },
    {
      key: "contact",
      label: "Kontakt",
      icon: Mail,
      value: profileUser.email ? (
        <span className="text-sm font-medium text-foreground">
          {profileUser.email}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
      ),
      hint: displayName ? `Anzeigename: ${displayName}` : undefined,
    },
    {
      key: "birthdate",
      label: "Geburtstag",
      icon: Calendar,
      value: birthdate ? (
        <span className="text-sm font-medium text-foreground">{birthdate}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
      ),
      hint: age ? `${age} Jahre` : undefined,
    },
    {
      key: "avatar",
      label: "Profilbild",
      icon: UserRoundCheck,
      value: (
        <span className="text-sm font-medium text-foreground">
          {avatarSourceLabel}
        </span>
      ),
      hint: avatarUpdatedAt
        ? `Aktualisiert am ${avatarUpdatedAt}`
        : "Automatische Darstellung",
    },
  ];

  if (canManageMeasurements) {
    const measurementLastUpdated = latestMeasurementUpdate
      ? formatDate(latestMeasurementUpdate)
      : null;
    highlightItems.push({
      key: "measurements",
      label: "Maße",
      icon: Ruler,
      value: (
        <span className="text-sm font-medium text-foreground">
          {measurementEntries.length
            ? `${measurementEntries.length} Werte`
            : "Keine Angaben"}
        </span>
      ),
      hint:
        measurementEntries.length && measurementLastUpdated
          ? `Stand ${measurementLastUpdated}`
          : measurementEntries.length
            ? undefined
            : "Bitte ergänzen, damit das Kostüm-Team planen kann.",
    });
  }

  const tabItems: { id: ProfileTabId; label: string; description: string; icon: LucideIcon }[] = [
    {
      id: "stammdaten",
      label: "Stammdaten",
      description: "Kontakt, Name & Geburtsdatum",
      icon: IdCard,
    },
    {
      id: "onboarding",
      label: "Onboarding",
      description: "Schwerpunkt & Hintergrund",
      icon: ClipboardList,
    },
    {
      id: "ernaehrung",
      label: "Ernährung",
      description: "Präferenzen und Allergien",
      icon: UtensilsCrossed,
    },
    {
      id: "masse",
      label: "Maße",
      description: "Körpermaße für Kostüm & Ausstattung",
      icon: Ruler,
    },
    {
      id: "interessen",
      label: "Interessen",
      description: "Engagement & Wunschbereiche",
      icon: Sparkles,
    },
    {
      id: "freigaben",
      label: "Freigaben",
      description: "Fotoeinverständnis & Dokumente",
      icon: FileBadge,
    },
  ];

  const visibleTabItems = tabItems.filter(
    (item) => item.id !== "masse" || canManageMeasurements,
  );

  let editorDialog:
    | {
        title: string;
        description?: string;
        content: ReactNode;
        size?: "wide";
      }
    | null = null;

  if (activeEditor === "stammdaten") {
    editorDialog = {
      title: "Stammdaten bearbeiten",
      description: "Passe Name, Kontaktadresse und Login-Daten an.",
      size: "wide",
      content: (
        <ProfileForm
          userId={profileUser.id}
          initialFirstName={profileUser.firstName}
          initialLastName={profileUser.lastName}
          initialName={profileUser.name}
          initialEmail={profileUser.email}
          initialAvatarSource={toAvatarSource(profileUser.avatarSource)}
          initialAvatarUpdatedAt={profileUser.avatarUpdatedAt}
          initialDateOfBirth={profileUser.dateOfBirth}
          onProfileChange={(next) => {
            setProfileUser((prev) => ({
              ...prev,
              firstName: next.firstName,
              lastName: next.lastName,
              name: next.name,
              email: next.email,
              avatarSource: next.avatarSource ?? null,
              avatarUpdatedAt: next.avatarUpdatedAt,
              dateOfBirth: next.dateOfBirth,
            }));
            setPhotoSummary((prev) =>
              prev
                ? {
                    ...prev,
                    dateOfBirth: next.dateOfBirth,
                    age: calculateAge(next.dateOfBirth),
                  }
                : prev,
            );
          }}
        />
      ),
    };
  } else if (activeEditor === "onboarding") {
    editorDialog = {
      title: "Onboarding-Angaben bearbeiten",
      description:
        "Passe Schwerpunkt, Hintergrund und Hinweise aus deinem Onboarding an.",
      size: "wide",
      content: (
        <ProfileOnboardingEditor
          initialState={onboardingState}
          onChange={(next) => {
            setOnboardingState(next);
          }}
        />
      ),
    };
  } else if (activeEditor === "ernaehrung") {
    editorDialog = {
      title: "Ernährung & Allergien bearbeiten",
      description: "Pflege Ernährungsstil und medizinische Hinweise.",
      content: (
        <ProfileDietaryPreferences
          initialPreference={preferenceState}
          initialAllergies={allergyState}
          onDietaryChange={({ preference, allergies: nextAllergies }) => {
            setPreferenceState(preference);
            setAllergyState(nextAllergies);
          }}
        />
      ),
    };
  } else if (activeEditor === "masse" && canManageMeasurements) {
    editorDialog = {
      title: "Maße & Kostümplanung",
      description: "Erfasse oder aktualisiere deine Körpermaße.",
      size: "wide",
      content: (
        <MemberMeasurementsManager
          initialMeasurements={measurementEntries}
          onMeasurementsChange={(entries) =>
            setMeasurementState(sortMeasurements(entries))
          }
        />
      ),
    };
  } else if (activeEditor === "interessen") {
    editorDialog = {
      title: "Interessen & Engagement",
      description: "Pflege Schlagworte, um passende Aufgaben zu finden.",
      content: <ProfileInterestsCard />,
    };
  } else if (activeEditor === "freigaben") {
    editorDialog = {
      title: "Freigaben & Fotoeinverständnis",
      description: "Verwalte Einverständnisse und lade Dokumente hoch.",
      content: <PhotoConsentCard onSummaryChange={handlePhotoSummaryChange} />,
    };
  }

  return (
    <ProfileCompletionProvider initialItems={checklist}>
      <div className="relative space-y-10 sm:space-y-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/15 via-transparent to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl dark:bg-secondary/25"
        />
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl shadow-primary/10">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-secondary/10"
          />
          <div className="relative space-y-8 p-6 sm:p-8">
            <PageHeader
              variant="section"
              title="Mein Profil"
              description="Halte deine Angaben aktuell, damit Teams und Kolleg*innen optimal planen können."
              className="max-w-2xl text-balance"
            />
            {showWhatsappNotice ? (
              <div className="space-y-2 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp-Gruppe fürs Ensemble
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-emerald-400/60 text-emerald-900"
                  >
                    <a
                      href={normalizedWhatsappLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleWhatsappVisit}
                    >
                      {whatsappPending ? "Wird geöffnet …" : "WhatsApp öffnen"}
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-emerald-900/80">
                  Du hast die Onboarding-Gruppe noch nicht besucht. Tritt bei, um aktuelle Informationen und Kontakte zu
                  erhalten.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {highlightItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-full border border-border/60 bg-muted/30 p-2 text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {item.label}
                        </p>
                        <div className="text-sm text-foreground">{item.value}</div>
                        {item.hint ? (
                          <p className="text-xs text-muted-foreground">{item.hint}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {shouldShowPhotoNotice ? (
            <div className="relative border-t border-border/60 bg-background/70 px-6 py-6 sm:px-8">
              <ProfilePhotoConsentNotice
                summary={photoSummary}
                onManage={handleManagePhoto}
              />
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] 2xl:gap-12">
          <aside className="space-y-6 xl:space-y-8">
            <ProfileSummaryCard
              userId={profileUser.id}
              firstName={profileUser.firstName}
              lastName={profileUser.lastName}
              name={profileUser.name}
              email={profileUser.email}
              roles={profileUser.roles}
              avatarSource={profileUser.avatarSource}
              avatarUpdatedAt={profileUser.avatarUpdatedAt}
            />

            <ProfileRolesCard roles={profileUser.roles} />

            <ProfileChecklistCard onNavigateToSection={handleNavigateToSection} />
          </aside>

          <section
            id="profile-tabs"
            className="space-y-6 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10 sm:p-8"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Profilbereiche
              </p>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Alles an einem Ort</h2>
                <p className="text-sm text-muted-foreground">
                  Bearbeite die Bereiche deines Profils und halte deine Angaben auf dem aktuellen Stand.
                </p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
              <TabsList className="!grid grid-cols-1 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleTabItems.map((item) => {
                  const Icon = item.icon;
                  return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    onClick={() => {
                      if (activeTab === item.id) {
                        selectTab(item.id);
                      }
                    }}
                    className="!flex h-full flex-col items-start gap-2 rounded-2xl px-3 py-3 text-left shadow-sm transition hover:bg-primary/5 hover:text-foreground sm:px-4 sm:py-4"
                  >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="space-y-8">
                <TabsContent value="stammdaten" className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SummaryField label="Vorname">
                      {renderText(profileUser.firstName)}
                    </SummaryField>
                    <SummaryField label="Nachname">
                      {renderText(profileUser.lastName)}
                    </SummaryField>
                    <SummaryField label="Anzeigename">
                      {renderText(displayName || null)}
                    </SummaryField>
                    <SummaryField
                      label="E-Mail-Adresse"
                      description="Wir verwenden diese Adresse für Login und Benachrichtigungen."
                    >
                      {renderText(profileUser.email)}
                    </SummaryField>
                    <SummaryField
                      label="Geburtsdatum"
                      description="Hilft bei der Verwaltung notwendiger Einverständnisse."
                    >
                      {birthdate ? (
                        <span>{birthdate}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {EMPTY_VALUE_LABEL}
                        </span>
                      )}
                    </SummaryField>
                    <SummaryField
                      label="Profilbild"
                      description="Quelle und Aktualisierung deines Avatars."
                    >
                      <div className="space-y-1">
                        <span>{avatarSourceLabel}</span>
                        {avatarUpdatedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Aktualisiert am {avatarUpdatedAt}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Noch kein Upload gespeichert.
                          </span>
                        )}
                      </div>
                    </SummaryField>
                  </div>

                </TabsContent>

                <TabsContent value="onboarding" className="space-y-6">
                  <SummaryField
                    label="Schwerpunkt"
                    description={
                      onboardingUpdatedAtDetail
                        ? `Zuletzt bearbeitet am ${onboardingUpdatedAtDetail}`
                        : "Noch keine Angaben aus dem Onboarding."
                    }
                  >
                    <div className="space-y-1">
                      {onboardingFocusLabel ? (
                        <span>{onboardingFocusLabel}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
                      )}
                      {onboardingFocusDescription ? (
                        <p className="text-xs text-muted-foreground">{onboardingFocusDescription}</p>
                      ) : null}
                    </div>
                  </SummaryField>

                  <SummaryField label="Hintergrund">
                    {onboardingState.background ? (
                      <span>{onboardingState.background}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
                    )}
                  </SummaryField>

                  <SummaryField label="Klasse/Jahrgang">
                    {onboardingState.backgroundClass ? (
                      <span>{onboardingState.backgroundClass}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
                    )}
                  </SummaryField>

                  <SummaryField label="Mitglied seit">
                    {onboardingMemberSince ? (
                      <span>{onboardingMemberSince}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
                    )}
                  </SummaryField>

                  <SummaryField label="Notizen">
                    {onboardingState.notes ? (
                      <p className="whitespace-pre-wrap text-sm">{onboardingState.notes}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground">{EMPTY_VALUE_LABEL}</span>
                    )}
                  </SummaryField>

                </TabsContent>

                <TabsContent value="ernaehrung" className="space-y-6">
                  <div className="grid gap-4">
                    <SummaryField
                      label="Ernährungsstil"
                    >
                      <div className="space-y-1">
                        <span>{dietaryStyle.label}</span>
                        {preferenceState.customLabel ? (
                          <span className="text-xs text-muted-foreground">
                            Eigene Beschreibung: {preferenceState.customLabel}
                          </span>
                        ) : null}
                      </div>
                    </SummaryField>
                  </div>

                  <SummaryField label="Allergien & Unverträglichkeiten">
                    {allergyState.length ? (
                      <div className="flex flex-wrap gap-2">
                        {allergyState.slice(0, 6).map((entry) => (
                          <Badge
                            key={entry.allergen}
                            variant="outline"
                            className={cn("text-xs", ALLERGY_LEVEL_STYLES[entry.level])}
                          >
                            {entry.allergen}
                          </Badge>
                        ))}
                        {allergyState.length > 6 ? (
                          <span className="text-xs text-muted-foreground">
                            +{allergyState.length - 6} weitere
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {EMPTY_VALUE_LABEL}
                      </span>
                    )}
                  </SummaryField>

                </TabsContent>

                {canManageMeasurements ? (
                  <TabsContent value="masse" className="space-y-6">
                    <SummaryField
                      label="Erfasste Maße"
                      description="Gib dem Kostüm-Team aktuelle Werte an die Hand."
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary"
                        >
                          {measurementEntries.length} Werte
                        </Badge>
                        {measurementEntries.length && latestMeasurementUpdate ? (
                          <span className="text-xs text-muted-foreground">
                            Aktualisiert am {formatDate(latestMeasurementUpdate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Noch keine Werte hinterlegt.
                          </span>
                        )}
                      </div>
                    </SummaryField>

                    {measurementEntries.length ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {measurementEntries.slice(0, 4).map((entry) => (
                          <SummaryField
                            key={entry.type}
                            label={MEASUREMENT_TYPE_LABELS[entry.type]}
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-base font-semibold text-foreground">
                                {formatMeasurementValue(entry.value)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit}
                              </span>
                            </div>
                            {entry.note ? (
                              <p className="text-xs text-muted-foreground">{entry.note}</p>
                            ) : null}
                            <p className="text-[11px] text-muted-foreground">
                              Aktualisiert am {formatDate(entry.updatedAt) ?? "-"}
                            </p>
                          </SummaryField>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Erfasse deine Maße, damit das Kostüm-Team planen kann.
                      </p>
                    )}

                    {measurementEntries.length > 4 ? (
                      <p className="text-xs text-muted-foreground">
                        Weitere Maße findest du im Bearbeitungsmodus.
                      </p>
                    ) : null}

                  </TabsContent>
                ) : null}

                <TabsContent value="interessen" className="space-y-6">
                  <SummaryField
                    label="Status"
                    description="Öffne den Bereich, um deine Interessen zu pflegen."
                  >
                    <span className="text-sm text-muted-foreground">
                      Interessen werden beim Öffnen geladen.
                    </span>
                  </SummaryField>

                </TabsContent>

                <TabsContent value="freigaben" className="space-y-6">
                  <SummaryField
                    label="Status"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", photoStatusBadge)}>
                        {photoStatusLabel}
                      </Badge>
                      {photoUpdatedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Aktualisiert am {photoUpdatedAt}
                        </span>
                      ) : null}
                    </div>
                  </SummaryField>

                  <SummaryField
                    label="Geburtsdatum & Alter"
                  >
                    {photoSummary?.dateOfBirth ? (
                      <div className="space-y-1">
                        <span>{formatDate(photoSummary.dateOfBirth)}</span>
                        {photoSummary.age !== null ? (
                          <span className="text-xs text-muted-foreground">
                            {photoSummary.age} Jahre
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {photoSummary?.requiresDateOfBirth
                          ? "Bitte ergänze dein Geburtsdatum."
                          : EMPTY_VALUE_LABEL}
                      </span>
                    )}
                  </SummaryField>

                  <SummaryField
                    label="Dokumente"
                  >
                    {photoSummary ? (
                      <div className="space-y-1">
                        <span>
                          {photoSummary.requiresDocument
                            ? photoSummary.hasDocument
                              ? "Dokument liegt vor."
                              : "Dokument erforderlich – bitte hochladen."
                            : "Kein Dokument notwendig."}
                        </span>
                        {photoSummary.documentUploadedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Hochgeladen am {" "}
                            {formatDate(photoSummary.documentUploadedAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {EMPTY_VALUE_LABEL}
                      </span>
                    )}
                  </SummaryField>

                  {photoSummary?.rejectionReason ? (
                    <SummaryField
                      label="Hinweis"
                    >
                      <span className="text-sm text-destructive">
                        {photoSummary.rejectionReason}
                      </span>
                    </SummaryField>
                  ) : null}

                </TabsContent>
              </div>
            </Tabs>
          </section>
        </div>
      </div>
      <Dialog
        open={!!editorDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        {editorDialog ? (
          <DialogContent
            className={cn(
              "max-h-[90vh] overflow-y-auto sm:max-w-3xl",
              editorDialog.size === "wide" && "sm:max-w-4xl",
            )}
          >
            <DialogHeader>
              <DialogTitle>{editorDialog.title}</DialogTitle>
              {editorDialog.description ? (
                <DialogDescription>{editorDialog.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="space-y-6">{editorDialog.content}</div>
          </DialogContent>
        ) : null}
      </Dialog>
    </ProfileCompletionProvider>
  );
}
