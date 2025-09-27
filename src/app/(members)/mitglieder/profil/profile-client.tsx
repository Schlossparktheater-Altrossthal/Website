"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Loader2,
  Mail,
  Pencil,
  Plus,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import { MeasurementForm } from "@/components/forms/measurement-form";
import type { MeasurementFormData } from "@/data/measurements";
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  sortMeasurements,
  type MeasurementType,
  type MeasurementUnit,
} from "@/data/measurements";
import {
  DEFAULT_STRICTNESS_FOR_NONE,
  DIETARY_STRICTNESS_OPTIONS,
  DIETARY_STYLE_OPTIONS,
  NONE_STRICTNESS_LABEL,
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
} from "@/data/dietary-preferences";
import { BACKGROUND_TAGS, findMatchingBackgroundTag, normalizeBackgroundLabel } from "@/data/onboarding-backgrounds";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { UserAvatar } from "@/components/user-avatar";
import {
  buildProfileChecklist,
  type ProfileChecklistTarget,
  type ProfileCompletionSummary,
} from "@/lib/profile-completion";
import { getUserDisplayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { PhotoConsentSummary } from "@/types/photo-consent";
import { AllergyLevel, type OnboardingFocus, type Role } from "@prisma/client";

import {
  deleteAllergyAction,
  saveDietaryPreferenceAction,
  saveInterestsAction,
  saveMeasurementAction,
  saveOnboardingAction,
  updateProfileBasicsAction,
  upsertAllergyAction,
} from "./actions";
import { ProfileCompletionProvider, useProfileCompletion } from "./profile-completion-context";

const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const CURRENT_YEAR = new Date().getFullYear();
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const ONBOARDING_FOCUS_LABELS: Record<OnboardingFocus, string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return dateFormatter.format(date);
}

type ProfileClientProps = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    createdAt: string;
    dateOfBirth: string | null;
    avatarSource: string | null;
    avatarUpdatedAt: string | null;
    roles: Role[];
    customRoles: { id: string; name: string }[];
  };
  onboarding: {
    focus: string;
    background: string | null;
    backgroundClass: string | null;
    notes: string | null;
    memberSinceYear: number | null;
    dietaryPreference: string | null;
    dietaryPreferenceStrictness: string | null;
    whatsappLinkVisitedAt: string | null;
    updatedAt: string | null;
    show: { title: string | null; year: number } | null;
  } | null;
  interests: string[];
  allergies: Array<{
    id: string;
    allergen: string;
    level: string;
    symptoms: string | null;
    treatment: string | null;
    note: string | null;
    updatedAt: string | null;
  }>;
  measurements: Array<{
    id: string;
    type: string;
    value: number;
    unit: string;
    note: string | null;
    updatedAt: string | null;
  }>;
  canManageMeasurements: boolean;
  checklist: ProfileCompletionSummary;
  whatsappLink: string | null;
};

type ProfileUser = ProfileClientProps["user"];
type Allergy = ProfileClientProps["allergies"][number];
type Measurement = Omit<ProfileClientProps["measurements"][number], "type" | "unit"> & {
  type: MeasurementType;
  unit: MeasurementUnit;
};
type OnboardingProfile = NonNullable<ProfileClientProps["onboarding"]>;

type BasicsFormState = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
  avatarSource: "GRAVATAR" | "UPLOAD" | "INITIALS";
  removeAvatar: boolean;
};

type DietaryFormState = {
  style: DietaryStyleOption;
  customLabel: string;
  strictness: DietaryStrictnessOption;
};

type AllergyFormState = {
  allergen: string;
  level: AllergyLevel;
  symptoms: string;
  treatment: string;
  note: string;
};

type InterestsState = {
  items: string[];
  dirty: boolean;
};

type OnboardingFormState = {
  focus: OnboardingFocus;
  background: string;
  backgroundClass: string;
  notes: string;
  memberSinceYear: string;
};

type ChecklistState = {
  hasBasicData: boolean;
  hasBirthdate: boolean;
  hasDietaryPreference: boolean;
  hasMeasurements?: boolean;
  photoConsentGiven?: boolean;
};

type HighlightTileConfig = {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  hint?: string | null;
  tone?: "default" | "info" | "success" | "warning";
  action?: ReactNode;
};

const basicsSchema = z
  .object({
    firstName: z.string().trim().min(1, "Vorname darf nicht leer sein").max(80),
    lastName: z.string().trim().max(80).optional(),
    displayName: z.string().trim().min(1, "Anzeigename darf nicht leer sein").max(160),
    email: z.string().trim().email("Ungültige E-Mail-Adresse"),
    dateOfBirth: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => {
          if (!value) return true;
          const parsed = new Date(value);
          if (Number.isNaN(parsed.valueOf())) return false;
          return parsed <= new Date();
        },
        { message: "Bitte gib ein gültiges Datum in der Vergangenheit an." },
      ),
    password: z.string().optional(),
    confirmPassword: z.string(),
    avatarSource: z.enum(["GRAVATAR", "UPLOAD", "INITIALS"]),
    removeAvatar: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.password && data.password.length > 0 && data.password.length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwort muss mindestens 6 Zeichen haben", path: ["password"] });
    }
    if (data.password && data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwörter stimmen nicht überein", path: ["confirmPassword"] });
    }
  });

const allergySchema = z.object({
  allergen: z.string().trim().min(2, "Bitte gib ein Allergen an").max(160),
  level: z.nativeEnum(AllergyLevel),
  symptoms: z.string().trim().max(500).optional(),
  treatment: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

const onboardingSchema = z.object({
  focus: z.enum(["acting", "tech", "both"] satisfies OnboardingFocus[]),
  background: z
    .string()
    .trim()
    .min(1, "Bitte beschreibe deinen schulischen oder beruflichen Hintergrund.")
    .max(200, "Bitte nutze maximal 200 Zeichen."),
  backgroundClass: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  memberSinceYear: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return false;
        return parsed >= 1900 && parsed <= CURRENT_YEAR;
      },
      { message: `Bitte gib ein Jahr zwischen 1900 und ${CURRENT_YEAR} an.` },
    ),
});

const interestSchema = z
  .string()
  .trim()
  .min(2, "Interesse ist zu kurz")
  .max(80, "Interesse ist zu lang");

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return dateFormatter.format(parsed);
}

export function ProfileClient({
  user,
  onboarding,
  interests,
  allergies,
  measurements,
  canManageMeasurements,
  checklist,
  whatsappLink,
}: ProfileClientProps) {
  return (
    <ProfileCompletionProvider initialSummary={checklist}>
      <ProfileClientInner
        initialUser={user}
        initialOnboarding={onboarding}
        initialInterests={interests}
        initialAllergies={allergies}
        initialMeasurements={measurements}
        canManageMeasurements={canManageMeasurements}
        whatsappLink={whatsappLink}
      />
    </ProfileCompletionProvider>
  );
}

