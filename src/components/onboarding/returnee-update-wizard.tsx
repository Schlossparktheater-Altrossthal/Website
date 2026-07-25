"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  dietaryPreferenceStrictness?: string | null;
};

type ExistingDietary = {
  allergen: string;
  level: string;
  symptoms: string | null;
  treatment: string | null;
  note: string | null;
};

type ExistingPreference = {
  code: string;
  domain: string;
  weight: number;
};

type ReturneeUpdateWizardProps = {
  existingProfile: ExistingProfile;
  existingDietary: ExistingDietary[];
  existingPreferences: ExistingPreference[];
  existingPhotoConsent: boolean | null;
  isLoggedIn: boolean;
};

type EducationCategory = "school_bsz" | "school_other" | "work" | "university" | "other";

type DietaryEntry = {
  id: string;
  allergen: string;
  level: string;
  symptoms: string;
  treatment: string;
  note: string;
};

type FormState = {
  educationCategory: EducationCategory | "";
  schoolVariant: "bsz" | "other" | "";
  educationSchoolName: string;
  educationClassName: string;
  educationWorkDescription: string;
  educationUniversityName: string;
  educationOtherDescription: string;
  preferences: ExistingPreference[];
  photoConsent: boolean;
  dietaryPreference: string;
  dietaryPreferenceStrictness: string;
  dietary: DietaryEntry[];
  notes: string;
};

const steps = [
  { title: "Schulisches / Berufliches" },
  { title: "Bereiche" },
  { title: "Fotos" },
  { title: "Essen & Hinweise" },
];

const DIETARY_LEVEL_OPTIONS = [
  { value: "MILD", label: "Leicht" },
  { value: "MODERATE", label: "Mittel" },
  { value: "SEVERE", label: "Stark" },
  { value: "LETHAL", label: "Kritisch" },
];

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function normalizeEducationCategory(value: string | null | undefined): EducationCategory | "" {
  switch (value) {
    case "school_bsz":
    case "school_other":
    case "work":
    case "university":
    case "other":
      return value;
    default:
      return "";
  }
}

function createInitialState(
  existingProfile: ExistingProfile,
  existingDietary: ExistingDietary[],
  existingPreferences: ExistingPreference[],
  existingPhotoConsent: boolean | null,
): FormState {
  const educationCategory = normalizeEducationCategory(existingProfile.educationCategory);
  return {
    educationCategory,
    schoolVariant:
      educationCategory === "school_bsz"
        ? "bsz"
        : educationCategory === "school_other"
          ? "other"
          : "",
    educationSchoolName: existingProfile.educationSchoolName ?? "",
    educationClassName: existingProfile.educationClassName ?? "",
    educationWorkDescription: existingProfile.educationWorkDescription ?? "",
    educationUniversityName: existingProfile.educationUniversityName ?? "",
    educationOtherDescription: existingProfile.educationOtherDescription ?? "",
    preferences: existingPreferences.map((preference) => ({ ...preference })),
    photoConsent: existingPhotoConsent ?? true,
    dietaryPreference: existingProfile.dietaryPreference ?? "",
    dietaryPreferenceStrictness: existingProfile.dietaryPreferenceStrictness ?? "",
    dietary: existingDietary.map((entry) => ({
      id: createId(),
      allergen: entry.allergen,
      level: entry.level,
      symptoms: entry.symptoms ?? "",
      treatment: entry.treatment ?? "",
      note: entry.note ?? "",
    })),
    notes: existingProfile.notes ?? "",
  };
}

