import type { MemberHistory } from "@/lib/member-history";
import { z } from "zod";
import { type DietaryStrictnessOption, type DietaryStyleOption } from "@/data/dietary-preferences";
import {
  getRolePreferenceDescription,
  getRolePreferenceTitle,
  listRolePreferenceDefinitions,
} from "@/lib/onboarding/role-preferences";
import { normalizeRolePreferenceWeight } from "@/lib/onboarding/role-preference-utils";
import { isPaymentDetailsComplete, type ProfileCompletionSummary } from "@/lib/profile-completion";
import { getUserDisplayName } from "@/lib/names";
import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import { AllergyLevel, type OnboardingFocus, type PayoutMethod, type Role } from "@prisma/client";
import { type UpdateProfileBasicsResult } from "./actions/basics";

export const CURRENT_YEAR = new Date().getFullYear();
export const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
export const PROFILE_ONBOARDING_BACKGROUND_SUGGESTIONS = ["Schule", "Ausbildung", "Beruf"] as const;

export const ROLE_PREFERENCE_DEFINITIONS = {
  acting: listRolePreferenceDefinitions("acting"),
  crew: listRolePreferenceDefinitions("crew"),
} as const;

export const DEFAULT_ROLE_PREFERENCE_WEIGHT = 60;
export const ONBOARDING_FOCUS_LABELS: Record<OnboardingFocus, string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};
export const ONBOARDING_STATUS_LABELS: Record<OnboardingSummary["status"], string> = {
  draft: "In Vorbereitung",
  active: "Aktiv",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

export type RolePreferenceFormEntry = {
  code: string;
  title: string;
  description: string | null;
  domain: "acting" | "crew";
  weight: number;
  enabled: boolean;
  isCustom: boolean;
};

export type RolePreferenceFormState = {
  acting: RolePreferenceFormEntry[];
  crew: RolePreferenceFormEntry[];
};

export function buildPreferenceFormState(
  preferences: ProfileClientProps["rolePreferences"],
): RolePreferenceFormState {
  const remaining = new Map(preferences.map((pref) => [pref.code, pref]));

  const acting: RolePreferenceFormEntry[] = ROLE_PREFERENCE_DEFINITIONS.acting.map((definition) => {
    const existing = remaining.get(definition.code);
    if (existing) {
      remaining.delete(definition.code);
    }
    const weight = existing
      ? normalizeRolePreferenceWeight(existing.weight)
      : DEFAULT_ROLE_PREFERENCE_WEIGHT;
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
    const weight = existing
      ? normalizeRolePreferenceWeight(existing.weight)
      : DEFAULT_ROLE_PREFERENCE_WEIGHT;
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

export const PAYOUT_METHOD_OPTIONS: Array<{ value: PayoutMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Banküberweisung" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "OTHER", label: "Andere Option" },
];

export const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[0-9A-Z]{11,30}$/;
export const PAYPAL_HANDLE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?paypal\.me\/.+|^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

export function formatDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return dateFormatter.format(date);
}

export type ProfileClientProps = {
  history: MemberHistory;
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
    show: {
      id: string;
      title: string | null;
      year: number | null;
      periodLabel: string | null;
      status: OnboardingSummary["status"];
    } | null;
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
  checklist: ProfileCompletionSummary;
  /** Label der Produktion, aus der die Rollenwünsche als Vorschlag stammen. */
  rolePreferencesInheritedFrom: string | null;
};

export type ProfileUser = ProfileClientProps["user"];
export type Allergy = ProfileClientProps["allergies"][number];
export type OnboardingProfile = NonNullable<ProfileClientProps["onboarding"]>;

export function isProfilePaymentComplete(user: ProfileUser): boolean {
  return isPaymentDetailsComplete({
    payoutMethod: user.payoutMethod,
    payoutAccountHolder: user.payoutAccountHolder,
    payoutIban: user.payoutIban,
    payoutBankName: user.payoutBankName,
    payoutPaypalHandle: user.payoutPaypalHandle,
    payoutNote: user.payoutNote,
  });
}

export function mapUpdatedUserFromPayload(
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

export type BasicsFormState = {
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

export type PaymentFormState = {
  payoutMethod: PayoutMethod;
  payoutAccountHolder: string;
  payoutIban: string;
  payoutBankName: string;
  payoutPaypalHandle: string;
  payoutNote: string;
};

export type DietaryFormState = {
  style: DietaryStyleOption;
  customLabel: string;
  strictness: DietaryStrictnessOption;
};

export type AllergyFormState = {
  allergen: string;
  level: AllergyLevel;
  symptoms: string;
  treatment: string;
  note: string;
};

export type InterestsState = {
  items: string[];
  dirty: boolean;
};

export type OnboardingFormState = {
  background: string;
  backgroundClass: string;
  notes: string;
  memberSinceYear: string;
};

export const payoutDetailsSchemaBase = z.object({
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

export type PayoutDetailsData = z.infer<typeof payoutDetailsSchemaBase>;

export function validatePayoutDetails(data: PayoutDetailsData, ctx: z.RefinementCtx) {
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

export const payoutDetailsSchema = payoutDetailsSchemaBase.superRefine(validatePayoutDetails);

export const basicsSchema = z
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
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwort muss mindestens 6 Zeichen haben",
        path: ["password"],
      });
    }
    if (data.password && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwörter stimmen nicht überein",
        path: ["confirmPassword"],
      });
    }
  });

export const allergySchema = z.object({
  allergen: z.string().trim().min(2, "Bitte gib ein Allergen an").max(160),
  level: z.nativeEnum(AllergyLevel),
  symptoms: z.string().trim().max(500).optional(),
  treatment: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

export const onboardingSchema = z.object({
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

export const interestSchema = z
  .string()
  .trim()
  .min(2, "Interesse ist zu kurz")
  .max(80, "Interesse ist zu lang");

export const INTEREST_SEPARATOR_PATTERN = /[;,\n]/;
export const INTEREST_SEPARATOR_SPLIT_PATTERN = /[,;\n]+/;

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return dateFormatter.format(parsed);
}
