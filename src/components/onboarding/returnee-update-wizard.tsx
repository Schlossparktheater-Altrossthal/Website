"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findMatchingWishWeight, type CrewWishOption } from "@/lib/onboarding/crew-wish-option";
import {
  getRolePreferenceDefinition,
  getRolePreferenceTitle,
  listRolePreferenceDefinitions,
} from "@/lib/onboarding/role-preferences";
import { EducationFields } from "@/components/onboarding/education-fields";
import {
  readStoredEducation,
  toEducationPayload,
  validateEducation,
  type EducationValue,
} from "@/lib/education/schools";
import { InterestTagInput } from "@/components/members/interest-tag-input";
import {
  RolePreferenceLevelHint,
  RolePreferenceLevelPicker,
} from "@/components/onboarding/role-preference-level-picker";
import { SignaturePad, type SignatureResult } from "@/components/onboarding/signature-pad";
import { AllergenField } from "@/components/forms/allergen-field";
import { ALLERGEN_KIND_OPTIONS } from "@/data/allergens";
import {
  ALLERGY_LEVEL_OPTIONS,
  ALLERGY_TRACES_OPTIONS,
  fromAllergyTracesChoice,
  toAllergyTracesChoice,
  type AllergyTracesChoice,
} from "@/data/allergy-styles";
import {
  DEFAULT_STRICTNESS,
  DIETARY_STRICTNESS_OPTIONS,
  DIETARY_STYLE_OPTIONS,
  DIETARY_VARIANT_OPTIONS,
  isStrictnessRelevant,
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  parseDietaryVariantFromLabel,
  supportsDietaryVariant,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
  type DietaryVariantOption,
} from "@/data/dietary-preferences";

type ExistingProfile = {
  educationCategory?: string | null;
  educationSchoolName?: string | null;
  educationClassName?: string | null;
  educationWorkDescription?: string | null;
  educationUniversityName?: string | null;
  educationOtherDescription?: string | null;
  focus?: string | null;
  notes?: string | null;
  dietaryPreference?: string | null;
  dietaryPreferenceVariant?: string | null;
  dietaryPreferenceStrictness?: string | null;
};

type ExistingDietary = {
  allergen: string;
  level: string;
  kind: string;
  tracesOk: boolean | null;
  diagnosed: boolean;
  symptoms: string | null;
  treatment: string | null;
  note: string | null;
};

type ExistingPreference = {
  code: string;
  domain: string;
  weight: number;
};

type PreferenceEntry = {
  code: string;
  domain: string;
  weight: number;
  enabled: boolean;
};

type ReturneeUpdateWizardProps = {
  existingProfile: ExistingProfile;
  existingDietary: ExistingDietary[];
  existingPreferences: ExistingPreference[];
  existingPhotoConsent: boolean | null;
  existingInterests: string[];
  dateOfBirth: string | null;
  isLoggedIn: boolean;
  onboardingToken?: string | null;
  /** Gewerks-Wünsche der Produktion (`listCrewWishOptions`). */
  crewOptions: CrewWishOption[];
};

type DietaryEntry = {
  id: string;
  allergen: string;
  level: string;
  kind: string;
  traces: AllergyTracesChoice;
  diagnosed: boolean;
  symptoms: string;
  treatment: string;
  note: string;
};

type FormState = {
  education: EducationValue;
  preferences: PreferenceEntry[];
  interests: string[];
  photoConsent: boolean;
  dietaryStyle: DietaryStyleOption;
  dietaryVariant: DietaryVariantOption | null;
  dietaryCustomLabel: string;
  dietaryStrictness: DietaryStrictnessOption;
  dietary: DietaryEntry[];
  notes: string;
};

