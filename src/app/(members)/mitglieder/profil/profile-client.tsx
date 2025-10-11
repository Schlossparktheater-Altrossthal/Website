"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  AlertTriangle,
  Check,
  CheckCircle2,
  CalendarDays,
  Loader2,
  Mail,
  Pencil,
  Plus,
  MessageCircle,
  ShieldCheck,
  Trash2,
  Users,
  User,
  CreditCard,
  Utensils,
  Heart,
  Eye,
  Sparkles,
  Theater,
  Ruler,
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
import { BACKGROUND_TAGS, normalizeBackgroundLabel } from "@/data/onboarding-backgrounds";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { UserAvatar } from "@/components/user-avatar";
import { useOnboardingBackgroundData } from "@/components/onboarding/use-onboarding-background-data";
import { useInterestSuggestions } from "@/hooks/useInterestSuggestions";
import {
  getRolePreferenceDescription,
  getRolePreferenceTitle,
  listRolePreferenceDefinitions,
} from "@/lib/onboarding/role-preferences";
import {
  getRolePreferenceWeightLabel,
  normalizeRolePreferenceWeight,
} from "@/lib/onboarding/role-preference-utils";
import {
  buildProfileChecklist,
  isPaymentDetailsComplete,
  type ProfileChecklistTarget,
  type ProfileCompletionSummary,
} from "@/lib/profile-completion";
import { getUserDisplayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import type { PhotoConsentSummary } from "@/types/photo-consent";
import { AllergyLevel, type OnboardingFocus, type PayoutMethod, type Role } from "@prisma/client";

import {
  deleteAllergyAction,
  saveDietaryPreferenceAction,
  saveInterestsAction,
  saveMeasurementAction,
  saveOnboardingAction,
  startOnboardingAction,
  saveRolePreferencesAction,
  updateProfileBasicsAction,
  upsertAllergyAction,
  type UpdateProfileBasicsResult,
  type SaveRolePreferencesInput,
} from "./actions";
import { ProfileCompletionProvider, useProfileCompletion } from "./profile-completion-context";
import { AvatarCropDialog } from "./avatar-crop-dialog";
import { useAvatarCrop } from "./use-avatar-crop";

const CURRENT_YEAR = new Date().getFullYear();
const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const CHECKLIST_TARGETS: ProfileChecklistTarget[] = [
  "stammdaten",
  "zahlungen",
  "ernaehrung",
  "masse",
  "interessen",
  "freigaben",
  "onboarding",
];

const PROFILE_ONBOARDING_BACKGROUND_SUGGESTIONS = ["Schule", "Ausbildung", "Beruf"] as const;

const ROLE_PREFERENCE_DEFINITIONS = {
  acting: listRolePreferenceDefinitions("acting"),
  crew: listRolePreferenceDefinitions("crew"),
} as const;

const DEFAULT_ROLE_PREFERENCE_WEIGHT = 60;
const ONBOARDING_STATUS_LABELS: Record<OnboardingSummary["status"], string> = {
  draft: "In Vorbereitung",
  active: "Aktiv",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

type RolePreferenceFormEntry = {
  code: string;
  title: string;
  description: string | null;
  domain: "acting" | "crew";
  weight: number;
  enabled: boolean;
  isCustom: boolean;
};

type RolePreferenceFormState = {
  acting: RolePreferenceFormEntry[];
  crew: RolePreferenceFormEntry[];
};

function buildPreferenceFormState(
  preferences: ProfileClientProps["rolePreferences"],
): RolePreferenceFormState {
  const remaining = new Map(preferences.map((pref) => [pref.code, pref]));

  const acting: RolePreferenceFormEntry[] = ROLE_PREFERENCE_DEFINITIONS.acting.map((definition) => {
    const existing = remaining.get(definition.code);
    if (existing) {
      remaining.delete(definition.code);
    }
    const weight = existing ? normalizeRolePreferenceWeight(existing.weight) : DEFAULT_ROLE_PREFERENCE_WEIGHT;
    return {
      code: definition.code,
      title: definition.title,
      description: definition.description,
      domain: "acting" as const,
      weight,
      enabled: existing ? existing.weight > 0 : false,
      isCustom: false,
    } satisfies RolePreferenceFormEntry;
  });

  const crew: RolePreferenceFormEntry[] = ROLE_PREFERENCE_DEFINITIONS.crew.map((definition) => {
    const existing = remaining.get(definition.code);
    if (existing) {
      remaining.delete(definition.code);
    }
    const weight = existing ? normalizeRolePreferenceWeight(existing.weight) : DEFAULT_ROLE_PREFERENCE_WEIGHT;
    return {
      code: definition.code,
      title: definition.title,
      description: definition.description,
      domain: "crew" as const,
      weight,
      enabled: existing ? existing.weight > 0 : false,
      isCustom: false,
    } satisfies RolePreferenceFormEntry;
  });

  for (const pref of remaining.values()) {
    const domain = pref.domain === "acting" ? "acting" : "crew";
    const title = getRolePreferenceTitle(pref.code);
    const description = getRolePreferenceDescription(pref.code);
    const entry: RolePreferenceFormEntry = {
      code: pref.code,
      title,
      description,
      domain,
      weight: normalizeRolePreferenceWeight(pref.weight),
      enabled: pref.weight > 0,
      isCustom: true,
    };
    if (domain === "acting") {
      acting.push(entry);
    } else {
      crew.push(entry);
    }
  }

  return { acting, crew };
}

const PAYOUT_METHOD_OPTIONS: Array<{ value: PayoutMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Banküberweisung" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "OTHER", label: "Andere Option" },
];

const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[0-9A-Z]{11,30}$/;
const PAYPAL_HANDLE_REGEX = /^(?:https?:\/\/)?(?:www\.)?paypal\.me\/.+|^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

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
    payoutMethod: PayoutMethod;
    payoutAccountHolder: string | null;
    payoutIban: string | null;
    payoutBankName: string | null;
    payoutPaypalHandle: string | null;
    payoutNote: string | null;
  };
  rolePreferences: Array<{
    code: string;
    domain: "acting" | "crew";
    weight: number;
  }>;
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
    preferences: Array<{
      code: string;
      domain: "acting" | "crew";
      weight: number;
    }>;
    show:
      | {
          id: string;
          title: string | null;
          year: number | null;
          periodLabel: string | null;
          status: OnboardingSummary["status"];
        }
      | null;
    whatsappLink: string | null;
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
  availableOnboardings: OnboardingSummary[];
};