type ProfileClientInnerProps = {
  initialUser: ProfileUser;
  initialOnboarding: ProfileClientProps["onboarding"];
  initialInterests: string[];
  initialAllergies: ProfileClientProps["allergies"];
  initialMeasurements: ProfileClientProps["measurements"];
  canManageMeasurements: boolean;
  whatsappLink: string | null;
};

function ProfileClientInner({
  initialUser,
  initialOnboarding,
  initialInterests,
  initialAllergies,
  initialMeasurements,
  canManageMeasurements,
  whatsappLink,
}: ProfileClientInnerProps) {
  const { summary, replaceSummary } = useProfileCompletion();
  const { update: refreshSession } = useSession();

  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [onboarding, setOnboarding] = useState<ProfileClientProps["onboarding"]>(initialOnboarding);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [allergies, setAllergies] = useState<Allergy[]>(initialAllergies);
  const [measurements, setMeasurements] = useState<Measurement[]>(() =>
    initialMeasurements.map((entry) => ({
      ...entry,
      type: entry.type as MeasurementType,
      unit: entry.unit as MeasurementUnit,
    })),
  );
  const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [activeTab, setActiveTab] = useState<string>("stammdaten");

  const [, setChecklistState] = useState<ChecklistState>(() => ({
    hasBasicData: Boolean(initialUser.firstName?.trim() && initialUser.email?.trim()),
    hasBirthdate: Boolean(initialUser.dateOfBirth),
    hasDietaryPreference: Boolean(initialOnboarding?.dietaryPreference?.trim()),
    hasMeasurements: canManageMeasurements ? initialMeasurements.length > 0 : undefined,
    photoConsentGiven: summary.items.find((item) => item.id === "photo-consent")?.complete ?? undefined,
  }));

  const buildSummaryFromState = useCallback(
    (state: ChecklistState) =>
      buildProfileChecklist({
        hasBasicData: state.hasBasicData,
        hasBirthdate: state.hasBirthdate,
        hasDietaryPreference: state.hasDietaryPreference,
        hasMeasurements: canManageMeasurements ? Boolean(state.hasMeasurements) : undefined,
        photoConsent:
          state.photoConsentGiven === undefined
            ? undefined
            : { consentGiven: Boolean(state.photoConsentGiven) },
      }),
    [canManageMeasurements],
  );

  const updateChecklist = useCallback(
    (patch: Partial<ChecklistState> = {}) => {
      setChecklistState((prev) => {
        const next = { ...prev, ...patch };
        const nextSummary = buildSummaryFromState(next);
        replaceSummary(nextSummary);
        return next;
      });
    },
    [buildSummaryFromState, replaceSummary],
  );

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
  }, [createdAtLabel, onboarding?.memberSinceYear]);

  const onboardingFocusLabel = useMemo(() => {
    if (!onboarding?.focus) return null;
    return ONBOARDING_FOCUS_LABELS[onboarding.focus as OnboardingFocus] ?? null;
  }, [onboarding?.focus]);

  const onboardingBackground = onboarding?.background ?? null;
  const onboardingNotes = onboarding?.notes ?? null;

  const whatsappVisitedAt = onboarding?.whatsappLinkVisitedAt ?? null;
  const whatsappVisitedAtLabel = useMemo(
    () => formatDateLabel(whatsappVisitedAt),
    [whatsappVisitedAt],
  );

  const percentComplete = summary.total
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  const handleUserUpdated = useCallback(
    async (nextUser: ProfileUser) => {
      setUser(nextUser);
      const basicsComplete = Boolean(nextUser.firstName?.trim() && nextUser.email?.trim());
      updateChecklist({
        hasBasicData: basicsComplete,
        hasBirthdate: Boolean(nextUser.dateOfBirth),
      });
      try {
        await refreshSession?.();
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
            show: null,
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

  const handleMeasurementsUpdated = useCallback(
    (nextMeasurements: Measurement[]) => {
      setMeasurements(nextMeasurements);
      if (canManageMeasurements) {
        updateChecklist({ hasMeasurements: nextMeasurements.length > 0 });
      }
    },
    [canManageMeasurements, updateChecklist],
  );

  const handlePhotoConsentSummary = useCallback(
    (nextSummary: PhotoConsentSummary | null) => {
      if (!hasPhotoConsentChecklist) {
        return;
      }
      updateChecklist({ photoConsentGiven: Boolean(nextSummary && nextSummary.status === "approved") });
    },
    [hasPhotoConsentChecklist, updateChecklist],
  );

  const dietaryPreference = useMemo(
    () => ({
      label: onboarding?.dietaryPreference ?? null,
      strictnessLabel: onboarding?.dietaryPreferenceStrictness ?? null,
    }),
    [onboarding?.dietaryPreference, onboarding?.dietaryPreferenceStrictness],
  );

  const highlightTiles = useMemo<HighlightTileConfig[]>(() => {
    const items: HighlightTileConfig[] = [
      {
        id: "membership",
        icon: <CalendarDays className="h-5 w-5" aria-hidden />,
        title: "Mitgliedschaft",
        description: memberSinceLabel ?? "Trage dein Eintrittsjahr im Onboarding ein.",
        hint: createdAtLabel ? `Profil erstellt am ${createdAtLabel}.` : null,
        tone: memberSinceLabel ? "default" : "warning",
      },
      {
        id: "onboarding-focus",
        icon: <Sparkles className="h-5 w-5" aria-hidden />,
        title: "Onboarding-Schwerpunkt",
        description: onboardingFocusLabel ?? "Kein Schwerpunkt hinterlegt.",
        hint: onboardingBackground ?? onboardingNotes,
        tone: onboardingFocusLabel ? "info" : "warning",
      },
    ];

    if (whatsappLink) {
      items.push({
        id: "whatsapp",
        icon: <MessageCircle className="h-5 w-5" aria-hidden />,
        title: "Team-Chat",
        description: whatsappVisitedAtLabel
          ? `Bereits geöffnet am ${whatsappVisitedAtLabel}.`
          : "Öffne den WhatsApp-Infokanal für aktuelle Updates.",
        hint: whatsappVisitedAtLabel ? null : "Der Link öffnet sich in einem neuen Tab.",
        tone: whatsappVisitedAt ? "success" : "info",
        action: (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-2 w-full justify-between rounded-full border-border/70 text-sm font-semibold"
          >
            <a href={whatsappLink} target="_blank" rel="noreferrer">
              <span>{whatsappVisitedAt ? "Erneut öffnen" : "Chat öffnen"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        ),
      });
    }

    return items;
  }, [
    createdAtLabel,
    memberSinceLabel,
    onboardingBackground,
    onboardingFocusLabel,
    onboardingNotes,
    whatsappLink,
    whatsappVisitedAt,
    whatsappVisitedAtLabel,
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <ProfileOverviewCard
          user={user}
          displayName={displayName}
          sortedRoles={sortedRoles}
          summary={summary}
          onboarding={onboarding}
          createdAtLabel={createdAtLabel}
          memberSinceLabel={memberSinceLabel}
          percentComplete={percentComplete}
        />
        <div className="space-y-4">
          <ChecklistCard summary={summary} onNavigate={setActiveTab} />
          {highlightTiles.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {highlightTiles.map((tile) => (
                <ProfileHighlightTile key={tile.id} {...tile} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex w-full flex-wrap gap-2 rounded-full border border-border/70 bg-background/70 p-1 shadow-inner ring-1 ring-primary/10 backdrop-blur">
          <TabsTrigger value="stammdaten" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            Stammdaten
          </TabsTrigger>
          <TabsTrigger value="ernaehrung" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            Ernährung &amp; Allergien
          </TabsTrigger>
          {canManageMeasurements ? (
            <TabsTrigger value="masse" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
              Maße
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="interessen" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            Interessen
          </TabsTrigger>
          <TabsTrigger value="freigaben" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            Freigaben
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            Onboarding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten" className="space-y-6">
          <BasicsSection user={user} onUserUpdated={handleUserUpdated} />
        </TabsContent>

        <TabsContent value="ernaehrung" className="space-y-6">
          <NutritionSection
            onboarding={onboarding}
            allergies={allergies}
            onAllergiesChange={setAllergies}
            onDietaryUpdated={handleDietaryUpdated}
          />
        </TabsContent>

        {canManageMeasurements ? (
          <TabsContent value="masse" className="space-y-6">
            <MeasurementsSection
              measurements={measurements}
              onMeasurementsChange={handleMeasurementsUpdated}
              dialogOpen={measurementDialogOpen}
              onDialogOpenChange={setMeasurementDialogOpen}
              editingMeasurement={editingMeasurement}
              onEditingChange={setEditingMeasurement}
            />
          </TabsContent>
        ) : null}

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
            whatsappLink={whatsappLink}
            whatsappVisitedAt={whatsappVisitedAt}
            dietaryPreference={dietaryPreference}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ProfileOverviewCardProps = {
  user: ProfileUser;
  displayName: string;
  sortedRoles: Role[];
  summary: ProfileCompletionSummary;
  onboarding: ProfileClientProps["onboarding"];
  createdAtLabel: string | null;
  memberSinceLabel: string | null;
  percentComplete: number;
};

function ProfileOverviewCard({
  user,
  displayName,
  sortedRoles,
  summary,
  onboarding,
  createdAtLabel,
  memberSinceLabel,
  percentComplete,
}: ProfileOverviewCardProps) {
  const email = user.email?.trim() ?? "";
  const show = onboarding?.show ?? null;
  const checklistBadgeLabel = summary.total
    ? summary.complete
      ? "Profil vollständig"
      : `${percentComplete}% vollständig`
    : null;
  const checklistCountLabel = summary.total ? `${summary.completed}/${summary.total}` : null;

  return (
    <Card className="border border-border/70 bg-gradient-to-br from-background/85 via-background/70 to-background/80 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              userId={user.id}
              email={user.email}
              firstName={user.firstName}
              lastName={user.lastName}
              name={displayName}
              size={80}
              className="h-20 w-20 border border-border/70 text-xl shadow-sm"
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold leading-tight text-foreground">{displayName}</CardTitle>
                {checklistBadgeLabel ? (
                  <Badge
                    variant={summary.complete ? "secondary" : "outline"}
                    className={cn(
                      "gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                      summary.complete
                        ? "border-success/60 bg-success/10 text-success"
                        : "border-primary/50 bg-primary/10 text-primary",
                    )}
                  >
                    {checklistBadgeLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-2 font-medium text-foreground transition hover:text-primary"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {email}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground/80">
                    <Mail className="h-4 w-4" aria-hidden />
                    Keine E-Mail hinterlegt
                  </span>
                )}
                {memberSinceLabel || createdAtLabel ? (
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    {memberSinceLabel ?? (createdAtLabel ? `Profil seit ${createdAtLabel}` : "")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {sortedRoles.map((role) => (
            <Badge
              key={role}
              variant="outline"
              className="rounded-full border-border/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide"
            >
              {role}
            </Badge>
          ))}
          {user.customRoles.map((role) => (
            <Badge
              key={role.id}
              variant="secondary"
              className="rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide"
            >
              {role.name}
            </Badge>
          ))}
        </div>
        {summary.total ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Profilstatus</span>
              <span>{checklistCountLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted/50">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  summary.complete
                    ? "bg-gradient-to-r from-success/80 via-success/70 to-success/90"
                    : "bg-gradient-to-r from-primary/80 via-primary/70 to-primary/90",
                )}
                style={{ width: `${Math.min(100, Math.max(0, percentComplete))}%` }}
              />
            </div>
          </div>
        ) : null}
        {show ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 p-3 text-xs text-muted-foreground">
            <Users className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>
              Produktion: {show.title ? `${show.title} (${show.year})` : show.year}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ChecklistCardProps = {
  summary: ProfileCompletionSummary;
  onNavigate: (target: ProfileChecklistTarget) => void;
};

function ChecklistCard({ summary, onNavigate }: ChecklistCardProps) {
  const percent = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const hasItems = summary.items.length > 0;

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold text-foreground">
          <span>Profil-Checkliste</span>
          {summary.total ? (
            <span className="text-xs font-medium text-muted-foreground">{summary.completed}/{summary.total}</span>
          ) : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Halte deine Stammdaten, Ernährungspräferenzen und Freigaben aktuell.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.total ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Fortschritt</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  summary.complete
                    ? "bg-gradient-to-r from-success/80 via-success/70 to-success/90"
                    : "bg-gradient-to-r from-primary/70 via-primary/80 to-primary/90",
                )}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
          </div>
        ) : null}

        {hasItems ? (
          <ul className="space-y-3">
            {summary.items.map((item) => {
              const Icon = item.complete ? CheckCircle2 : AlertTriangle;
              const iconClasses = item.complete ? "text-success" : "text-warning";

              return (
                <li key={item.id} className="rounded-lg border border-border/50 bg-background/80 p-3 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-1 gap-3">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClasses)} aria-hidden />
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{item.label}</div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    {item.targetSection ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start rounded-full border-border/60 text-xs font-semibold uppercase tracking-wide"
                        onClick={() => {
                          if (item.targetSection) {
                            onNavigate(item.targetSection);
                          }
                        }}
                      >
                        Bereich öffnen
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-border/50 bg-background/70 p-4 text-sm text-muted-foreground">
            Checkliste wird vorbereitet …
          </div>
        )}

        {summary.complete && hasItems ? (
          <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs font-medium text-success">
            Stark! Alle Checkpunkte sind erledigt.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ProfileHighlightTileProps = Omit<HighlightTileConfig, "id">;

function ProfileHighlightTile({
  icon,
  title,
  description,
  hint,
  tone = "default",
  action,
}: ProfileHighlightTileProps) {
  const toneClasses: Record<NonNullable<ProfileHighlightTileProps["tone"]>, string> = {
    default: "border-border/60 bg-background/70",
    info: "border-primary/30 bg-primary/10",
    success: "border-success/40 bg-success/10",
    warning: "border-warning/45 bg-warning/10",
  };

  return (
    <div className={cn("flex h-full flex-col gap-3 rounded-lg border p-4 shadow-sm", toneClasses[tone])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {hint ? <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground/70">{hint}</p> : null}
      {action ? <div className="mt-auto">{action}</div> : null}
    </div>
  );
}

type BasicsSectionProps = {
  user: ProfileUser;
  onUserUpdated: (nextUser: ProfileUser) => Promise<void> | void;
};

function BasicsSection({ user, onUserUpdated }: BasicsSectionProps) {
  const [formState, setFormState] = useState<BasicsFormState>(() => ({
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    email: user.email,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    password: "",
    confirmPassword: "",
    avatarSource:
      user.avatarSource === "GRAVATAR" || user.avatarSource === "UPLOAD" || user.avatarSource === "INITIALS"
        ? (user.avatarSource as BasicsFormState["avatarSource"])
        : "INITIALS",
    removeAvatar: false,
  }));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
      avatarSource:
        user.avatarSource === "GRAVATAR" || user.avatarSource === "UPLOAD" || user.avatarSource === "INITIALS"
          ? (user.avatarSource as BasicsFormState["avatarSource"])
          : prev.avatarSource,
    }));
  }, [user.firstName, user.lastName, user.displayName, user.email, user.dateOfBirth, user.avatarSource]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarSourceChange = (value: BasicsFormState["avatarSource"]) => {
    setFormState((prev) => ({ ...prev, avatarSource: value, removeAvatar: false }));
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
      toast.error("Nur JPG, PNG oder WebP werden unterstützt.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Bitte nutze ein Bild bis maximal 2 MB.");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
    setFormState((prev) => ({ ...prev, avatarSource: "UPLOAD", removeAvatar: false }));
  };

  const resetPasswordFields = () => {
    setFormState((prev) => ({ ...prev, password: "", confirmPassword: "" }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parseResult = basicsSchema.safeParse({
      ...formState,
      lastName: formState.lastName,
      password: formState.password || undefined,
      confirmPassword: formState.confirmPassword,
    });

    if (!parseResult.success) {
      const issues = parseResult.error.flatten();
      const fieldIssueEntries = Object.entries(issues.fieldErrors).filter(([, messages]) => messages && messages.length > 0);
      if (fieldIssueEntries.length > 0) {
        setFieldErrors(Object.fromEntries(fieldIssueEntries.map(([key, messages]) => [key, messages![0]])));
      }
      if (issues.formErrors.length) {
        setError(issues.formErrors[0]);
      }
      return;
    }

    const data = parseResult.data;
    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName ?? "");
    formData.append("name", data.displayName);
    formData.append("email", data.email);
    if (data.dateOfBirth) {
      formData.append("dateOfBirth", data.dateOfBirth);
    } else {
      formData.append("dateOfBirth", "");
    }
    if (data.password) {
      formData.append("password", data.password);
    }
    formData.append("avatarSource", data.avatarSource);
    if (data.removeAvatar) {
      formData.append("removeAvatar", "1");
    }
    if (avatarFile) {
      formData.append("avatarFile", avatarFile);
    }

    setSubmitting(true);
    try {
      const result = await updateProfileBasicsAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.user;
      const nextUser: ProfileUser = {
        ...user,
        firstName: payload.firstName ?? "",
        lastName: payload.lastName ?? "",
        displayName:
          payload.name && payload.name.trim().length > 0
            ? payload.name
            : getUserDisplayName(
                {
                  firstName: payload.firstName,
                  lastName: payload.lastName,
                  name: payload.name,
                  email: payload.email,
                },
                payload.email,
              ),
        email: payload.email,
        dateOfBirth: payload.dateOfBirth,
        avatarSource: payload.avatarSource,
        avatarUpdatedAt: payload.avatarUpdatedAt,
      };

      await onUserUpdated(nextUser);
      resetPasswordFields();
      setAvatarFile(null);
      setFormState((prev) => ({ ...prev, removeAvatar: false }));
      toast.success("Stammdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Stammdaten &amp; Zugang</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formState.firstName}
                onChange={handleInputChange}
                autoComplete="given-name"
              />
              {fieldErrors.firstName ? <p className="text-sm text-destructive">{fieldErrors.firstName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input id="lastName" name="lastName" value={formState.lastName} onChange={handleInputChange} autoComplete="family-name" />
              {fieldErrors.lastName ? <p className="text-sm text-destructive">{fieldErrors.lastName}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Anzeigename</Label>
              <Input id="displayName" name="displayName" value={formState.displayName} onChange={handleInputChange} />
              {fieldErrors.displayName ? <p className="text-sm text-destructive">{fieldErrors.displayName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" value={formState.email} onChange={handleInputChange} autoComplete="email" />
              {fieldErrors.email ? <p className="text-sm text-destructive">{fieldErrors.email}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Geburtsdatum</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" value={formState.dateOfBirth} onChange={handleInputChange} />
              {fieldErrors.dateOfBirth ? <p className="text-sm text-destructive">{fieldErrors.dateOfBirth}</p> : null}
              <p className="text-xs text-muted-foreground">Benötigt für Fotoeinverständnis und Altersfreigaben.</p>
            </div>
            <div className="space-y-2">
              <Label>Avatar-Quelle</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "INITIALS", label: "Initialen" },
                  { value: "GRAVATAR", label: "Gravatar" },
                  { value: "UPLOAD", label: "Eigenes Bild" },
                ] satisfies Array<{ value: BasicsFormState["avatarSource"]; label: string }>).map((option) => {
                  const active = formState.avatarSource === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAvatarSourceChange(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {formState.avatarSource === "GRAVATAR" ? (
                <p className="text-xs text-muted-foreground">
                  Wir nutzen den Gravatar zu deiner E-Mail-Adresse. Stelle sicher, dass dort ein Bild hinterlegt ist.
                </p>
              ) : null}
              {formState.avatarSource === "UPLOAD" ? (
                <div className="space-y-2 pt-2">
                  <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFileChange} />
                  <p className="text-xs text-muted-foreground">PNG, JPG oder WebP bis 2 MB.</p>
                  {avatarPreviewUrl ? (
                    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                      <UserAvatar name={user.displayName} size={48} className="h-12 w-12" previewUrl={avatarPreviewUrl} />
                      <span className="text-xs text-muted-foreground">Vorschau des neuen Avatars</span>
                    </div>
                  ) : null}
                  {user.avatarSource === "UPLOAD" && !avatarFile ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline transition hover:text-foreground"
                      onClick={() => setFormState((prev) => ({ ...prev, removeAvatar: !prev.removeAvatar }))}
                    >
                      {formState.removeAvatar ? "Eigenes Bild behalten" : "Eigenes Bild entfernen"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Passwort zurücksetzen</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="password"
                type="password"
                value={formState.password}
                onChange={handleInputChange}
                placeholder="Neues Passwort"
                autoComplete="new-password"
              />
              <Input
                name="confirmPassword"
                type="password"
                value={formState.confirmPassword}
                onChange={handleInputChange}
                placeholder="Bestätigung"
                autoComplete="new-password"
              />
            </div>
            {(fieldErrors.password || fieldErrors.confirmPassword) && (
              <p className="text-sm text-destructive">{fieldErrors.password ?? fieldErrors.confirmPassword}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Lasse die Felder leer, wenn das Passwort unverändert bleiben soll.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Änderungen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type NutritionSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  allergies: Allergy[];
  onAllergiesChange: (next: Allergy[]) => void;
  onDietaryUpdated: (preference: { label: string | null; strictnessLabel: string | null }) => void;
};

function NutritionSection({ onboarding, allergies, onAllergiesChange, onDietaryUpdated }: NutritionSectionProps) {
  const initialDietary = useMemo(() => {
    const { style, customLabel } = parseDietaryStyleFromLabel(onboarding?.dietaryPreference ?? null);
    const strictness = parseDietaryStrictnessFromLabel(onboarding?.dietaryPreferenceStrictness ?? null);
    return { style, customLabel: customLabel ?? "", strictness } satisfies DietaryFormState;
  }, [onboarding?.dietaryPreference, onboarding?.dietaryPreferenceStrictness]);

  const [dietaryState, setDietaryState] = useState<DietaryFormState>(initialDietary);
  const [dietaryError, setDietaryError] = useState<string | null>(null);
  const [dietarySubmitting, setDietarySubmitting] = useState(false);

  const [allergyState, setAllergyState] = useState<AllergyFormState>({
    allergen: "",
    level: (allergies[0]?.level as AllergyLevel | undefined) ?? AllergyLevel.MILD,
    symptoms: "",
    treatment: "",
    note: "",
  });
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const [allergySubmitting, setAllergySubmitting] = useState(false);

  useEffect(() => {
    setDietaryState(initialDietary);
  }, [initialDietary]);

  const handleDietarySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDietaryError(null);

    const style = dietaryState.style;
    const strictness = style === "omnivore" || style === "none" ? DEFAULT_STRICTNESS_FOR_NONE : dietaryState.strictness;
    const customLabel = dietaryState.customLabel.trim();
    if (style === "custom" && !customLabel) {
      setDietaryError("Bitte gib eine Bezeichnung für deinen individuellen Ernährungsstil an.");
      return;
    }

    setDietarySubmitting(true);
    try {
      const result = await saveDietaryPreferenceAction({
        style,
        strictness,
        customLabel: style === "custom" ? customLabel : undefined,
      });
      if (!result.ok) {
        setDietaryError(result.error);
        toast.error(result.error);
        return;
      }
      const preference = result.data.preference;
      onDietaryUpdated({ label: preference.label, strictnessLabel: preference.strictnessLabel });
      toast.success("Ernährungsprofil gespeichert");
    } finally {
      setDietarySubmitting(false);
    }
  };

  const handleAllergySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAllergyError(null);

    const parseResult = allergySchema.safeParse({
      allergen: allergyState.allergen,
      level: allergyState.level,
      symptoms: allergyState.symptoms || undefined,
      treatment: allergyState.treatment || undefined,
      note: allergyState.note || undefined,
    });

    if (!parseResult.success) {
      setAllergyError(parseResult.error.issues[0]?.message ?? "Ungültige Eingaben");
      return;
    }

    setAllergySubmitting(true);
    try {
      const result = await upsertAllergyAction({
        allergen: parseResult.data.allergen,
        level: parseResult.data.level,
        symptoms: parseResult.data.symptoms ?? null,
        treatment: parseResult.data.treatment ?? null,
        note: parseResult.data.note ?? null,
      });
      if (!result.ok) {
        setAllergyError(result.error);
        toast.error(result.error);
        return;
      }
      const updated = result.data.allergy;
      const nextAllergies = [...allergies];
      const index = nextAllergies.findIndex(
        (entry) => entry.id === updated.id || entry.allergen.toLowerCase() === updated.allergen.toLowerCase(),
      );
      const payload: Allergy = {
        id: updated.id,
        allergen: updated.allergen,
        level: updated.level,
        symptoms: updated.symptoms,
        treatment: updated.treatment,
        note: updated.note,
        updatedAt: updated.updatedAt,
      };
      if (index >= 0) {
        nextAllergies[index] = payload;
      } else {
        nextAllergies.push(payload);
      }
      nextAllergies.sort((a, b) => a.allergen.localeCompare(b.allergen));
      onAllergiesChange(nextAllergies);
      toast.success("Allergie gespeichert");
      setEditingAllergyId(null);
      setAllergyState({ allergen: "", level: AllergyLevel.MILD, symptoms: "", treatment: "", note: "" });
    } finally {
      setAllergySubmitting(false);
    }
  };

  const handleAllergyEdit = (entry: Allergy) => {
    setEditingAllergyId(entry.id);
    setAllergyState({
      allergen: entry.allergen,
      level: entry.level as AllergyLevel,
      symptoms: entry.symptoms ?? "",
      treatment: entry.treatment ?? "",
      note: entry.note ?? "",
    });
  };

  const handleAllergyDelete = async (allergen: string) => {
    setAllergySubmitting(true);
    try {
      const result = await deleteAllergyAction(allergen);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const next = allergies.filter((entry) => entry.allergen !== allergen);
      onAllergiesChange(next);
      toast.success("Allergie entfernt");
      if (editingAllergyId && allergyState.allergen === allergen) {
        setEditingAllergyId(null);
        setAllergyState({ allergen: "", level: AllergyLevel.MILD, symptoms: "", treatment: "", note: "" });
      }
    } finally {
      setAllergySubmitting(false);
    }
  };

  const dietaryDescription = useMemo(() => {
    const { label } = resolveDietaryStyleLabel(dietaryState.style, dietaryState.customLabel || undefined);
    const strictnessLabel = resolveDietaryStrictnessLabel(dietaryState.style, dietaryState.strictness);
    return { label, strictnessLabel };
  }, [dietaryState.customLabel, dietaryState.strictness, dietaryState.style]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ernährungsprofil</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleDietarySubmit}>
            <div className="space-y-2">
              <Label>Stil</Label>
              <Select
                value={dietaryState.style}
                onValueChange={(value) =>
                  setDietaryState((prev) => ({
                    ...prev,
                    style: value as DietaryStyleOption,
                    strictness:
                      value === "omnivore" || value === "none"
                        ? DEFAULT_STRICTNESS_FOR_NONE
                        : prev.strictness,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wähle deinen Stil" />
                </SelectTrigger>
                <SelectContent>
                  {DIETARY_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dietaryState.style === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="customLabel">Bezeichnung</Label>
                <Input
                  id="customLabel"
                  value={dietaryState.customLabel}
                  onChange={(event) => setDietaryState((prev) => ({ ...prev, customLabel: event.target.value }))}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Strengegrad</Label>
              <Select
                value={dietaryState.strictness}
                onValueChange={(value) => setDietaryState((prev) => ({ ...prev, strictness: value as DietaryStrictnessOption }))}
                disabled={dietaryState.style === "omnivore" || dietaryState.style === "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Strengegrad wählen" />
                </SelectTrigger>
                <SelectContent>
                  {DIETARY_STRICTNESS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dietaryState.style === "omnivore" || dietaryState.style === "none" ? (
                <p className="text-xs text-muted-foreground">{NONE_STRICTNESS_LABEL}</p>
              ) : null}
            </div>

            {dietaryError ? <p className="text-sm text-destructive">{dietaryError}</p> : null}

            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">Aktueller Eintrag</p>
                <p className="text-xs text-muted-foreground">
                  {dietaryDescription.label} · {dietaryDescription.strictnessLabel}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={dietarySubmitting}>
                {dietarySubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Speichern…
                  </>
                ) : (
                  "Ernährung speichern"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Allergien &amp; Unverträglichkeiten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleAllergySubmit}>
            <div className="space-y-2">
              <Label htmlFor="allergen">Allergen</Label>
              <Input
                id="allergen"
                value={allergyState.allergen}
                onChange={(event) => setAllergyState((prev) => ({ ...prev, allergen: event.target.value }))}
                placeholder="z.B. Erdnüsse"
              />
            </div>
            <div className="space-y-2">
              <Label>Schweregrad</Label>
              <Select
                value={allergyState.level}
                onValueChange={(value) => setAllergyState((prev) => ({ ...prev, level: value as AllergyLevel }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Schweregrad wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.values(AllergyLevel) as AllergyLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      {getAllergyLevelLabel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="symptoms">Symptome</Label>
              <Textarea
                id="symptoms"
                value={allergyState.symptoms}
                onChange={(event) => setAllergyState((prev) => ({ ...prev, symptoms: event.target.value }))}
                placeholder="Beschreibe die typischen Symptome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment">Behandlung / Hinweise</Label>
              <Textarea
                id="treatment"
                value={allergyState.treatment}
                onChange={(event) => setAllergyState((prev) => ({ ...prev, treatment: event.target.value }))}
                placeholder="Was hilft im Notfall?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Zusätzliche Notiz</Label>
              <Textarea
                id="note"
                value={allergyState.note}
                onChange={(event) => setAllergyState((prev) => ({ ...prev, note: event.target.value }))}
              />
            </div>
            {allergyError ? <p className="text-sm text-destructive">{allergyError}</p> : null}
            <div className="flex justify-end gap-2">
              {editingAllergyId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingAllergyId(null);
        setAllergyState({ allergen: "", level: AllergyLevel.MILD, symptoms: "", treatment: "", note: "" });
                  }}
                >
                  Abbrechen
                </Button>
              ) : null}
              <Button type="submit" disabled={allergySubmitting}>
                {allergySubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Speichern…
                  </>
                ) : editingAllergyId ? (
                  "Allergie aktualisieren"
                ) : (
                  "Allergie hinzufügen"
                )}
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            {allergies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Allergien hinterlegt.</p>
            ) : (
              allergies.map((entry) => {
                const style = ALLERGY_LEVEL_STYLES[entry.level as AllergyLevel] ?? ALLERGY_LEVEL_STYLES.MILD;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border/60 bg-muted/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("border px-2 py-0.5 text-[11px]", style.badge)}>{getAllergyLevelLabel(entry.level as AllergyLevel)}</Badge>
                        <span className="font-medium text-foreground">{entry.allergen}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleAllergyEdit(entry)}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/60 px-2 py-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleAllergyDelete(entry.allergen)}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          Entfernen
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {entry.symptoms ? <p>Symptome: {entry.symptoms}</p> : null}
                      {entry.treatment ? <p>Behandlung: {entry.treatment}</p> : null}
                      {entry.note ? <p>Hinweis: {entry.note}</p> : null}
                      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Aktualisiert am {formatDate(entry.updatedAt) ?? "unbekannt"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getAllergyLevelLabel(level: AllergyLevel): string {
  const labels: Record<AllergyLevel, string> = {
    MILD: "Leicht",
    MODERATE: "Mittel",
    SEVERE: "Schwer",
    LETHAL: "Lebensbedrohlich",
  };
  return labels[level] ?? level;
}

type MeasurementsSectionProps = {
  measurements: Measurement[];
  onMeasurementsChange: (next: Measurement[]) => void;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  editingMeasurement: Measurement | null;
  onEditingChange: (measurement: Measurement | null) => void;
};

function MeasurementsSection({
  measurements,
  onMeasurementsChange,
  dialogOpen,
  onDialogOpenChange,
  editingMeasurement,
  onEditingChange,
}: MeasurementsSectionProps) {
  const sorted = useMemo(() => sortMeasurements(measurements), [measurements]);

  const handleSubmit = async (data: MeasurementFormData) => {
    const result = await saveMeasurementAction({
      type: data.type,
      value: data.value,
      unit: data.unit,
      note: data.note ?? null,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    const payload = result.data.measurement;
    const next: Measurement[] = [...measurements];
    const index = next.findIndex((entry) => entry.type === payload.type);
    const entry: Measurement = {
      id: payload.id,
      type: payload.type as MeasurementType,
      value: payload.value,
      unit: payload.unit as MeasurementUnit,
      note: payload.note,
      updatedAt: payload.updatedAt,
    };
    if (index >= 0) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    onMeasurementsChange(sortMeasurements(next));
    onDialogOpenChange(false);
    onEditingChange(null);
  };

  const handleEdit = (measurement: Measurement) => {
    onEditingChange(measurement);
    onDialogOpenChange(true);
  };

  const handleCreate = () => {
    onEditingChange(null);
    onDialogOpenChange(true);
  };

  return (
    <Card className="border border-border/60">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Maße</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sichtbar für dich und das Kostüm-Team. Bitte halte die Angaben aktuell.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Neues Maß
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Maße erfasst.</p>
        ) : (
          <div className="grid gap-3">
            {sorted.map((measurement) => (
              <div key={measurement.id} className="rounded-lg border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {MEASUREMENT_TYPE_LABELS[measurement.type as MeasurementType] ?? measurement.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {measurement.value} {MEASUREMENT_UNIT_LABELS[measurement.unit as MeasurementUnit] ?? measurement.unit}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(measurement)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Bearbeiten
                  </Button>
                </div>
                {measurement.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{measurement.note}</p>
                ) : null}
                <p className="mt-2 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Aktualisiert am {formatDate(measurement.updatedAt) ?? "unbekannt"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            onEditingChange(null);
          }
          onDialogOpenChange(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMeasurement ? "Maß bearbeiten" : "Neues Maß"}</DialogTitle>
          </DialogHeader>
          <MeasurementForm
            initialData={editingMeasurement ? {
              type: editingMeasurement.type as MeasurementType,
              value: editingMeasurement.value,
              unit: editingMeasurement.unit as MeasurementUnit,
              note: editingMeasurement.note ?? undefined,
            } : undefined}
            disableTypeSelection={Boolean(editingMeasurement)}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type InterestsSectionProps = {
  interests: string[];
  onInterestsChange: (next: string[]) => void;
};

function InterestsSection({ interests, onInterestsChange }: InterestsSectionProps) {
  const [state, setState] = useState<InterestsState>({ items: interests, dirty: false });
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState({ items: interests, dirty: false });
  }, [interests]);

  const addInterest = () => {
    setError(null);
    const parsed = interestSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültiges Interesse");
      return;
    }
    const value = parsed.data;
    if (state.items.length >= MAX_INTERESTS_PER_USER) {
      setError(`Maximal ${MAX_INTERESTS_PER_USER} Interessen erlaubt.`);
      return;
    }
    if (state.items.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      setError("Dieses Interesse ist bereits erfasst.");
      return;
    }
    setState((prev) => ({ items: [...prev.items, value], dirty: true }));
    setInput("");
  };

  const removeInterest = (interest: string) => {
    setState((prev) => ({ items: prev.items.filter((item) => item !== interest), dirty: true }));
  };

  const resetInterests = () => {
    setState({ items: interests, dirty: false });
    setInput("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await saveInterestsAction(state.items);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setState({ items: result.data.interests, dirty: false });
      onInterestsChange(result.data.interests);
      toast.success("Interessen gespeichert");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Interessen</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="interestInput">Neues Interesse</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="interestInput"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addInterest();
                  }
                }}
                placeholder="z.B. Regie, Lichttechnik"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" onClick={addInterest}>
                Hinzufügen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximal {MAX_INTERESTS_PER_USER} Einträge. Du kannst mehrere Begriffe nacheinander hinzufügen.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {state.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Interessen hinterlegt.</p>
            ) : (
              state.items.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs"
                >
                  {interest}
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground transition hover:text-destructive"
                    aria-label={`${interest} entfernen`}
                    onClick={() => removeInterest(interest)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={resetInterests} disabled={!state.dirty}>
              Änderungen verwerfen
            </Button>
            <Button type="submit" disabled={!state.dirty || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Interessen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type OnboardingSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
  whatsappLink: string | null;
  whatsappVisitedAt: string | null;
  dietaryPreference: { label: string | null; strictnessLabel: string | null };
};

function OnboardingSection({
  onboarding,
  onOnboardingChange,
  whatsappLink,
  whatsappVisitedAt,
  dietaryPreference,
}: OnboardingSectionProps) {
  const initialForm = useMemo<OnboardingFormState>(() => ({
    focus: (onboarding?.focus as OnboardingFocus) ?? "acting",
    background: onboarding?.background ?? "",
    backgroundClass: onboarding?.backgroundClass ?? "",
    notes: onboarding?.notes ?? "",
    memberSinceYear: onboarding?.memberSinceYear ? String(onboarding.memberSinceYear) : "",
  }), [onboarding?.background, onboarding?.backgroundClass, onboarding?.focus, onboarding?.memberSinceYear, onboarding?.notes]);

  const [formState, setFormState] = useState<OnboardingFormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backgroundSuggestions, setBackgroundSuggestions] = useState<string[]>(() => ["Schule", "Ausbildung", "Beruf"]);
  const [classSuggestions, setClassSuggestions] = useState<string[]>([]);
  const [whatsappSubmitting, setWhatsappSubmitting] = useState(false);

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  useEffect(() => {
    let cancelled = false;
    const loadBackgrounds = async () => {
      try {
        const response = await fetch("/api/onboarding/backgrounds", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.backgrounds)) return;
        setBackgroundSuggestions((prev) => {
          const seen = new Set(prev.map((entry) => entry.toLowerCase()));
          const merged = [...prev];
          for (const raw of data.backgrounds as unknown[]) {
            let label: string | null = null;
            if (typeof raw === "string") label = raw;
            else if (raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string") {
              label = (raw as { name: string }).name;
            }
            if (!label) continue;
            const trimmed = label.trim();
            if (!trimmed) continue;
            const key = trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(trimmed);
          }
          return merged;
        });
      } catch {
        // ignore optional suggestions errors
      }
    };
    void loadBackgrounds();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTag = useMemo(() => findMatchingBackgroundTag(formState.background), [formState.background]);
  const requiresClass = activeTag?.requiresClass ?? false;

  useEffect(() => {
    if (!requiresClass) {
      setClassSuggestions([]);
      return;
    }
    let cancelled = false;
    const loadClasses = async () => {
      try {
        const response = await fetch("/api/onboarding/background-classes", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.classes)) return;
        const entries = (data.classes as unknown[])
          .map<string | null>((entry: unknown) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
              return (entry as { name: string }).name.trim();
            }
            return null;
          })
          .filter((value): value is string => Boolean(value));
        setClassSuggestions(Array.from(new Set(entries)));
      } catch {
        setClassSuggestions([]);
      }
    };
    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, [requiresClass]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parseResult = onboardingSchema.safeParse(formState);
    if (!parseResult.success) {
      setError(parseResult.error.issues[0]?.message ?? "Ungültige Eingaben");
      return;
    }

    if (requiresClass && !parseResult.data.backgroundClass) {
      const helper = activeTag?.classRequiredError ?? "Bitte gib deine Klasse an.";
      setError(helper);
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveOnboardingAction({
        focus: parseResult.data.focus,
        background: parseResult.data.background,
        backgroundClass: parseResult.data.backgroundClass ?? null,
        notes: parseResult.data.notes ?? null,
        memberSinceYear: parseResult.data.memberSinceYear ? Number.parseInt(parseResult.data.memberSinceYear, 10) : null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      const payload = result.data.onboarding;
      const next: OnboardingProfile = {
        focus: payload.focus,
        background: payload.background,
        backgroundClass: payload.backgroundClass,
        notes: payload.notes,
        memberSinceYear: payload.memberSinceYear,
        updatedAt: payload.updatedAt,
        dietaryPreference: onboarding?.dietaryPreference ?? null,
        dietaryPreferenceStrictness: onboarding?.dietaryPreferenceStrictness ?? null,
        whatsappLinkVisitedAt: onboarding?.whatsappLinkVisitedAt ?? null,
        show: onboarding?.show ?? null,
      };
      onOnboardingChange(next);
      setFormState({
        focus: payload.focus,
        background: payload.background ?? "",
        backgroundClass: payload.backgroundClass ?? "",
        notes: payload.notes ?? "",
        memberSinceYear: payload.memberSinceYear ? String(payload.memberSinceYear) : "",
      });
      toast.success("Onboarding-Angaben gespeichert");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!whatsappLink) return;
    window.open(whatsappLink, "_blank", "noopener,noreferrer");
    setWhatsappSubmitting(true);
    try {
      const response = await fetch("/api/onboarding/whatsapp-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Aktion fehlgeschlagen");
      }
      const visitedAt = typeof data?.visitedAt === "string" ? data.visitedAt : new Date().toISOString();
      const next: OnboardingProfile = {
        focus: onboarding?.focus ?? "acting",
        background: onboarding?.background ?? null,
        backgroundClass: onboarding?.backgroundClass ?? null,
        notes: onboarding?.notes ?? null,
        memberSinceYear: onboarding?.memberSinceYear ?? null,
        updatedAt: onboarding?.updatedAt ?? null,
        dietaryPreference: onboarding?.dietaryPreference ?? null,
        dietaryPreferenceStrictness: onboarding?.dietaryPreferenceStrictness ?? null,
        whatsappLinkVisitedAt: visitedAt,
        show: onboarding?.show ?? null,
      };
      onOnboardingChange(next);
      toast.success("WhatsApp-Besuch vermerkt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen";
      toast.error(message);
    } finally {
      setWhatsappSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Onboarding-Angaben</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {whatsappLink && !whatsappVisitedAt ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span>WhatsApp-Onboarding steht noch aus.</span>
            </div>
            <p className="text-xs text-primary/80">
              Öffne die Gruppe jetzt – wir markieren dich anschließend als informiert.
            </p>
            <Button size="sm" onClick={handleWhatsAppClick} disabled={whatsappSubmitting}>
              {whatsappSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Aktualisiere…
                </>
              ) : (
                "WhatsApp öffnen"
              )}
            </Button>
          </div>
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Fokus</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "acting", label: "Schauspiel" },
                { value: "tech", label: "Gewerke" },
                { value: "both", label: "Beides" },
              ] satisfies Array<{ value: OnboardingFocus; label: string }>).map((option) => {
                const active = formState.focus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                    onClick={() => setFormState((prev) => ({ ...prev, focus: option.value }))}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="background">Schulischer / beruflicher Hintergrund</Label>
            <Input
              id="background"
              value={formState.background}
              onChange={(event) => setFormState((prev) => ({ ...prev, background: event.target.value }))}
              placeholder="z.B. BSZ Altroßthal – Berufsschule"
            />
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_TAGS.map((tag) => {
                const active = activeTag?.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        background: tag.value,
                        backgroundClass: tag.requiresClass ? prev.backgroundClass : "",
                      }))
                    }
                  >
                    {tag.label}
                  </button>
                );
              })}
              {backgroundSuggestions
                .filter(
                  (suggestion) =>
                    !BACKGROUND_TAGS.some(
                      (tag) => normalizeBackgroundLabel(tag.value) === normalizeBackgroundLabel(suggestion),
                    ),
                )
                .slice(0, 6)
                .map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        background: suggestion,
                        backgroundClass: prev.backgroundClass,
                      }))
                    }
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          </div>

          {requiresClass ? (
            <div className="space-y-2">
              <Label htmlFor="backgroundClass">{activeTag?.classLabel ?? "Klasse"}</Label>
              <Input
                id="backgroundClass"
                value={formState.backgroundClass}
                onChange={(event) => setFormState((prev) => ({ ...prev, backgroundClass: event.target.value }))}
                placeholder={activeTag?.classPlaceholder ?? "z.B. BG 12"}
              />
              <p className="text-xs text-muted-foreground">{activeTag?.classHelper ?? "Hilft uns bei der Zuordnung."}</p>
              {classSuggestions.length ? (
                <div className="flex flex-wrap gap-2">
                  {classSuggestions.slice(0, 8).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={() => setFormState((prev) => ({ ...prev, backgroundClass: suggestion }))}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="memberSinceYear">Mitglied seit</Label>
            <Input
              id="memberSinceYear"
              type="number"
              inputMode="numeric"
              min="1900"
              max={String(CURRENT_YEAR)}
              value={formState.memberSinceYear}
              onChange={(event) => setFormState((prev) => ({ ...prev, memberSinceYear: event.target.value }))}
              placeholder={`z.B. ${CURRENT_YEAR}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Team-Notizen</Label>
            <Textarea
              id="notes"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Infos für das Team"
            />
          </div>

          <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>
              Aktuelles Ernährungsprofil: {dietaryPreference.label ?? "Noch kein Eintrag"}
              {dietaryPreference.strictnessLabel ? ` · ${dietaryPreference.strictnessLabel}` : ""}
            </p>
            {onboarding?.updatedAt ? <p>Zuletzt aktualisiert am {formatDate(onboarding.updatedAt) ?? "unbekannt"}</p> : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Onboarding speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