const steps = [
  { title: "Schulisches / Berufliches" },
  { title: "Bereiche" },
  { title: "Interessen" },
  { title: "Fotos" },
  { title: "Essen & Hinweise" },
];

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function calculateAge(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

function createInitialState(
  existingProfile: ExistingProfile,
  existingDietary: ExistingDietary[],
  existingPreferences: ExistingPreference[],
  existingPhotoConsent: boolean | null,
  existingInterests: string[],
  crewOptions: CrewWishOption[],
): FormState {
  const existingPreferencesByCode = new Map(
    existingPreferences.map((preference) => [preference.code, preference]),
  );
  const actingPreferences: PreferenceEntry[] = listRolePreferenceDefinitions("acting").map(
    (definition) => {
      const existingPreference = existingPreferencesByCode.get(definition.code);
      return {
        code: definition.code,
        domain: definition.domain,
        enabled: Boolean(existingPreference),
        weight: existingPreference?.weight ?? 0,
      };
    },
  );
  const weightsByCode = new Map(
    existingPreferences
      .filter((preference) => preference.domain === "crew")
      .map((preference) => [preference.code, preference.weight]),
  );
  const crewPreferences: PreferenceEntry[] = crewOptions.map((option) => {
    const weight = findMatchingWishWeight(option, weightsByCode);
    return {
      code: option.code,
      domain: "crew",
      enabled: weight !== null,
      weight: weight ?? 0,
    };
  });
  return {
    education: readStoredEducation(existingProfile),
    preferences: [...actingPreferences, ...crewPreferences],
    interests: existingInterests,
    photoConsent: existingPhotoConsent ?? true,
    // Die gespeicherten Labels werden tolerant zurückgelesen, damit auch Altbestände passen.
    ...readStoredDietaryPreference(existingProfile),
    dietary: existingDietary.map((entry) => ({
      id: createId(),
      allergen: entry.allergen,
      level: entry.level,
      kind: entry.kind,
      traces: toAllergyTracesChoice(entry.tracesOk),
      diagnosed: entry.diagnosed,
      symptoms: entry.symptoms ?? "",
      treatment: entry.treatment ?? "",
      note: entry.note ?? "",
    })),
    notes: existingProfile.notes ?? "",
  };
}

/** Liest Stil, Unterform und Strenge aus den gespeicherten Labels zurück. */
function readStoredDietaryPreference(
  profile: ExistingProfile,
): Pick<FormState, "dietaryStyle" | "dietaryVariant" | "dietaryCustomLabel" | "dietaryStrictness"> {
  const { style, customLabel } = parseDietaryStyleFromLabel(profile.dietaryPreference);
  const storedVariant = parseDietaryVariantFromLabel(profile.dietaryPreferenceVariant);
  return {
    dietaryStyle: style,
    dietaryVariant: storedVariant && supportsDietaryVariant(style) ? storedVariant : null,
    dietaryCustomLabel: customLabel ?? "",
    dietaryStrictness: profile.dietaryPreferenceStrictness
      ? parseDietaryStrictnessFromLabel(profile.dietaryPreferenceStrictness)
      : DEFAULT_STRICTNESS,
  };
}

/** Übernommene Ernährungs-/Allergieangaben müssen für die neue Produktion bestätigt werden. */
export function needsDietaryConfirmation(
  profile: Pick<ExistingProfile, "dietaryPreference">,
  dietary: readonly ExistingDietary[],
): boolean {
  return dietary.length > 0 || Boolean(profile.dietaryPreference?.trim());
}

export function ReturneeUpdateWizard({
  existingProfile,
  existingDietary,
  existingPreferences,
  existingPhotoConsent,
  existingInterests,
  dateOfBirth,
  isLoggedIn,
  onboardingToken,
  crewOptions,
}: ReturneeUpdateWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    createInitialState(
      existingProfile,
      existingDietary,
      existingPreferences,
      existingPhotoConsent,
      existingInterests,
      crewOptions,
    ),
  );
  const crewOptionsByCode = useMemo(
    () => new Map(crewOptions.map((option) => [option.code, option])),
    [crewOptions],
  );
  const [documentMode, setDocumentMode] = useState<"upload" | "signature">("upload");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  // Übernommene Ernährungs- und Allergieangaben müssen für die neue Produktion bestätigt werden.
  const hasPrefilledDietary = needsDietaryConfirmation(existingProfile, existingDietary);
  const [dietaryConfirmed, setDietaryConfirmed] = useState(false);

  const age = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);
  const isMinor = age !== null && age < 18;

  const selectedPreferences = useMemo(
    () => form.preferences.filter((preference) => preference.enabled),
    [form.preferences],
  );

  const setDocumentFromSignature = (result: SignatureResult | null) => {
    if (!result) {
      setDocumentFile(null);
      setDocumentError(null);
      return;
    }
    const dataUrl = result.dataUrl;
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      setDocumentError("Unterschrift konnte nicht verarbeitet werden.");
      setDocumentFile(null);
      return;
    }
    const header = dataUrl.slice(0, commaIndex);
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = (mimeMatch?.[1] ?? "image/png").toLowerCase();
    const base64 = dataUrl.slice(commaIndex + 1);
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const file = new File([bytes], "signature.png", { type: mime || "image/png" });
      setDocumentFile(file);
      setDocumentError(null);
    } catch (conversionError) {
      console.error("[returnee-update-wizard.signature]", conversionError);
      setDocumentError("Unterschrift konnte nicht verarbeitet werden.");
      setDocumentFile(null);
    }
  };

  const handleDocumentInput = (file: File | null) => {
    if (!file) {
      setDocumentFile(null);
      setDocumentError(null);
      return;
    }
    setDocumentFile(file);
    setDocumentError(null);
    if (documentMode !== "upload") {
      setDocumentMode("upload");
    }
  };

  const handleSelectSignatureMode = () => {
    if (isMinor) return;
    setDocumentMode("signature");
    setDocumentFile(null);
  };

  const handleSignatureChange = (result: SignatureResult | null) => {
    if (documentMode !== "signature") {
      setDocumentMode("signature");
    }
    setSignatureResult(result);
    setDocumentFromSignature(result);
  };

  const handleDownloadParentalTemplate = async () => {
    setDocumentError(null);
    try {
      const response = await fetch("/api/photo-consents/parental-template");
      if (!response.ok) {
        setDocumentError("Das Elternformular konnte nicht heruntergeladen werden.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "einverstaendnis-eltern.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("[returnee-update-wizard.parental-template]", downloadError);
      setDocumentError("Das Elternformular konnte nicht heruntergeladen werden.");
    }
  };

  const updatePreference = (code: string, updates: Partial<PreferenceEntry>) => {
    setForm((prev) => ({
      ...prev,
      preferences: prev.preferences.map((preference) =>
        preference.code === code ? { ...preference, ...updates } : preference,
      ),
    }));
  };

  const addDietaryEntry = () => {
    setForm((prev) => ({
      ...prev,
      dietary: [
        ...prev.dietary,
        {
          id: createId(),
          allergen: "",
          level: "MILD",
          kind: "ALLERGY",
          traces: "unset",
          diagnosed: false,
          symptoms: "",
          treatment: "",
          note: "",
        },
      ],
    }));
  };

  const updateDietaryEntry = (id: string, updates: Partial<Omit<DietaryEntry, "id">>) => {
    setForm((prev) => ({
      ...prev,
      dietary: prev.dietary.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)),
    }));
  };

  const removeDietaryEntry = (id: string) => {
    setForm((prev) => ({ ...prev, dietary: prev.dietary.filter((entry) => entry.id !== id) }));
  };

  const goNext = () => {
    setError(null);
    if (step === 0) {
      const educationError = validateEducation(form.education);
      if (educationError) {
        setError(educationError);
        return;
      }
    }
    if (step === 1 && !selectedPreferences.length) {
      setError("Bitte wähle mindestens einen Bereich aus.");
      return;
    }
    if (step === 3) {
      // Wie im Onboarding: Ohne Zustimmung braucht es kein Formular.
      if (form.photoConsent && !documentFile) {
        setError(
          isMinor
            ? "Bitte lade das unterschriebene Elternformular hoch."
            : "Bitte lade ein Dokument hoch oder unterschreibe digital.",
        );
        return;
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);

    if (!selectedPreferences.length) {
      setError("Bitte wähle mindestens einen Bereich aus.");
      setStep(1);
      return;
    }

    if (hasPrefilledDietary && !dietaryConfirmed) {
      setError("Bitte bestätige, dass deine Angaben zu Ernährung und Allergien noch stimmen.");
      setStep(4);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...toEducationPayload(form.education),
        preferences: selectedPreferences.map((preference) => ({
          code: preference.code,
          domain: preference.domain,
          weight: preference.weight,
        })),
        interests: form.interests,
        photoConsent: form.photoConsent,
        dietaryPreference: {
          style: form.dietaryStyle,
          variant: supportsDietaryVariant(form.dietaryStyle) ? form.dietaryVariant : null,
          customLabel: form.dietaryStyle === "custom" ? form.dietaryCustomLabel.trim() : null,
          strictness: form.dietaryStrictness,
        },
        dietary: form.dietary
          .filter((entry) => entry.allergen.trim().length > 0)
          .map((entry) => ({
            allergen: entry.allergen.trim(),
            level: entry.level,
            kind: entry.kind,
            tracesOk: fromAllergyTracesChoice(entry.traces),
            diagnosed: entry.diagnosed,
            symptoms: entry.symptoms.trim() || null,
            treatment: entry.treatment.trim() || null,
            note: entry.note.trim() || null,
          })),
        notes: form.notes.trim() || null,
      };

      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
      if (documentFile) {
        body.append("document", documentFile);
      }
      if (onboardingToken) {
        body.append("onboardingToken", onboardingToken);
      }

      const response = await fetch("/api/onboarding/update", {
        method: "POST",
        body,
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Speichern fehlgeschlagen.");
        return;
      }

      router.push(isLoggedIn ? "/mitglieder" : "/login");
    } catch (submitError) {
      console.error("[returnee-update-wizard]", submitError);
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <nav
        aria-label="Fortschritt"
        className="rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm"
      >
        <ol className="flex flex-wrap items-center gap-3">
          {steps.map((item, index) => {
            const isActive = index === step;
            const isComplete = index < step;
            return (
              <li key={item.title} className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (index < step) {
                      setError(null);
                      setStep(index);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg bg-transparent px-2 py-1 text-left focus-visible:outline-none",
                    index < step ? "cursor-pointer" : "cursor-default",
                  )}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Schritt ${index + 1}: ${item.title}`}
                  disabled={index > step}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isComplete && !isActive && "border-primary bg-primary/20 text-primary",
                      !isActive && !isComplete && "border-border text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {isComplete ? <CheckIcon className="h-4 w-4" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium sm:text-sm",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <div className="hidden h-px w-8 bg-border sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="border border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">{steps[step].title}</CardTitle>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 ? (
            <EducationFields
              value={form.education}
              onChange={(education) => setForm((prev) => ({ ...prev, education }))}
            />
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <RolePreferenceLevelHint />
              {(["acting", "crew"] as const).map((domain) => (
                <div key={domain} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {domain === "acting" ? "Schauspiel" : "Gewerke & Teams"}
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {form.preferences
                      .filter((preference) => preference.domain === domain)
                      .map((preference) => (
                        <RolePreferenceLevelPicker
                          key={preference.code}
                          title={
                            crewOptionsByCode.get(preference.code)?.title ??
                            getRolePreferenceTitle(preference.code)
                          }
                          description={
                            crewOptionsByCode.get(preference.code)?.description ??
                            getRolePreferenceDefinition(preference.code)?.description
                          }
                          enabled={preference.enabled}
                          weight={preference.weight}
                          onChange={(weight) =>
                            updatePreference(
                              preference.code,
                              weight === null ? { enabled: false } : { enabled: true, weight },
                            )
                          }
                        />
                      ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Stimmen deine Interessen noch? Sie helfen bei der Einteilung in Teams und Workshops.
              </p>
              <InterestTagInput
                id="returnee-interests"
                label="Deine Interessen"
                value={form.interests}
                onChange={(interests) => setForm((prev) => ({ ...prev, interests }))}
              />
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
                <Checkbox
                  checked={form.photoConsent}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, photoConsent: checked === true }))
                  }
                />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    Ich bin einverstanden, dass Fotos/Videos von mir für das Schultheater genutzt
                    werden.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Die Zustimmung kann jederzeit im Profil angepasst werden.
                  </p>
                </div>
              </label>

              {isMinor ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted p-4 text-sm">
                    <p className="font-medium">Zustimmung der Erziehungsberechtigten</p>
                    <p className="text-xs text-muted-foreground">
                      Da du noch minderjährig bist, benötigen wir die unterschriebene
                      Einverständniserklärung deiner Erziehungsberechtigten. Lade sie als PDF oder
                      Bilddatei (JPG/PNG) hoch.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={handleDownloadParentalTemplate}>
                    Elternformular herunterladen
                  </Button>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Unterschriebenes Elternformular (PDF, JPG, PNG)
                    </label>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(event) => handleDocumentInput(event.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {documentFile
                        ? `Ausgewählt: ${documentFile.name}`
                        : "Lade das unterschriebene Formular deiner Erziehungsberechtigten hoch."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-primary"
                      onClick={() => documentInputRef.current?.click()}
                    >
                      Unterschrift hochladen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-primary"
                      onClick={handleSelectSignatureMode}
                    >
                      Digital unterschreiben
                    </Button>
                  </div>
                  <input
                    ref={documentInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(event) => handleDocumentInput(event.target.files?.[0] ?? null)}
                  />
                  {documentMode === "signature" ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Digital unterschreiben</label>
                      <SignaturePad value={signatureResult} onChange={handleSignatureChange} />
                      <p className="text-xs text-muted-foreground">
                        {documentFile
                          ? "Deine digitale Unterschrift ist hinterlegt."
                          : "Zeichne deine Unterschrift mit Finger, Stift oder Maus."}
                      </p>
                    </div>
                  ) : null}
                  {documentFile ? (
                    <p className="text-xs text-muted-foreground">
                      Ausgewählt: <span className="min-w-0 truncate">{documentFile.name}</span>
                    </p>
                  ) : null}
                </div>
              )}

              {documentError ? <p className="text-xs text-destructive">{documentError}</p> : null}
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-6">
              {hasPrefilledDietary ? (
                <p className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                  Diese Angaben stammen aus deinem letzten Onboarding. Bitte prüfe sie – vor allem
                  Allergien und Unverträglichkeiten – und passe sie an, falls sich etwas geändert
                  hat.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Ernährungsstil</span>
                  <Select
                    value={form.dietaryStyle}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        dietaryStyle: value as DietaryStyleOption,
                        dietaryCustomLabel: value === "custom" ? prev.dietaryCustomLabel : "",
                        dietaryVariant: supportsDietaryVariant(value as DietaryStyleOption)
                          ? prev.dietaryVariant
                          : null,
                      }))
                    }
                  >
                    <SelectTrigger id="returnee-dietary-style">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIETARY_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {supportsDietaryVariant(form.dietaryStyle) ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Unterform</span>
                    <Select
                      value={form.dietaryVariant ?? "unset"}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          dietaryVariant:
                            value === "unset" ? null : (value as DietaryVariantOption),
                        }))
                      }
                    >
                      <SelectTrigger id="returnee-dietary-variant">
                        <SelectValue placeholder="Nicht angegeben" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Nicht angegeben</SelectItem>
                        {DIETARY_VARIANT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="block text-xs text-muted-foreground">
                      Gilt nur für Vegetarisch – Ei und Milch sind der Unterschied.
                    </span>
                  </label>
                ) : null}

                {form.dietaryStyle === "custom" ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Bezeichnung</span>
                    <Input
                      id="returnee-dietary-custom"
                      value={form.dietaryCustomLabel}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, dietaryCustomLabel: event.target.value }))
                      }
                      placeholder="Beschreibe deinen Ernährungsstil"
                    />
                  </label>
                ) : null}

                {isStrictnessRelevant(form.dietaryStyle) ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Wie streng?</span>
                    <Select
                      value={form.dietaryStrictness}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          dietaryStrictness: value as DietaryStrictnessOption,
                        }))
                      }
                    >
                      <SelectTrigger id="returnee-dietary-strictness">
                        <SelectValue placeholder="Bitte wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIETARY_STRICTNESS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}
              </div>

              <div className="space-y-4">
                {form.dietary.map((entry) => (
                  <div key={entry.id} className="space-y-4 rounded-xl border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium">Allergie oder Unverträglichkeit</span>
                          <AllergenField
                            value={entry.allergen}
                            onChange={(value) => updateDietaryEntry(entry.id, { allergen: value })}
                            onSelectEntry={(catalogEntry) =>
                              updateDietaryEntry(entry.id, { kind: catalogEntry.kind })
                            }
                            placeholder="z.B. Erdnüsse"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ALLERGY_LEVEL_OPTIONS.map((option) => {
                            const active = entry.level === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  updateDietaryEntry(entry.id, { level: option.value })
                                }
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs transition",
                                  active
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground",
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDietaryEntry(entry.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        Entfernen
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Art</span>
                        <Select
                          value={entry.kind}
                          onValueChange={(value) => updateDietaryEntry(entry.id, { kind: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALLERGEN_KIND_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Spuren</span>
                        <Select
                          value={entry.traces}
                          onValueChange={(value) =>
                            updateDietaryEntry(entry.id, {
                              traces: value as AllergyTracesChoice,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALLERGY_TRACES_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {entry.traces === "unset" ? (
                          <span className="block text-xs text-muted-foreground">
                            Ohne Angabe behandelt die Küche den Eintrag als ungeklärt.
                          </span>
                        ) : null}
                      </label>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <Checkbox
                        id={`returnee-dietary-diagnosed-${entry.id}`}
                        checked={entry.diagnosed}
                        onCheckedChange={(checked) =>
                          updateDietaryEntry(entry.id, { diagnosed: checked === true })
                        }
                      />
                      <label htmlFor={`returnee-dietary-diagnosed-${entry.id}`}>
                        Ärztlich abgeklärt
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Textarea
                        value={entry.symptoms}
                        onChange={(event) =>
                          updateDietaryEntry(entry.id, { symptoms: event.target.value })
                        }
                        placeholder="Symptome"
                      />
                      <Textarea
                        value={entry.treatment}
                        onChange={(event) =>
                          updateDietaryEntry(entry.id, { treatment: event.target.value })
                        }
                        placeholder="Behandlung"
                      />
                      <Textarea
                        value={entry.note}
                        onChange={(event) =>
                          updateDietaryEntry(entry.id, { note: event.target.value })
                        }
                        placeholder="Hinweis"
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addDietaryEntry}>
                  <PlusIcon className="h-4 w-4" />
                  Allergie oder Unverträglichkeit hinzufügen
                </Button>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Hinweise</span>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Besondere Hinweise, Wünsche oder ergänzende Informationen"
                  className="min-h-[120px]"
                />
              </label>

              {hasPrefilledDietary ? (
                <div className="flex items-start gap-3 text-sm">
                  <Checkbox
                    id="returnee-dietary-confirmed"
                    checked={dietaryConfirmed}
                    onCheckedChange={(checked) => setDietaryConfirmed(checked === true)}
                  />
                  <label htmlFor="returnee-dietary-confirmed" className="font-medium">
                    Ich habe meine Angaben zu Ernährung, Allergien und Unverträglichkeiten geprüft –
                    sie stimmen so.
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 0 || loading}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Zurück
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" onClick={goNext} disabled={loading}>
                Weiter
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                Speichern
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