type ProfileUser = ProfileClientProps["user"];
type Allergy = ProfileClientProps["allergies"][number];
type Measurement = Omit<ProfileClientProps["measurements"][number], "type" | "unit"> & {
  type: MeasurementType;
  unit: MeasurementUnit;
};
type OnboardingProfile = NonNullable<ProfileClientProps["onboarding"]>;

function isProfilePaymentComplete(user: ProfileUser): boolean {
  return isPaymentDetailsComplete({
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder,
    payoutIban: user.payoutIban,
    payoutBankName: user.payoutBankName,
    payoutPaypalHandle: user.payoutPaypalHandle,
    payoutNote: user.payoutNote,
  });
}

function mapUpdatedUserFromPayload(
  previous: ProfileUser,
  payload: UpdateProfileBasicsResult["user"],
): ProfileUser {
  const displayName =
    payload.name && payload.name.trim().length > 0
      ? payload.name
      : getUserDisplayName(
          {
            firstName: payload.firstName ?? undefined,
            lastName: payload.lastName ?? undefined,
            name: payload.name ?? undefined,
            email: payload.email,
          },
          payload.email,
        );

  return {
    ...previous,
    firstName: payload.firstName ?? "",
    lastName: payload.lastName ?? "",
    displayName,
    email: payload.email,
    dateOfBirth: payload.dateOfBirth,
    avatarSource: payload.avatarSource,
    avatarUpdatedAt: payload.avatarUpdatedAt,
    payoutMethod: payload.payoutMethod,
    payoutAccountHolder: payload.payoutAccountHolder,
    payoutIban: payload.payoutIban,
    payoutBankName: payload.payoutBankName,
    payoutPaypalHandle: payload.payoutPaypalHandle,
    payoutNote: payload.payoutNote,
  };
}

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

type PaymentFormState = {
  payoutMethod: PayoutMethod;
  payoutAccountHolder: string;
  payoutIban: string;
  payoutBankName: string;
  payoutPaypalHandle: string;
  payoutNote: string;
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
  hasPaymentDetails: boolean;
  hasDietaryPreference: boolean;
  hasMeasurements?: boolean;
  photoConsentGiven?: boolean;
  hasWhatsappVisit?: boolean;
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

const payoutDetailsSchemaBase = z.object({
  payoutMethod: z.enum(["BANK_TRANSFER", "PAYPAL", "OTHER"]),
  payoutAccountHolder: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 160, {
      message: "Kontoinhaber darf maximal 160 Zeichen haben.",
    }),
  payoutIban: z
    .string()
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .refine((value) => value.length === 0 || IBAN_REGEX.test(value), {
      message: "Ungültige IBAN.",
    }),
  payoutBankName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 160, {
      message: "Bankname darf maximal 160 Zeichen haben.",
    }),
  payoutPaypalHandle: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length === 0 || value.length <= 160, {
      message: "PayPal-Angabe darf maximal 160 Zeichen haben.",
    })
    .refine((value) => value.length === 0 || PAYPAL_HANDLE_REGEX.test(value), {
      message: "Bitte gib deine PayPal-E-Mail-Adresse oder einen PayPal.me-Link an.",
    }),
  payoutNote: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 500, {
      message: "Notiz darf maximal 500 Zeichen enthalten.",
    }),
});

type PayoutDetailsData = z.infer<typeof payoutDetailsSchemaBase>;

function validatePayoutDetails(data: PayoutDetailsData, ctx: z.RefinementCtx) {
  if (data.payoutMethod === "BANK_TRANSFER") {
    if (!data.payoutAccountHolder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte gib den Kontoinhaber an.",
        path: ["payoutAccountHolder"],
      });
    }
    if (!data.payoutIban) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte gib eine gültige IBAN an.",
        path: ["payoutIban"],
      });
    }
    if (!data.payoutBankName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte gib den Namen deiner Bank an.",
        path: ["payoutBankName"],
      });
    }
  } else if (data.payoutMethod === "PAYPAL") {
    if (!data.payoutPaypalHandle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte hinterlege deine PayPal-Adresse oder deinen PayPal.me-Link.",
        path: ["payoutPaypalHandle"],
      });
    }
  } else if (data.payoutMethod === "OTHER") {
    if (!data.payoutNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte beschreibe kurz deine bevorzugte Auszahlung.",
        path: ["payoutNote"],
      });
    }
  }
}

const payoutDetailsSchema = payoutDetailsSchemaBase.superRefine(validatePayoutDetails);

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

const INTEREST_SEPARATOR_PATTERN = /[;,\n]/;
const INTEREST_SEPARATOR_SPLIT_PATTERN = /[,;\n]+/;

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return dateFormatter.format(parsed);
}