export function ReturneeUpdateWizard({
  existingProfile,
  existingDietary,
  existingPreferences,
  existingPhotoConsent,
  isLoggedIn,
}: ReturneeUpdateWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    createInitialState(existingProfile, existingDietary, existingPreferences, existingPhotoConsent),
  );

  const selectedPreferences = useMemo(
    () => form.preferences.filter((preference) => preference.weight > 0),
    [form.preferences],
  );

  const canContinueStep1 = useMemo(() => {
    if (!form.educationCategory) return false;
    if (form.educationCategory === "school_bsz") {
      return form.educationClassName.trim().length > 0;
    }
    if (form.educationCategory === "school_other") {
      return form.educationSchoolName.trim().length > 0;
    }
    if (form.educationCategory === "work") {
      return form.educationWorkDescription.trim().length > 0;
    }
    if (form.educationCategory === "university") {
      return form.educationUniversityName.trim().length > 0;
    }
    return form.educationOtherDescription.trim().length > 0;
  }, [
    form.educationCategory,
    form.educationClassName,
    form.educationOtherDescription,
    form.educationSchoolName,
    form.educationUniversityName,
    form.educationWorkDescription,
  ]);

  const updatePreference = (code: string, updates: Partial<ExistingPreference>) => {
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
    if (step === 0 && !canContinueStep1) {
      setError("Bitte fülle die Angaben zu Schule, Beruf, Universität oder Anderem vollständig aus.");
      return;
    }
    if (step === 1 && !selectedPreferences.length) {
      setError("Bitte wähle mindestens einen Bereich mit Gewichtung über 0.");
      return;
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
      setError("Bitte wähle mindestens einen Bereich mit Gewichtung über 0.");
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        educationCategory: form.educationCategory || null,
        educationSchoolName: form.educationSchoolName.trim() || null,
        educationClassName: form.educationClassName.trim() || null,
        educationWorkDescription: form.educationWorkDescription.trim() || null,
        educationUniversityName: form.educationUniversityName.trim() || null,
        educationOtherDescription: form.educationOtherDescription.trim() || null,
        preferences: selectedPreferences.map((preference) => ({
          code: preference.code,
          domain: preference.domain,
          weight: preference.weight,
        })),
        photoConsent: form.photoConsent,
        dietaryPreference: form.dietaryPreference.trim() || null,
        dietaryPreferenceStrictness: form.dietaryPreferenceStrictness.trim() || null,
        dietary: form.dietary
          .filter((entry) => entry.allergen.trim().length > 0)
          .map((entry) => ({
            allergen: entry.allergen.trim(),
            level: entry.level.trim(),
            symptoms: entry.symptoms.trim() || null,
            treatment: entry.treatment.trim() || null,
            note: entry.note.trim() || null,
          })),
        notes: form.notes.trim() || null,
      };

      const response = await fetch("/api/onboarding/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
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
      <nav aria-label="Fortschritt" className="rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
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
                  <span className={cn("text-xs font-medium sm:text-sm", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {item.title}
                  </span>
                </button>
                {index < steps.length - 1 ? <div className="hidden h-px w-8 bg-border sm:block" aria-hidden /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="border border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">{steps[step].title}</CardTitle>
          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["school", "work", "university", "other"] as const).map((choice) => {
                  const isActive =
                    choice === "school"
                      ? form.educationCategory === "school_bsz" || form.educationCategory === "school_other"
                      : form.educationCategory === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          educationCategory:
                            choice === "school"
                              ? "school_bsz"
                              : (choice as Exclude<EducationCategory, "school_bsz" | "school_other">),
                          schoolVariant: choice === "school" ? "bsz" : "",
                        }))
                      }
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground",
                      )}
                    >
                      {choice === "school"
                        ? "Schule"
                        : choice === "work"
                          ? "Beruf"
                          : choice === "university"
                            ? "Universität"
                            : "Anderes"}
                    </button>
                  );
                })}
              </div>

              {form.educationCategory === "school_bsz" || form.educationCategory === "school_other" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        form.schoolVariant === "bsz" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background",
                      )}
                      onClick={() => setForm((prev) => ({ ...prev, schoolVariant: "bsz", educationCategory: "school_bsz" }))}
                    >
                      BSZ für Agrarwirtschaft &amp; Ernährung Dresden
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        form.schoolVariant === "other" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background",
                      )}
                      onClick={() => setForm((prev) => ({ ...prev, schoolVariant: "other", educationCategory: "school_other" }))}
                    >
                      Andere Schule
                    </button>
                  </div>

                  {form.schoolVariant === "bsz" ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">Klasse</span>
                      <Input
                        value={form.educationClassName}
                        onChange={(event) => setForm((prev) => ({ ...prev, educationClassName: event.target.value }))}
                        placeholder="z.B. BFS 23A"
                      />
                    </label>
                  ) : form.schoolVariant === "other" ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">Schulname</span>
                      <Input
                        value={form.educationSchoolName}
                        onChange={(event) => setForm((prev) => ({ ...prev, educationSchoolName: event.target.value }))}
                        placeholder="Name deiner Schule"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {form.educationCategory === "work" ? (
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Beruf / Tätigkeit</span>
                  <Input
                    value={form.educationWorkDescription}
                    onChange={(event) => setForm((prev) => ({ ...prev, educationWorkDescription: event.target.value }))}
                    placeholder="z.B. Ausbildung, Job oder Tätigkeit"
                  />
                </label>
              ) : null}

              {form.educationCategory === "university" ? (
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Universität / Hochschule</span>
                  <Input
                    value={form.educationUniversityName}
                    onChange={(event) => setForm((prev) => ({ ...prev, educationUniversityName: event.target.value }))}
                    placeholder="Name deiner Hochschule"
                  />
                </label>
              ) : null}

              {form.educationCategory === "other" ? (
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Beschreibung</span>
                  <Input
                    value={form.educationOtherDescription}
                    onChange={(event) => setForm((prev) => ({ ...prev, educationOtherDescription: event.target.value }))}
                    placeholder="Was machst du aktuell?"
                  />
                </label>
              ) : null}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reiche nur die Bereiche ein, die aktuell für dich passen. Die Gewichtung bleibt erhalten.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {form.preferences.map((preference) => {
                  const active = preference.weight > 0;
                  return (
                    <div
                      key={preference.code}
                      className={cn(
                        "flex flex-col gap-4 rounded-xl border p-4",
                        active ? "border-primary bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-medium">{preference.code}</h4>
                          <p className="text-xs text-muted-foreground">Bereich: {preference.domain}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={active ? "primary" : "outline"}
                          onClick={() => updatePreference(preference.code, { weight: active ? 0 : 50 })}
                        >
                          {active ? "Aktiv" : "Wählen"}
                        </Button>
                      </div>
                      {active ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={10}
                            value={preference.weight}
                            onChange={(event) =>
                              updatePreference(preference.code, { weight: event.currentTarget.valueAsNumber })
                            }
                            onInput={(event) =>
                              updatePreference(preference.code, { weight: event.currentTarget.valueAsNumber })
                            }
                            className="w-full accent-primary"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Intensität</span>
                            <span>{preference.weight}%</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
                <Checkbox
                  checked={form.photoConsent}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, photoConsent: checked === true }))}
                />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Ich bin einverstanden, dass Fotos/Videos von mir für das Schultheater genutzt werden.</p>
                  <p className="text-xs text-muted-foreground">Die Zustimmung kann jederzeit im Profil angepasst werden.</p>
                </div>
              </label>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Ernährungsstil</span>
                  <Select
                    value={form.dietaryPreference}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, dietaryPreference: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="omnivore">Allesesser</SelectItem>
                      <SelectItem value="vegetarian">Vegetarisch</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="custom">Anders</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Wie konsequent hältst du dich daran?</span>
                  <Select
                    value={form.dietaryPreferenceStrictness}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, dietaryPreferenceStrictness: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">Flexibel</SelectItem>
                      <SelectItem value="mostly">Meistens</SelectItem>
                      <SelectItem value="strict">Streng</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="space-y-4">
                {form.dietary.map((entry) => (
                  <div key={entry.id} className="space-y-4 rounded-xl border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium">Unverträglichkeit</span>
                          <Input
                            value={entry.allergen}
                            onChange={(event) => updateDietaryEntry(entry.id, { allergen: event.target.value })}
                            placeholder="z.B. Erdnüsse"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DIETARY_LEVEL_OPTIONS.map((option) => {
                            const active = entry.level === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateDietaryEntry(entry.id, { level: option.value })}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs transition",
                                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeDietaryEntry(entry.id)}>
                        <TrashIcon className="h-4 w-4" />
                        Entfernen
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Textarea
                        value={entry.symptoms}
                        onChange={(event) => updateDietaryEntry(entry.id, { symptoms: event.target.value })}
                        placeholder="Symptome"
                      />
                      <Textarea
                        value={entry.treatment}
                        onChange={(event) => updateDietaryEntry(entry.id, { treatment: event.target.value })}
                        placeholder="Behandlung"
                      />
                      <Textarea
                        value={entry.note}
                        onChange={(event) => updateDietaryEntry(entry.id, { note: event.target.value })}
                        placeholder="Hinweis"
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addDietaryEntry}>
                  <PlusIcon className="h-4 w-4" />
                  Unverträglichkeit hinzufügen
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
            </section>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || loading}>
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
