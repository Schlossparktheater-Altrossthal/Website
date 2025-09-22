"use client";

import { useCallback, useState } from "react";
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
import type { ProfileChecklistItem, ProfileChecklistTarget } from "@/lib/profile-completion";
import type { AvatarSource } from "@/components/user-avatar";
import type { PhotoConsentSummary } from "@/types/photo-consent";
import type {
  DietaryStrictnessOption,
  DietaryStyleOption,
} from "@/data/dietary-preferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ROLE_BADGE_VARIANTS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/roles";
import {
  CheckCircle2,
  ChevronDown,
  Crown,
  Gavel,
  PiggyBank,
  ShieldCheck,
  UsersRound,
  VenetianMask,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

type ProfileSectionId = ProfileChecklistTarget | "interessen";

interface ProfileSectionProps {
  id: ProfileSectionId;
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function ProfileSection({
  id,
  title,
  description,
  open,
  onOpenChange,
  children,
}: ProfileSectionProps) {
  const sectionDomId = `profile-section-${id}`;
  const titleId = `${sectionDomId}-title`;
  const contentId = `${sectionDomId}-content`;

  return (
    <section
      id={sectionDomId}
      aria-labelledby={titleId}
      className="group relative rounded-3xl border border-border/60 bg-background/90 shadow-lg shadow-primary/10 transition focus:outline-none"
      tabIndex={-1}
    >
      <div className="flex flex-col gap-4 border-b border-border/60 px-6 pb-5 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div className="space-y-2">
          <h3 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="inline-flex items-center gap-2 self-start rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-expanded={open}
          aria-controls={contentId}
        >
          {open ? "Zuklappen" : "Aufklappen"}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      <div
        id={contentId}
        role="region"
        aria-labelledby={titleId}
        hidden={!open}
        className="px-6 pb-6 pt-5 sm:px-7"
      >
        {children}
      </div>
    </section>
  );
}

interface ProfilePageClientProps {
  user: ProfileUserSummary;
  checklist: ProfileChecklistItem[];
  canManageMeasurements: boolean;
  measurements: MeasurementEntry[];
  dietaryPreference: DietaryPreferenceState;
  allergies: AllergyEntry[];
  photoConsent: PhotoConsentSummary | null;
}

function ProfileRolesCard({ roles }: { roles: Role[] }) {
  if (!roles.length) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-background/85 p-6 shadow-lg shadow-primary/10">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Rollen &amp; Berechtigungen</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Dir sind aktuell keine Rollen zugewiesen. Wende dich an die Produktionsleitung, wenn dir Inhalte fehlen.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-background/85 p-0 shadow-lg shadow-primary/10">
      <CardHeader className="space-y-2 px-6 pb-4 pt-6 sm:px-7">
        <CardTitle>Rollen &amp; Berechtigungen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Deine Rollen steuern Sichtbarkeit und Handlungsrechte im Mitgliederportal. Wende dich bei fehlenden Rechten an die Administration.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 sm:px-7">
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
                className="flex gap-3 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm backdrop-blur"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border text-sm",
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
  photoConsent,
}: ProfilePageClientProps) {
  const [openSections, setOpenSections] = useState<Record<ProfileSectionId, boolean>>({
    stammdaten: true,
    ernaehrung: false,
    masse: false,
    interessen: false,
    freigaben: false,
  });
  const [photoSummary, setPhotoSummary] = useState<PhotoConsentSummary | null>(
    photoConsent,
  );

  const handleSectionOpenChange = useCallback(
    (section: ProfileSectionId, open: boolean) => {
      setOpenSections((prev) => ({ ...prev, [section]: open }));
    },
    [],
  );

  const handleNavigateToSection = useCallback(
    (section: ProfileSectionId) => {
      if (section === "masse" && !canManageMeasurements) {
        return;
      }

      setOpenSections((prev) => {
        if (prev[section]) {
          return prev;
        }
        return { ...prev, [section]: true };
      });

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const element = document.getElementById(`profile-section-${section}`);
          if (element instanceof HTMLElement) {
            element.focus({ preventScroll: true });
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            element.classList.add("ring-2", "ring-primary/50");
            window.setTimeout(() => {
              element.classList.remove("ring-2", "ring-primary/50");
            }, 1200);
          }
        });
      }
    },
    [canManageMeasurements],
  );

  const handleManagePhoto = useCallback(() => {
    handleNavigateToSection("freigaben");
  }, [handleNavigateToSection]);

  const handlePhotoSummaryChange = useCallback(
    (summary: PhotoConsentSummary | null) => {
      setPhotoSummary(summary);
    },
    [],
  );

  return (
    <ProfileCompletionProvider initialItems={checklist}>
      <div className="relative space-y-10 sm:space-y-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl dark:bg-secondary/20"
        />
        <section className="rounded-3xl border border-border/60 bg-background/90 px-6 py-8 shadow-lg shadow-primary/10 sm:px-8">
          <PageHeader
            title="Mein Profil"
            description="Halte deine Angaben aktuell, damit Teams und Kolleg:innen optimal planen können."
          />
          <div className="mt-6">
            <ProfilePhotoConsentNotice
              summary={photoSummary}
              onManage={handleManagePhoto}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] 2xl:gap-12">
          <div className="space-y-6 xl:space-y-8">
            <ProfileSummaryCard
              userId={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              name={user.name}
              email={user.email}
              roles={user.roles}
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />

            <ProfileRolesCard roles={user.roles} />

            <ProfileChecklistCard onNavigateToSection={handleNavigateToSection} />
          </div>

          <div className="space-y-10 xl:space-y-12">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Wichtigste Angaben
              </p>
              <ProfileSection
                id="stammdaten"
                title="Stammdaten &amp; Zugang"
                description="Aktualisiere Namen, Kontaktadresse und Login-Daten."
                open={openSections.stammdaten}
                onOpenChange={(open) => handleSectionOpenChange("stammdaten", open)}
              >
                <ProfileForm
                  userId={user.id}
                  initialFirstName={user.firstName}
                  initialLastName={user.lastName}
                  initialName={user.name}
                  initialEmail={user.email}
                  initialAvatarSource={toAvatarSource(user.avatarSource)}
                  initialAvatarUpdatedAt={user.avatarUpdatedAt}
                  initialDateOfBirth={user.dateOfBirth}
                />
              </ProfileSection>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Weitere Bereiche
              </p>
              <div className="space-y-6 xl:space-y-8">
                <ProfileSection
                  id="ernaehrung"
                  title="Ernährung &amp; Allergien"
                  description="Hilft bei der Planung von Verpflegung und Events."
                  open={openSections.ernaehrung}
                  onOpenChange={(open) => handleSectionOpenChange("ernaehrung", open)}
                >
                  <ProfileDietaryPreferences
                    initialPreference={dietaryPreference}
                    initialAllergies={allergies}
                  />
                </ProfileSection>

                {canManageMeasurements ? (
                  <ProfileSection
                    id="masse"
                    title="Maße &amp; Kostümplanung"
                    description="Teile deine Körpermaße mit dem Kostüm-Team."
                    open={openSections.masse}
                    onOpenChange={(open) => handleSectionOpenChange("masse", open)}
                  >
                    <MemberMeasurementsManager initialMeasurements={measurements} />
                  </ProfileSection>
                ) : null}

                <ProfileSection
                  id="interessen"
                  title="Interessen &amp; Engagement"
                  description="Zeige, wo du dich einbringen oder unterstützen möchtest."
                  open={openSections.interessen}
                  onOpenChange={(open) => handleSectionOpenChange("interessen", open)}
                >
                  <ProfileInterestsCard />
                </ProfileSection>

                <ProfileSection
                  id="freigaben"
                  title="Freigaben &amp; Fotoeinverständnis"
                  description="Verwalte Zustimmungen für Medienarbeit und Teamkommunikation."
                  open={openSections.freigaben}
                  onOpenChange={(open) => handleSectionOpenChange("freigaben", open)}
                >
                  <PhotoConsentCard onSummaryChange={handlePhotoSummaryChange} />
                </ProfileSection>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProfileCompletionProvider>
  );
}