export function ProfileClient({
  user,
  rolePreferences,
  onboarding,
  interests,
  allergies,
  measurements,
  canManageMeasurements,
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
        initialMeasurements={measurements}
        canManageMeasurements={canManageMeasurements}
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
  initialMeasurements: ProfileClientProps["measurements"];
  canManageMeasurements: boolean;
  availableOnboardings: OnboardingSummary[];
};

function ProfileClientInner({
  initialUser,
  initialRolePreferences,
  initialOnboarding,
  initialInterests,
  initialAllergies,
  initialMeasurements,
  canManageMeasurements,
  availableOnboardings,
}: ProfileClientInnerProps) {
  const { summary, replaceSummary } = useProfileCompletion();
  const { update: refreshSession } = useSession();

  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [onboarding, setOnboarding] = useState<ProfileClientProps["onboarding"]>(initialOnboarding);
  const [rolePreferences, setRolePreferences] = useState<ProfileClientProps["rolePreferences"]>(
    initialRolePreferences,
  );
  const [onboardingFocus, setOnboardingFocus] = useState<OnboardingFocus>(
    (initialOnboarding?.focus as OnboardingFocus) ?? "acting",
  );
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
  const whatsappLink = onboarding?.whatsappLink ?? null;
  const activeChecklistTarget = useMemo<ProfileChecklistTarget | undefined>(() => {
    const maybeTarget = activeTab as ProfileChecklistTarget;
    return CHECKLIST_TARGETS.includes(maybeTarget) ? maybeTarget : undefined;
  }, [activeTab]);

  const [, setChecklistState] = useState<ChecklistState>(() => ({
    hasBasicData: Boolean(initialUser.firstName?.trim() && initialUser.email?.trim()),
    hasBirthdate: Boolean(initialUser.dateOfBirth),
    hasPaymentDetails: isProfilePaymentComplete(initialUser),
    hasDietaryPreference: Boolean(initialOnboarding?.dietaryPreference?.trim()),
    hasMeasurements: canManageMeasurements ? initialMeasurements.length > 0 : undefined,
    photoConsentGiven: summary.items.find((item) => item.id === "photo-consent")?.complete ?? undefined,
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
        hasMeasurements: canManageMeasurements ? Boolean(state.hasMeasurements) : undefined,
        photoConsent:
          state.photoConsentGiven === undefined
            ? undefined
            : { consentGiven: Boolean(state.photoConsentGiven) },
        hasWhatsappVisit: whatsappLink ? state.hasWhatsappVisit : undefined,
      }),
    [canManageMeasurements, whatsappLink],
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

  const percentComplete = summary.total
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  useEffect(() => {
    if (onboarding?.focus) {
      setOnboardingFocus(onboarding.focus as OnboardingFocus);
    }
  }, [onboarding?.focus]);

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
      const data = (await response.json().catch(() => null)) as
        | { error?: unknown; visitedAt?: unknown }
        | null;

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
        icon: <MessageCircle className="h-5 w-5" aria-hidden />,
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
                  toast.success(alreadyVisited ? "WhatsApp-Link geöffnet" : "WhatsApp-Besuch vermerkt");
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen";
                  toast.error(message);
                });
            }}
          >
            <span>{whatsappVisitedAt ? "Erneut öffnen" : "Chat öffnen"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ),
      },
    ];
  }, [whatsappLink, whatsappVisitedAt, whatsappVisitedAtLabel, handleWhatsAppVisit]);

  const tabOptions = useMemo(
    () => {
      const options: Array<{ value: string; label: string; icon: typeof User }> = [
        { value: "stammdaten", label: "Stammdaten", icon: User },
        { value: "zahlungen", label: "Zahlungsdaten", icon: CreditCard },
        { value: "ernaehrung", label: "Ernährung", icon: Utensils },
        { value: "interessen", label: "Interessen", icon: Heart },
        { value: "freigaben", label: "Freigaben", icon: Eye },
        { value: "onboarding", label: "Onboarding", icon: Sparkles },
        { value: "rollen", label: "Präferenzen", icon: Theater },
      ];

      if (canManageMeasurements) {
        options.splice(3, 0, { value: "masse", label: "Maße", icon: Ruler });
      }

      return options;
    },
    [canManageMeasurements],
  );

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
            rolePreferences={rolePreferences}
            whatsappVisitedAt={whatsappVisitedAt}
            onWhatsAppVisit={handleWhatsAppVisit}
            dietaryPreference={dietaryPreference}
            availableOnboardings={availableOnboardings}
            onFocusChange={setOnboardingFocus}
          />
        </TabsContent>

        <TabsContent value="rollen" className="space-y-6">
          <RolePreferencesSection
            focus={onboardingFocus}
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

