"use client";

import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
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
} from "../profile-shared";
import { ProfileField } from "./profile-fieldset";

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
  const [allergyDialogOpen, setAllergyDialogOpen] = useState(false);
  const [pendingDeleteAllergen, setPendingDeleteAllergen] = useState<string | null>(null);

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
      setAllergyDialogOpen(false);
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

  const handleAllergyCreate = () => {
    setEditingAllergyId(null);
    setAllergyError(null);
    setAllergyState({
      allergen: "",
      level: AllergyLevel.MILD,
      symptoms: "",
      treatment: "",
      note: "",
    });
    setAllergyDialogOpen(true);
  };

  const handleAllergyEdit = (entry: Allergy) => {
    setAllergyError(null);
    setAllergyDialogOpen(true);
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

  // Ohne gespeicherten Eintrag muss auch die Vorauswahl speicherbar sein.
  const dietaryDirty =
    !onboarding?.dietaryPreference ||
    JSON.stringify(dietaryState) !== JSON.stringify(initialDietary);
  const strictnessRelevant = dietaryState.style !== "omnivore" && dietaryState.style !== "none";

  return (
    <div className="space-y-4">
      <Card variant="plain" size="md">
        <form className="space-y-4" onSubmit={handleDietarySubmit}>
          <SectionHeader title="Ernährungsstil" as="h3" />
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Stil" htmlFor="dietary-style">
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
                <SelectTrigger id="dietary-style">
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
            </ProfileField>
            {strictnessRelevant ? (
              <ProfileField label="Wie streng?" htmlFor="dietary-strictness">
                <Select
                  value={dietaryState.strictness}
                  onValueChange={(value) =>
                    setDietaryState((prev) => ({
                      ...prev,
                      strictness: value as DietaryStrictnessOption,
                    }))
                  }
                >
                  <SelectTrigger id="dietary-strictness">
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
              </ProfileField>
            ) : null}
            {dietaryState.style === "custom" ? (
              <ProfileField label="Bezeichnung" htmlFor="customLabel" className="sm:col-span-2">
                <Input
                  id="customLabel"
                  value={dietaryState.customLabel}
                  onChange={(event) =>
                    setDietaryState((prev) => ({ ...prev, customLabel: event.target.value }))
                  }
                />
              </ProfileField>
            ) : null}
          </div>
          {dietaryError ? <p className="text-sm text-destructive">{dietaryError}</p> : null}
          <FormSaveBar
            dirty={dietaryDirty}
            submitting={dietarySubmitting}
            onReset={() => {
              setDietaryState(initialDietary);
              setDietaryError(null);
            }}
          />
        </form>
      </Card>

      <Card variant="plain" size="md" className="space-y-3">
        <SectionHeader
          title="Allergien & Unverträglichkeiten"
          as="h3"
          action={
            <Button type="button" size="sm" variant="outline" onClick={handleAllergyCreate}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Allergie
            </Button>
          }
        />
        {allergies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Allergien hinterlegt.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {allergies.map((entry) => {
              const style =
                ALLERGY_LEVEL_STYLES[entry.level as AllergyLevel] ?? ALLERGY_LEVEL_STYLES.MILD;
              const details = [entry.symptoms, entry.treatment, entry.note]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={entry.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {entry.allergen}
                      <Badge size="sm" className={cn("border", style.badge)}>
                        {getAllergyLevelLabel(entry.level as AllergyLevel)}
                      </Badge>
                    </p>
                    {details ? (
                      <p className="truncate text-xs text-muted-foreground">{details}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAllergyEdit(entry)}
                    aria-label={`${entry.allergen} bearbeiten`}
                  >
                    <EditIcon className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDeleteAllergen(entry.allergen)}
                    aria-label={`${entry.allergen} entfernen`}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={allergyDialogOpen} onOpenChange={setAllergyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAllergyId ? "Allergie bearbeiten" : "Allergie hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAllergySubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField label="Allergen" htmlFor="allergen">
                <Input
                  id="allergen"
                  value={allergyState.allergen}
                  onChange={(event) =>
                    setAllergyState((prev) => ({ ...prev, allergen: event.target.value }))
                  }
                  placeholder="z. B. Erdnüsse"
                />
              </ProfileField>
              <ProfileField label="Schweregrad" htmlFor="allergy-level">
                <Select
                  value={allergyState.level}
                  onValueChange={(value) =>
                    setAllergyState((prev) => ({ ...prev, level: value as AllergyLevel }))
                  }
                >
                  <SelectTrigger id="allergy-level">
                    <SelectValue placeholder="Schweregrad wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AllergyLevel).map((level) => (
                      <SelectItem key={level} value={level}>
                        {getAllergyLevelLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ProfileField>
            </div>
            <ProfileField label="Symptome" htmlFor="symptoms">
              <Textarea
                id="symptoms"
                rows={2}
                value={allergyState.symptoms}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, symptoms: event.target.value }))
                }
              />
            </ProfileField>
            <ProfileField label="Was hilft im Notfall?" htmlFor="treatment">
              <Textarea
                id="treatment"
                rows={2}
                value={allergyState.treatment}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, treatment: event.target.value }))
                }
              />
            </ProfileField>
            <ProfileField label="Notiz" htmlFor="note">
              <Textarea
                id="note"
                rows={2}
                value={allergyState.note}
                onChange={(event) =>
                  setAllergyState((prev) => ({ ...prev, note: event.target.value }))
                }
              />
            </ProfileField>
            {allergyError ? <p className="text-sm text-destructive">{allergyError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllergyDialogOpen(false)}>
                Abbrechen
              </Button>
              <AsyncButton type="submit" isLoading={allergySubmitting} loadingText="Speichern…">
                Speichern
              </AsyncButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteAllergen !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteAllergen(null);
        }}
        title="Allergie entfernen?"
        description={`${pendingDeleteAllergen ?? ""} wird aus deinem Profil gelöscht.`}
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setPendingDeleteAllergen(null)}
        onConfirm={() => {
          const allergen = pendingDeleteAllergen;
          setPendingDeleteAllergen(null);
          if (allergen) void handleAllergyDelete(allergen);
        }}
      />
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
