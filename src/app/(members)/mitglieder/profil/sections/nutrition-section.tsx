"use client";

import {
  CheckCircle2Icon,
  Loader2Icon,
  PencilIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { cn } from "@/lib/utils";
import { AllergyLevel } from "@prisma/client";
import { deleteAllergyAction, upsertAllergyAction } from "../actions/allergies";
import { saveDietaryPreferenceAction } from "../actions/dietary";
import {
  ProfileClientProps,
  Allergy,
  DietaryFormState,
  AllergyFormState,
  allergySchema,
  formatDate,
} from "../profile-shared";

type NutritionSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  allergies: Allergy[];
  onAllergiesChange: (next: Allergy[]) => void;
  onDietaryUpdated: (preference: { label: string | null; strictnessLabel: string | null }) => void;
};

export function NutritionSection({
  onboarding,
  allergies,
  onAllergiesChange,
  onDietaryUpdated,
}: NutritionSectionProps) {
  const initialDietary = useMemo(() => {
    const { style, customLabel } = parseDietaryStyleFromLabel(
      onboarding?.dietaryPreference ?? null,
    );
    const strictness = parseDietaryStrictnessFromLabel(
      onboarding?.dietaryPreferenceStrictness ?? null,
    );
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
    const strictness =
      style === "omnivore" || style === "none"
        ? DEFAULT_STRICTNESS_FOR_NONE
        : dietaryState.strictness;
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
        (entry) =>
          entry.id === updated.id ||
          entry.allergen.toLowerCase() === updated.allergen.toLowerCase(),
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
      setAllergyState({
        allergen: "",
        level: AllergyLevel.MILD,
        symptoms: "",
        treatment: "",
        note: "",
      });
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
        setAllergyState({
          allergen: "",
          level: AllergyLevel.MILD,
          symptoms: "",
          treatment: "",
          note: "",
        });
      }
    } finally {
      setAllergySubmitting(false);
    }
  };

  const dietaryDescription = useMemo(() => {
    const { label } = resolveDietaryStyleLabel(
      dietaryState.style,
      dietaryState.customLabel || undefined,
    );
    const strictnessLabel = resolveDietaryStrictnessLabel(
      dietaryState.style,
      dietaryState.strictness,
    );
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
                  onChange={(event) =>
                    setDietaryState((prev) => ({ ...prev, customLabel: event.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="dietary-strictness">Strengegrad</Label>
              <Select
                value={dietaryState.strictness}
                onValueChange={(value) =>
                  setDietaryState((prev) => ({
                    ...prev,
                    strictness: value as DietaryStrictnessOption,
                  }))
                }
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
              <CheckCircle2Icon className="h-5 w-5 text-success" aria-hidden="true" />
            </div>

            <div className="flex flex-col items-stretch justify-end sm:flex-row sm:items-center">
              <Button type="submit" disabled={dietarySubmitting} className="w-full sm:w-auto">
                {dietarySubmitting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
          <CardTitle className="text-base font-semibold">
            Allergien &amp; Unverträglichkeiten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleAllergySubmit}>
            <div className="space-y-2">
              <Label htmlFor="allergen">Allergen</Label>
              <Input
                id="allergen"
                value={allergyState.allergen}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, allergen: event.target.value }))
                }
                placeholder="z.B. Erdnüsse"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergy-level">Schweregrad der Allergie</Label>
              <Select
                value={allergyState.level}
                onValueChange={(value) =>
                  setAllergyState((prev) => ({ ...prev, level: value as AllergyLevel }))
                }
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
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, symptoms: event.target.value }))
                }
                placeholder="Beschreibe die typischen Symptome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment">Behandlung / Hinweise</Label>
              <Textarea
                id="treatment"
                value={allergyState.treatment}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, treatment: event.target.value }))
                }
                placeholder="Was hilft im Notfall?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Zusätzliche Notiz</Label>
              <Textarea
                id="note"
                value={allergyState.note}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, note: event.target.value }))
                }
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
                    setAllergyState({
                      allergen: "",
                      level: AllergyLevel.MILD,
                      symptoms: "",
                      treatment: "",
                      note: "",
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  Abbrechen
                </Button>
              ) : null}
              <Button type="submit" disabled={allergySubmitting} className="w-full sm:w-auto">
                {allergySubmitting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
                const style =
                  ALLERGY_LEVEL_STYLES[entry.level as AllergyLevel] ?? ALLERGY_LEVEL_STYLES.MILD;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border/60 bg-muted/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("border px-2 py-0.5 text-[11px]", style.badge)}>
                          {getAllergyLevelLabel(entry.level as AllergyLevel)}
                        </Badge>
                        <span className="font-medium text-foreground">{entry.allergen}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleAllergyEdit(entry)}
                        >
                          <PencilIcon className="h-3 w-3" aria-hidden="true" />
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/60 px-2 py-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleAllergyDelete(entry.allergen)}
                        >
                          <Trash2Icon className="h-3 w-3" aria-hidden="true" />
                          Entfernen
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {entry.symptoms ? <p>Symptome: {entry.symptoms}</p> : null}
                      {entry.treatment ? <p>Behandlung: {entry.treatment}</p> : null}
                      {entry.note ? <p>Hinweis: {entry.note}</p> : null}
                      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        <ShieldCheckIcon className="h-3 w-3" aria-hidden="true" />
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
