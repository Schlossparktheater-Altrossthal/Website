"use client";

import { useCallback, useState } from "react";
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
import type { ProfileChecklistItem } from "@/lib/profile-completion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState("stammdaten");
  const [photoSummary, setPhotoSummary] = useState<PhotoConsentSummary | null>(
    photoConsent,
  );

  const handleNavigateToTab = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleManagePhoto = useCallback(() => {
    setActiveTab("freigaben");
  }, []);

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

            <ProfileChecklistCard onNavigateToTab={handleNavigateToTab} />
          </div>

          <div className="space-y-6 xl:space-y-8">
            <div className="rounded-3xl border border-border/60 bg-background/90 p-6 shadow-lg shadow-primary/10 sm:p-7">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
                  <TabsTrigger value="ernaehrung">Ernährung</TabsTrigger>
                  {canManageMeasurements ? (
                    <TabsTrigger value="masse">Maße</TabsTrigger>
                  ) : null}
                  <TabsTrigger value="interessen">Interessen</TabsTrigger>
                  <TabsTrigger value="freigaben">Freigaben</TabsTrigger>
                </TabsList>

                <TabsContent value="stammdaten" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="ernaehrung">
                  <ProfileDietaryPreferences
                    initialPreference={dietaryPreference}
                    initialAllergies={allergies}
                  />
                </TabsContent>

                {canManageMeasurements ? (
                  <TabsContent value="masse">
                    <MemberMeasurementsManager initialMeasurements={measurements} />
                  </TabsContent>
                ) : null}

                <TabsContent value="interessen">
                  <ProfileInterestsCard />
                </TabsContent>

                <TabsContent value="freigaben">
                  <PhotoConsentCard onSummaryChange={handlePhotoSummaryChange} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </ProfileCompletionProvider>
  );
}