type ProfileOverviewCardProps = {
  user: ProfileUser;
  displayName: string;
  sortedRoles: Role[];
  summary: ProfileCompletionSummary;
  onboarding: ProfileClientProps["onboarding"];
  createdAtLabel: string | null;
  memberSinceLabel: string | null;
  percentComplete: number;
  highlights: HighlightTileConfig[];
  activeChecklistTarget?: ProfileChecklistTarget;
  onChecklistNavigate?: (target: ProfileChecklistTarget) => void;
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
  highlights,
  activeChecklistTarget,
  onChecklistNavigate,
}: ProfileOverviewCardProps) {
  const email = user.email?.trim() ?? "";
  const show = onboarding?.show ?? null;
  const showTitle = show?.title && show.title.trim().length ? show.title.trim() : null;
  const showYear = typeof show?.year === "number" ? show.year : null;
  const showLabel = show
    ? showTitle
      ? showYear
        ? `${showTitle} (${showYear})`
        : showTitle
      : showYear
        ? `Produktion ${showYear}`
        : "Produktion"
    : null;
  const checklistBadgeLabel = summary.complete ? "Profil vollständig" : null;
  const checklistCountLabel = summary.total ? `${summary.completed}/${summary.total}` : null;
  const pendingChecklistItems = summary.items.filter((item) => !item.complete);
  const hasChecklistItems = pendingChecklistItems.length > 0;
  const hasHighlights = highlights.length > 0;

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              userId={user.id}
              email={user.email}
              firstName={user.firstName}
              lastName={user.lastName}
              name={displayName}
              size={80}
              className="h-20 w-20 shrink-0 border border-border/60 text-xl shadow-sm sm:h-20 sm:w-20"
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
                <CardTitle className="text-lg font-semibold leading-tight text-foreground sm:text-xl">{displayName}</CardTitle>
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
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center justify-center gap-2 font-medium text-foreground transition hover:text-primary sm:justify-start"
                  >
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{email}</span>
                  </a>
                ) : (
                  <span className="flex items-center justify-center gap-2 text-muted-foreground/80 sm:justify-start">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    Keine E-Mail hinterlegt
                  </span>
                )}
                {memberSinceLabel || createdAtLabel ? (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground sm:justify-start">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{memberSinceLabel ?? (createdAtLabel ? `Profil seit ${createdAtLabel}` : "")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="flex flex-wrap gap-2">
          {sortedRoles.map((role) => (
            <Badge
              key={role}
              variant="outline"
              className="rounded-full border-border/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide"
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
        {summary.total && !summary.complete ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Profilstatus</span>
              <span>{checklistCountLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted/40">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  summary.complete
                    ? "bg-success"
                    : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, percentComplete))}%` }}
              />
            </div>
          </div>
        ) : null}
        {hasChecklistItems || hasHighlights ? (
          <div
            className={cn(
              "grid gap-4",
              hasChecklistItems && hasHighlights ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : "",
            )}
          >
            {hasChecklistItems ? (
              <div className="rounded-xl border border-border/60 bg-background/80 p-4 shadow-inner shadow-primary/5">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Checkliste</div>
                <ul className="mt-3 space-y-2">
                  {pendingChecklistItems.map((item) => {
                    const target = item.targetSection ?? null;
                    const isActive = target ? activeChecklistTarget === target : false;
                    const isComplete = item.complete;

                    const content = (
                      <div className="flex w-full items-start gap-3">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] transition",
                            isComplete
                              ? "border-success/60 bg-success/10 text-success"
                              : "border-border/60 bg-background text-muted-foreground/40",
                            isActive ? "ring-2 ring-primary/30" : "",
                          )}
                          aria-hidden
                        >
                          {isComplete ? <Check className="h-3 w-3" aria-hidden /> : null}
                        </span>
                        <span
                          className={cn(
                            "flex-1 text-left text-xs leading-snug",
                            isComplete ? "text-muted-foreground/80 line-through" : "text-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    );

                    if (target) {
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onChecklistNavigate?.(target)}
                            className={cn(
                              "flex w-full items-center rounded-lg border border-transparent bg-background/40 px-3 py-2 text-left transition",
                              isActive
                                ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                                : "hover:border-border/60 hover:bg-muted/40 text-foreground/90",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            )}
                          >
                            {content}
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center rounded-lg border px-3 py-2",
                          isComplete ? "border-success/40 bg-success/10" : "border-border/50 bg-muted/30",
                        )}
                      >
                        {content}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {hasHighlights ? (
              <div className="flex flex-col gap-3">
                {highlights.map((tile) => (
                  <ProfileHighlightTile key={tile.id} {...tile} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {show ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 p-3 text-xs text-muted-foreground">
            <Users className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>
              Produktion: {showLabel}
              {show?.periodLabel ? ` · ${show.periodLabel}` : ""}
            </span>
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
    default:
      "border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur",
    info: "border-primary/50 bg-gradient-to-br from-primary/18 via-primary/10 to-background shadow-xl shadow-primary/10 text-primary",
    success: "border-success/50 bg-gradient-to-br from-success/18 via-success/10 to-background shadow-xl text-success",
    warning: "border-warning/50 bg-gradient-to-br from-warning/18 via-warning/10 to-background shadow-xl text-warning",
  };

  const iconClasses: Record<NonNullable<ProfileHighlightTileProps["tone"]>, string> = {
    default: "border-border/50 bg-background/80 text-muted-foreground",
    info: "border-primary/40 bg-primary/15 text-primary",
    success: "border-success/45 bg-success/15 text-success",
    warning: "border-warning/45 bg-warning/15 text-warning",
  };

  return (
    <div className={cn("flex h-full flex-col gap-3 rounded-2xl border p-5", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">{title}</p>
          <p className="text-sm font-semibold leading-5 text-foreground">{description}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border text-sm", iconClasses[tone])}>
          {icon}
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
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
  
  const avatarCrop = useAvatarCrop({
    userId: user.id,
    onCropComplete: () => {
      setFormState((prev) => ({ ...prev, avatarSource: "UPLOAD", removeAvatar: false }));
    },
  });

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
      removeAvatar: false,
    }));
  }, [
    user.firstName,
    user.lastName,
    user.displayName,
    user.email,
    user.dateOfBirth,
    user.avatarSource,
  ]);

  useEffect(() => {
    if (!avatarCrop.avatarFile) {
      avatarCrop.resetAvatarCrop();
    }
  }, [avatarCrop]);

  const avatarPreviewState = useMemo(
    () => {
      if (formState.avatarSource === "GRAVATAR") {
        return {
          source: "GRAVATAR" as const,
          previewUrl: null,
          description: "Vorschau deines Gravatar-Bildes.",
        };
      }

      if (formState.avatarSource === "UPLOAD") {
        if (avatarCrop.avatarPreviewUrl) {
          return {
            source: "UPLOAD" as const,
            previewUrl: avatarCrop.avatarPreviewUrl,
            description: "Vorschau deines neuen Uploads mit individuellem Ausschnitt (noch nicht gespeichert).",
          };
        }

        if (user.avatarSource === "UPLOAD") {
          if (formState.removeAvatar) {
            return {
              source: "INITIALS" as const,
              previewUrl: null,
              description: "Eigenes Bild wird entfernt – wir zeigen deine Initialen.",
            };
          }

          return {
            source: "UPLOAD" as const,
            previewUrl: null,
            description: "Aktuell gespeichertes, eigenes Bild.",
          };
        }

        return {
          source: "INITIALS" as const,
          previewUrl: null,
          description: "Kein Upload vorhanden – wir zeigen deine Initialen.",
        };
      }

      return {
        source: "INITIALS" as const,
        previewUrl: null,
        description: "Avatar basiert auf deinen Initialen.",
      };
    },
    [
      avatarCrop.avatarPreviewUrl,
      formState.avatarSource,
      formState.removeAvatar,
      user.avatarSource,
    ],
  );

  const useStoredUploadPreview = avatarPreviewState.source === "UPLOAD" && !avatarPreviewState.previewUrl;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarSourceChange = (value: BasicsFormState["avatarSource"]) => {
    setFormState((prev) => ({ ...prev, avatarSource: value, removeAvatar: false }));
  };

  const handleAvatarCropReopenClick = () => {
    void avatarCrop.handleAvatarCropReopen(formState.avatarSource === "UPLOAD" && user.avatarSource === "UPLOAD" ? "UPLOAD" : null);
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
    if (avatarCrop.avatarFile) {
      formData.append("avatarFile", avatarCrop.avatarFile);
      if (avatarCrop.avatarCropSelection) {
        formData.append("avatarCrop", JSON.stringify(avatarCrop.avatarCropSelection));
      }
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
      const nextUser = mapUpdatedUserFromPayload(user, payload);
      await onUserUpdated(nextUser);
      resetPasswordFields();
      avatarCrop.resetAvatarCrop();
      setFormState((prev) => ({ ...prev, removeAvatar: false }));
      toast.success("Stammdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
                <Input
                  id="lastName"
                  name="lastName"
                  value={formState.lastName}
                  onChange={handleInputChange}
                  autoComplete="family-name"
                />
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
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  autoComplete="email"
                />
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
                <Label id="avatar-source-label">Avatar-Quelle wählen</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="avatar-source-label">
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
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleAvatarSourceChange(option.value)}
                        className={cn(
                          "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition",
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
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <UserAvatar
                    userId={useStoredUploadPreview ? user.id : undefined}
                    email={formState.email}
                    firstName={formState.firstName}
                    lastName={formState.lastName}
                    name={formState.displayName}
                    size={48}
                    className="h-12 w-12"
                    avatarSource={avatarPreviewState.source}
                    avatarUpdatedAt={useStoredUploadPreview ? user.avatarUpdatedAt : undefined}
                    previewUrl={avatarPreviewState.previewUrl}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Aktuelle Vorschau</p>
                    <p className="text-xs text-muted-foreground">{avatarPreviewState.description}</p>
                  </div>
                </div>
                {formState.avatarSource === "GRAVATAR" ? (
                  <p className="text-xs text-muted-foreground">
                    Wir nutzen den Gravatar zu deiner E-Mail-Adresse. Stelle sicher, dass dort ein Bild hinterlegt ist.
                  </p>
                ) : null}
                {formState.avatarSource === "UPLOAD" ? (
                  <div className="space-y-2 pt-2">
                    <Input
                      ref={avatarCrop.fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={avatarCrop.handleAvatarFileChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG oder WebP bis 8 MB. Wir skalieren dein Bild automatisch und speichern es optimiert.
                    </p>
                    {(avatarCrop.avatarPreviewUrl || user.avatarSource === "UPLOAD") && !formState.removeAvatar ? (
                      <div className="space-y-2">
                        {avatarCrop.avatarPreviewUrl ? (
                          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                            <UserAvatar
                              name={user.displayName}
                              size={48}
                              className="h-12 w-12"
                              previewUrl={avatarCrop.avatarPreviewUrl}
                            />
                            <span className="text-xs text-muted-foreground">Vorschau des neuen Avatars</span>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={handleAvatarCropReopenClick}
                            disabled={avatarCrop.avatarCropLoading}
                          >
                            {avatarCrop.avatarCropLoading ? (
                              <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                                Ausschnitt wird geladen…
                              </>
                            ) : (
                              "Bildausschnitt anpassen"
                            )}
                          </Button>
                          {avatarCrop.avatarCropSelection ? (
                            <span className="text-[0.7rem] text-muted-foreground">
                              Zuletzt gewählter Ausschnitt bleibt erhalten.
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {user.avatarSource === "UPLOAD" && !avatarCrop.avatarFile ? (
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

            <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
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
      <AvatarCropDialog
        open={Boolean(avatarCrop.cropDialogOpen && avatarCrop.cropImageUrl)}
        imageUrl={avatarCrop.cropImageUrl}
        initialSelection={avatarCrop.cropDialogInitialSelection}
        initialState={avatarCrop.cropDialogInitialState}
        onClose={avatarCrop.handleCropDialogClose}
        onConfirm={avatarCrop.handleCropDialogConfirm}
      />
    </>
  );
}

type PaymentSectionProps = {
  user: ProfileUser;
  onUserUpdated: (nextUser: ProfileUser) => Promise<void> | void;
};

function PaymentSection({ user, onUserUpdated }: PaymentSectionProps) {
  const [formState, setFormState] = useState<PaymentFormState>(() => ({
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder ?? "",
    payoutIban: user.payoutIban ?? "",
    payoutBankName: user.payoutBankName ?? "",
    payoutPaypalHandle: user.payoutPaypalHandle ?? "",
    payoutNote: user.payoutNote ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState({
      payoutMethod: user.payoutMethod,
      payoutAccountHolder: user.payoutAccountHolder ?? "",
      payoutIban: user.payoutIban ?? "",
      payoutBankName: user.payoutBankName ?? "",
      payoutPaypalHandle: user.payoutPaypalHandle ?? "",
      payoutNote: user.payoutNote ?? "",
    });
  }, [
    user.payoutMethod,
    user.payoutAccountHolder,
    user.payoutIban,
    user.payoutBankName,
    user.payoutPaypalHandle,
    user.payoutNote,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    const nextValue = name === "payoutIban" ? value.replace(/\s+/g, "").toUpperCase() : value;
    setFormState((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handlePayoutMethodChange = (value: PayoutMethod) => {
    setFormState((prev) => ({ ...prev, payoutMethod: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parseResult = payoutDetailsSchema.safeParse(formState);
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
    setFormState(data);

    const formData = new FormData();
    formData.append("payoutMethod", data.payoutMethod);
    formData.append("payoutAccountHolder", data.payoutAccountHolder);
    formData.append("payoutIban", data.payoutIban);
    formData.append("payoutBankName", data.payoutBankName);
    formData.append("payoutPaypalHandle", data.payoutPaypalHandle);
    formData.append("payoutNote", data.payoutNote);

    setSubmitting(true);
    try {
      const result = await updateProfileBasicsAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.user;
      const nextUser = mapUpdatedUserFromPayload(user, payload);
      await onUserUpdated(nextUser);
      setFormState({
        payoutMethod: payload.payoutMethod,
        payoutAccountHolder: payload.payoutAccountHolder ?? "",
        payoutIban: payload.payoutIban ?? "",
        payoutBankName: payload.payoutBankName ?? "",
        payoutPaypalHandle: payload.payoutPaypalHandle ?? "",
        payoutNote: payload.payoutNote ?? "",
      });
      toast.success("Zahlungsdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Zahlungsdaten</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hinterlege hier, wie wir Auslagen erstatten oder Gagen auszahlen sollen.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="payoutMethod">Bevorzugte Auszahlung</Label>
            <Select value={formState.payoutMethod} onValueChange={(value) => handlePayoutMethodChange(value as PayoutMethod)}>
              <SelectTrigger id="payoutMethod">
                <SelectValue placeholder="Auszahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.payoutMethod ? <p className="text-sm text-destructive">{fieldErrors.payoutMethod}</p> : null}
            <p className="text-xs text-muted-foreground">
              Diese Angaben nutzen wir, um dir Auslagen zu erstatten oder Gagen auszuzahlen.
            </p>
          </div>

          {formState.payoutMethod === "BANK_TRANSFER" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payoutAccountHolder">Kontoinhaber</Label>
                <Input
                  id="payoutAccountHolder"
                  name="payoutAccountHolder"
                  value={formState.payoutAccountHolder}
                  onChange={handleInputChange}
                  autoComplete="name"
                />
                {fieldErrors.payoutAccountHolder ? (
                  <p className="text-sm text-destructive">{fieldErrors.payoutAccountHolder}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutBankName">Bank</Label>
                <Input
                  id="payoutBankName"
                  name="payoutBankName"
                  value={formState.payoutBankName}
                  onChange={handleInputChange}
                  autoComplete="organization"
                />
                {fieldErrors.payoutBankName ? (
                  <p className="text-sm text-destructive">{fieldErrors.payoutBankName}</p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payoutIban">IBAN</Label>
                <Input
                  id="payoutIban"
                  name="payoutIban"
                  value={formState.payoutIban}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
                {fieldErrors.payoutIban ? <p className="text-sm text-destructive">{fieldErrors.payoutIban}</p> : null}
                <p className="text-xs text-muted-foreground">Wir speichern die IBAN ohne Leerzeichen.</p>
              </div>
            </div>
          ) : null}

          {formState.payoutMethod === "PAYPAL" ? (
            <div className="space-y-2">
              <Label htmlFor="payoutPaypalHandle">PayPal-Adresse</Label>
              <Input
                id="payoutPaypalHandle"
                name="payoutPaypalHandle"
                value={formState.payoutPaypalHandle}
                onChange={handleInputChange}
                placeholder="paypal@example.com oder https://paypal.me/deinname"
                autoComplete="off"
              />
              {fieldErrors.payoutPaypalHandle ? (
                <p className="text-sm text-destructive">{fieldErrors.payoutPaypalHandle}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Nutze deine PayPal-E-Mail-Adresse oder einen PayPal.me-Link.
              </p>
            </div>
          ) : null}

          {formState.payoutMethod === "OTHER" ? (
            <div className="space-y-2">
              <Label htmlFor="payoutNote">Auszahlungsdetails</Label>
              <Textarea
                id="payoutNote"
                name="payoutNote"
                value={formState.payoutNote}
                onChange={handleInputChange}
                rows={3}
                placeholder="Beschreibe kurz, wie wir dir Geld senden sollen."
              />
              {fieldErrors.payoutNote ? <p className="text-sm text-destructive">{fieldErrors.payoutNote}</p> : null}
              <p className="text-xs text-muted-foreground">Zum Beispiel Revolut, Wise oder andere Konten.</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Zahlungsdaten speichern"
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
              <Label htmlFor="dietary-style">Ernährungsstil</Label>
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
                <SelectTrigger id="dietary-style" aria-label="Ernährungsstil wählen">
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
              <Label htmlFor="dietary-strictness">Strengegrad</Label>
              <Select
                value={dietaryState.strictness}
                onValueChange={(value) => setDietaryState((prev) => ({ ...prev, strictness: value as DietaryStrictnessOption }))}
                disabled={dietaryState.style === "omnivore" || dietaryState.style === "none"}
              >
                <SelectTrigger id="dietary-strictness" aria-label="Strengegrad des Ernährungsstils">
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

            <div className="flex flex-col items-stretch justify-end sm:flex-row sm:items-center">
              <Button type="submit" disabled={dietarySubmitting} className="w-full sm:w-auto">
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
              <Label htmlFor="allergy-level">Schweregrad der Allergie</Label>
              <Select
                value={allergyState.level}
                onValueChange={(value) => setAllergyState((prev) => ({ ...prev, level: value as AllergyLevel }))}
              >
                <SelectTrigger id="allergy-level" aria-label="Schweregrad der Allergie wählen">
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
            <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              {editingAllergyId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingAllergyId(null);
        setAllergyState({ allergen: "", level: AllergyLevel.MILD, symptoms: "", treatment: "", note: "" });
                  }}
                  className="w-full sm:w-auto"
                >
                  Abbrechen
                </Button>
              ) : null}
              <Button type="submit" disabled={allergySubmitting} className="w-full sm:w-auto">
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
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Maße</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sichtbar für dich und das Kostüm-Team. Bitte halte die Angaben aktuell.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="w-full sm:w-auto">
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {MEASUREMENT_TYPE_LABELS[measurement.type as MeasurementType] ?? measurement.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {measurement.value} {MEASUREMENT_UNIT_LABELS[measurement.unit as MeasurementUnit] ?? measurement.unit}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(measurement)} className="w-full sm:w-auto">
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
  const { suggestions: interestSuggestions, loading: suggestionsLoading } = useInterestSuggestions();
  const availableInterestSuggestions = useMemo(() => {
    const selected = new Set(state.items.map((item) => item.toLowerCase()));
    return interestSuggestions
      .filter((suggestion) => suggestion.name && !selected.has(suggestion.name.toLowerCase()))
      .slice(0, 12);
  }, [interestSuggestions, state.items]);

  useEffect(() => {
    setState({ items: interests, dirty: false });
  }, [interests]);

  const tryAddInterest = (rawValue: string) => {
    setError(null);
    const parsed = interestSchema.safeParse(rawValue);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültiges Interesse");
      return false;
    }
    const value = parsed.data;
    if (state.items.length >= MAX_INTERESTS_PER_USER) {
      setError(`Maximal ${MAX_INTERESTS_PER_USER} Interessen erlaubt.`);
      return false;
    }
    if (state.items.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      setError("Dieses Interesse ist bereits erfasst.");
      return false;
    }
    setState((prev) => ({ items: [...prev.items, value], dirty: true }));
    return true;
  };

  const handleInputChange = (value: string) => {
    if (!value) {
      setInput("");
      return;
    }

    if (!INTEREST_SEPARATOR_PATTERN.test(value)) {
      setInput(value);
      return;
    }

    const segments = value.split(INTEREST_SEPARATOR_SPLIT_PATTERN);
    const remainder = segments.pop() ?? "";

    segments.forEach((segment) => {
      const clean = segment.trim();
      if (clean) {
        tryAddInterest(clean);
      }
    });

    setInput(remainder.replace(/^\s+/, ""));
  };

  const addInterest = () => {
    if (tryAddInterest(input)) {
      setInput("");
    }
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
                onChange={(event) => handleInputChange(event.target.value)}
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

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Beliebte Tags</p>
            <div className="flex flex-wrap gap-2">
              {suggestionsLoading ? (
                <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>
              ) : availableInterestSuggestions.length > 0 ? (
                availableInterestSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => {
                      if (tryAddInterest(suggestion.name)) {
                        setInput("");
                      }
                    }}
                  >
                    <span>{suggestion.name}</span>
                    {suggestion.usage > 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {suggestion.usage}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Keine Vorschläge verfügbar.</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" onClick={resetInterests} disabled={!state.dirty} className="w-full sm:w-auto">
              Änderungen verwerfen
            </Button>
            <Button type="submit" disabled={!state.dirty || saving} className="w-full sm:w-auto">
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

export type OnboardingSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
  rolePreferences: ProfileClientProps["rolePreferences"];
  availableOnboardings: OnboardingSummary[];
  whatsappVisitedAt: string | null;
  onWhatsAppVisit?: () => Promise<{ visitedAt: string | null; alreadyVisited: boolean }>;
  dietaryPreference: { label: string | null; strictnessLabel: string | null };
  onFocusChange?: (focus: OnboardingFocus) => void;
};

export function OnboardingSection({
  onboarding,
  onOnboardingChange,
  rolePreferences,
  availableOnboardings,
  whatsappVisitedAt,
  onWhatsAppVisit,
  dietaryPreference,
  onFocusChange,
}: OnboardingSectionProps) {
  const whatsappLink = onboarding?.whatsappLink ?? null;
  const currentShow = onboarding?.show ?? null;
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
  const [showDialogOpen, setShowDialogOpen] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string>(() => currentShow?.id ?? "");
  const [showSubmitting, setShowSubmitting] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const hasOnboardingOptions = availableOnboardings.length > 0;
  const showTitle = currentShow?.title && currentShow.title.trim().length ? currentShow.title.trim() : null;
  const showYear = typeof currentShow?.year === "number" ? currentShow.year : null;
  const showLabel = currentShow
    ? showTitle
      ? showYear
        ? `${showTitle} (${showYear})`
        : showTitle
      : showYear
        ? `Produktion ${showYear}`
        : "Produktion"
    : "Noch keine Produktion verknüpft";
  const showHelper = currentShow
    ? currentShow.periodLabel ?? "Zeitraum wird noch geplant."
    : "Wähle eine Produktion, um mit dem Onboarding zu starten.";
  const showStatusLabel = currentShow ? ONBOARDING_STATUS_LABELS[currentShow.status] ?? currentShow.status : null;
  const { backgroundSuggestions, classSuggestions, activeTag, requiresClass } =
    useOnboardingBackgroundData(formState.background, {
      initialSuggestions: PROFILE_ONBOARDING_BACKGROUND_SUGGESTIONS,
    });
  const [whatsappSubmitting, setWhatsappSubmitting] = useState(false);
  const whatsappVisitedLabel = useMemo(() => formatDate(whatsappVisitedAt), [whatsappVisitedAt]);

  useEffect(() => {
    setSelectedShowId(currentShow?.id ?? "");
  }, [currentShow?.id]);

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  useEffect(() => {
    onFocusChange?.(formState.focus);
  }, [formState.focus, onFocusChange]);

  const handleShowAssign = async () => {
    if (!selectedShowId) {
      setShowError("Bitte wähle eine Produktion.");
      return;
    }

    setShowSubmitting(true);
    setShowError(null);

    try {
      const result = await startOnboardingAction(selectedShowId);
      if (!result.ok) {
        setShowError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.onboarding;
      const option = availableOnboardings.find((entry) => entry.id === payload.show.id) ?? null;
      const nextShow = {
        id: payload.show.id,
        title: payload.show.title,
        year: payload.show.year,
        periodLabel: option?.periodLabel ?? payload.show.periodLabel ?? null,
        status: (option?.status ?? payload.show.status ?? "draft") as OnboardingSummary["status"],
      } satisfies NonNullable<OnboardingProfile["show"]>;

      const nextOnboarding: OnboardingProfile = onboarding
        ? {
            ...onboarding,
            show: nextShow,
            whatsappLink: payload.whatsappLink,
            whatsappLinkVisitedAt: payload.whatsappLinkVisitedAt,
          }
        : {
            focus: (formState.focus as OnboardingFocus) ?? "acting",
            background: formState.background.trim() ? formState.background.trim() : null,
            backgroundClass: formState.backgroundClass.trim() ? formState.backgroundClass.trim() : null,
            notes: formState.notes.trim() ? formState.notes.trim() : null,
            memberSinceYear: formState.memberSinceYear
              ? Number.parseInt(formState.memberSinceYear, 10)
              : null,
            dietaryPreference: null,
            dietaryPreferenceStrictness: null,
            whatsappLinkVisitedAt: payload.whatsappLinkVisitedAt,
            updatedAt: null,
            preferences: rolePreferences,
            show: nextShow,
            whatsappLink: payload.whatsappLink,
          } satisfies OnboardingProfile;

      onOnboardingChange(nextOnboarding);
      toast.success(onboarding?.show ? "Produktion aktualisiert" : "Onboarding gestartet");
      setShowDialogOpen(false);
    } finally {
      setShowSubmitting(false);
    }
  };


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
        preferences: onboarding?.preferences ?? rolePreferences,
        show: onboarding?.show ?? null,
        whatsappLink: onboarding?.whatsappLink ?? null,
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
    if (!whatsappLink) {
      return;
    }

    if (!onWhatsAppVisit) {
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
      return;
    }

    setWhatsappSubmitting(true);
    try {
      const result = await onWhatsAppVisit();
      toast.success(result.alreadyVisited ? "WhatsApp-Link geöffnet" : "WhatsApp-Besuch vermerkt");
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
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{showLabel}</p>
              <p className="text-xs text-muted-foreground">{showHelper}</p>
            </div>
            {currentShow && showStatusLabel ? (
              <Badge
                variant="outline"
                className="self-start rounded-full border-border/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide"
              >
                {showStatusLabel}
              </Badge>
            ) : null}
          </div>
          {hasOnboardingOptions ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDialogOpen(true);
                  setShowError(null);
                }}
                className="w-full sm:w-auto"
              >
                {currentShow ? "Produktion wechseln" : "Onboarding starten"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aktuell sind keine Produktionen verfügbar.</p>
          )}
        </div>

        {whatsappLink ? (
          whatsappVisitedAt ? (
            <div className="flex flex-col flex-wrap items-start gap-3 text-sm sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {`WhatsApp-Onboarding bestätigt${
                  whatsappVisitedLabel ? ` am ${whatsappVisitedLabel}` : ""
                }.`}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleWhatsAppClick}
                disabled={whatsappSubmitting}
                className="w-full sm:w-auto"
              >
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
          ) : (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-4 text-sm",
                "border-primary/40 bg-primary/10 text-primary",
              )}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span>WhatsApp-Onboarding steht noch aus.</span>
              </div>
              <p className="text-xs text-primary/80">
                Öffne die Gruppe jetzt – wir markieren dich anschließend als informiert.
              </p>
              <Button size="sm" onClick={handleWhatsAppClick} disabled={whatsappSubmitting} className="w-full sm:w-auto">
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
          )
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label id="onboarding-focus-label">Onboarding-Fokus</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="onboarding-focus-label">
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
                    role="radio"
                    aria-checked={active}
                    className={cn(
                      "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition",
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

          <div className="flex flex-col items-stretch justify-end sm:flex-row sm:items-center">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
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

      <Dialog
        open={showDialogOpen}
        onOpenChange={(open) => {
          setShowDialogOpen(open);
          if (!open) {
            setShowError(null);
            setSelectedShowId(currentShow?.id ?? "");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Produktion auswählen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasOnboardingOptions ? (
              <div className="grid gap-2">
                {availableOnboardings.map((option) => {
                  const active = option.id === selectedShowId;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setSelectedShowId(option.id)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        active
                          ? "border-primary/60 bg-primary/10 shadow-sm"
                          : "border-border/60 bg-background hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{option.title}</p>
                          {option.periodLabel ? (
                            <p className="text-xs text-muted-foreground">{option.periodLabel}</p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/60 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
                        >
                          {ONBOARDING_STATUS_LABELS[option.status] ?? option.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        {active ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                            <span className="font-medium text-primary">Ausgewählt</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-muted-foreground">Auswählen</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Es sind keine Produktionen verfügbar.</p>
            )}
            {showError ? <p className="text-sm text-destructive">{showError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowDialogOpen(false)} disabled={showSubmitting}>
              Abbrechen
            </Button>
            <Button type="button" onClick={handleShowAssign} disabled={showSubmitting || !selectedShowId}>
              {showSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : currentShow ? (
                "Produktion wechseln"
              ) : (
                "Onboarding starten"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type RolePreferencesSectionProps = {
  focus: OnboardingFocus;
  onboarding: ProfileClientProps["onboarding"];
  rolePreferences: ProfileClientProps["rolePreferences"];
  onRolePreferencesChange: (next: ProfileClientProps["rolePreferences"]) => void;
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
};

export function RolePreferencesSection({
  focus,
  onboarding,
  rolePreferences,
  onRolePreferencesChange,
  onOnboardingChange,
}: RolePreferencesSectionProps) {
  const initialPreferences = useMemo(() => buildPreferenceFormState(rolePreferences), [rolePreferences]);
  const [preferenceForm, setPreferenceForm] = useState<RolePreferenceFormState>(initialPreferences);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceSubmitting, setPreferenceSubmitting] = useState(false);

  useEffect(() => {
    setPreferenceForm(initialPreferences);
  }, [initialPreferences]);

  const includesActing = focus === "acting" || focus === "both";
  const includesCrew = focus === "tech" || focus === "both";

  const toggleRolePreference = useCallback((domain: "acting" | "crew", code: string) => {
    setPreferenceForm((prev) => {
      const entries = domain === "acting" ? prev.acting : prev.crew;
      const nextEntries = entries.map((entry) => {
        if (entry.code !== code) {
          return entry;
        }
        const nextEnabled = !entry.enabled;
        const nextWeight = nextEnabled
          ? entry.weight > 0
            ? entry.weight
            : DEFAULT_ROLE_PREFERENCE_WEIGHT
          : entry.weight;
        return {
          ...entry,
          enabled: nextEnabled,
          weight: normalizeRolePreferenceWeight(nextWeight),
        } satisfies RolePreferenceFormEntry;
      });
      return domain === "acting"
        ? { ...prev, acting: nextEntries }
        : { ...prev, crew: nextEntries };
    });
  }, []);

  const changePreferenceWeight = useCallback((domain: "acting" | "crew", code: string, weight: number) => {
    const normalized = normalizeRolePreferenceWeight(weight);
    setPreferenceForm((prev) => {
      const entries = domain === "acting" ? prev.acting : prev.crew;
      const nextEntries = entries.map((entry) =>
        entry.code === code ? { ...entry, weight: normalized } : entry,
      );
      return domain === "acting"
        ? { ...prev, acting: nextEntries }
        : { ...prev, crew: nextEntries };
    });
  }, []);

  const handlePreferenceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreferenceError(null);
    if (preferenceSubmitting) {
      return;
    }

    const payload: SaveRolePreferencesInput[] = [
      ...preferenceForm.acting
        .filter((pref) => pref.enabled && pref.weight > 0)
        .map((pref) => ({ code: pref.code, domain: "acting" as const, weight: pref.weight })),
      ...preferenceForm.crew
        .filter((pref) => pref.enabled && pref.weight > 0)
        .map((pref) => ({ code: pref.code, domain: "crew" as const, weight: pref.weight })),
    ];

    if (!payload.length) {
      setPreferenceError("Bitte wähle mindestens eine Präferenz aus.");
      return;
    }

    setPreferenceSubmitting(true);
    try {
      const result = await saveRolePreferencesAction(payload);
      if (!result.ok) {
        setPreferenceError(result.error);
        toast.error(result.error);
        return;
      }

      const saved = result.data.preferences;
      onRolePreferencesChange(saved);
      if (onboarding) {
        onOnboardingChange({ ...onboarding, preferences: saved });
      }
      setPreferenceForm(buildPreferenceFormState(saved));
      toast.success("Präferenzen gespeichert");
    } finally {
      setPreferenceSubmitting(false);
    }
  };

  const actingPreferences = preferenceForm.acting;
  const crewPreferences = preferenceForm.crew;
  const actingDisabled = !includesActing;
  const crewDisabled = !includesCrew;

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Rollenpräferenzen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Markiere, in welchen Bereichen du aktiv sein möchtest und wie intensiv du dich einbringen willst.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-6" onSubmit={handlePreferenceSubmit}>
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Schauspiel</h4>
                {!includesActing ? (
                  <span className="text-xs text-muted-foreground">
                    Fokus auf Schauspiel aktivieren, um diese Auswahl zu bearbeiten.
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {actingPreferences.map((pref) => {
                  const weightLabel = getRolePreferenceWeightLabel(pref.weight);
                  return (
                    <div
                      key={pref.code}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-4 transition",
                        pref.enabled ? "border-primary bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-medium">{pref.title}</h5>
                            {pref.isCustom ? (
                              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                Individuell
                              </Badge>
                            ) : null}
                          </div>
                          {pref.description ? (
                            <p className="text-xs text-muted-foreground">{pref.description}</p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={pref.enabled ? "default" : "outline"}
                          onClick={() => toggleRolePreference("acting", pref.code)}
                          disabled={actingDisabled}
                          className="w-full sm:w-auto"
                        >
                          {pref.enabled ? "Ausgewählt" : "Wählen"}
                        </Button>
                      </div>
                      {pref.enabled ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={10}
                            value={pref.weight}
                            onChange={(event) =>
                              changePreferenceWeight("acting", pref.code, event.currentTarget.valueAsNumber)
                            }
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Intensität</span>
                            <span>{weightLabel}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Gewerke</h4>
                {!includesCrew ? (
                  <span className="text-xs text-muted-foreground">
                    Fokus auf Gewerke aktivieren, um diese Auswahl zu bearbeiten.
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {crewPreferences.map((pref) => {
                  const weightLabel = getRolePreferenceWeightLabel(pref.weight);
                  return (
                    <div
                      key={pref.code}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-4 transition",
                        pref.enabled ? "border-primary/70 bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-medium">{pref.title}</h5>
                            {pref.isCustom ? (
                              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                Individuell
                              </Badge>
                            ) : null}
                          </div>
                          {pref.description ? (
                            <p className="text-xs text-muted-foreground">{pref.description}</p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={pref.enabled ? "default" : "outline"}
                          onClick={() => toggleRolePreference("crew", pref.code)}
                          disabled={crewDisabled}
                          className="w-full sm:w-auto"
                        >
                          {pref.enabled ? "Ausgewählt" : "Wählen"}
                        </Button>
                      </div>
                      {pref.enabled ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={10}
                            value={pref.weight}
                            onChange={(event) =>
                              changePreferenceWeight("crew", pref.code, event.currentTarget.valueAsNumber)
                            }
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Intensität</span>
                            <span>{weightLabel}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {preferenceError ? <p className="text-sm text-destructive">{preferenceError}</p> : null}

          <div className="flex flex-col items-stretch justify-end sm:flex-row sm:items-center">
            <Button type="submit" disabled={preferenceSubmitting} className="w-full sm:w-auto">
              {preferenceSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Präferenzen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


