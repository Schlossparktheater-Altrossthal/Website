"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { saveDietaryPreferenceAction } from "../actions/dietary";
import {
  type Allergy,
  type Aversion,
  type DietaryFormState,
  type ProfileClientProps,
} from "../profile-shared";
import { DietaryRestrictions } from "./dietary-restrictions";
import { ProfileField } from "./profile-fieldset";

type NutritionSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  allergies: Allergy[];
  onAllergiesChange: (next: Allergy[]) => void;
  aversions: Aversion[];
  onAversionsChange: (next: Aversion[]) => void;
  onDietaryUpdated: (preference: {
    label: string | null;
    variantLabel: string | null;
    strictnessLabel: string | null;
  }) => void;
};

export function NutritionSection({
  onboarding,
  allergies,
  onAllergiesChange,
  aversions,
  onAversionsChange,
  onDietaryUpdated,
}: NutritionSectionProps) {
  const initialDietary = useMemo(() => {
    const { style, customLabel } = parseDietaryStyleFromLabel(
      onboarding?.dietaryPreference ?? null,
    );
    return {
      style,
      variant: parseDietaryVariantFromLabel(onboarding?.dietaryPreferenceVariant ?? null),
      customLabel: customLabel ?? "",
      strictness: parseDietaryStrictnessFromLabel(onboarding?.dietaryPreferenceStrictness ?? null),
    } satisfies DietaryFormState;
  }, [
    onboarding?.dietaryPreference,
    onboarding?.dietaryPreferenceVariant,
    onboarding?.dietaryPreferenceStrictness,
  ]);

  const [dietaryState, setDietaryState] = useState<DietaryFormState>(initialDietary);
  const [dietaryError, setDietaryError] = useState<string | null>(null);
  const [dietarySubmitting, setDietarySubmitting] = useState(false);

  useEffect(() => {
    setDietaryState(initialDietary);
  }, [initialDietary]);

  const handleDietarySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDietaryError(null);

    const style = dietaryState.style;
    const strictness = style === "omnivore" ? DEFAULT_STRICTNESS : dietaryState.strictness;
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
        variant: supportsDietaryVariant(style) ? dietaryState.variant : null,
        customLabel: style === "custom" ? customLabel : undefined,
      });
      if (!result.ok) {
        setDietaryError(result.error);
        toast.error(result.error);
        return;
      }
      const preference = result.data.preference;
      onDietaryUpdated({
        label: preference.label,
        variantLabel: preference.variantLabel,
        strictnessLabel: preference.strictnessLabel,
      });
      toast.success("Ernährungsprofil gespeichert");
    } finally {
      setDietarySubmitting(false);
    }
  };

  // Ohne gespeicherten Eintrag muss auch die Vorauswahl speicherbar sein.
  const dietaryDirty =
    !onboarding?.dietaryPreference ||
    JSON.stringify(dietaryState) !== JSON.stringify(initialDietary);
  const strictnessRelevant = isStrictnessRelevant(dietaryState.style);
  const variantRelevant = supportsDietaryVariant(dietaryState.style);

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
                  setDietaryState((prev) => {
                    const nextStyle = value as DietaryStyleOption;
                    return {
                      ...prev,
                      style: nextStyle,
                      variant: supportsDietaryVariant(nextStyle) ? prev.variant : null,
                      strictness: nextStyle === "omnivore" ? DEFAULT_STRICTNESS : prev.strictness,
                    };
                  })
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
            {variantRelevant ? (
              <ProfileField label="Unterform" htmlFor="dietary-variant">
                <Select
                  value={dietaryState.variant ?? "unset"}
                  onValueChange={(value) =>
                    setDietaryState((prev) => ({
                      ...prev,
                      variant: value === "unset" ? null : (value as DietaryVariantOption),
                    }))
                  }
                >
                  <SelectTrigger id="dietary-variant">
                    <SelectValue placeholder="Unterform wählen" />
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
              </ProfileField>
            ) : null}
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
            dirtyLabel={
              onboarding?.dietaryPreference
                ? undefined
                : "Noch nicht gespeichert – bitte bestätigen"
            }
            submitting={dietarySubmitting}
            onReset={() => {
              setDietaryState(initialDietary);
              setDietaryError(null);
            }}
          />
        </form>
      </Card>

      <DietaryRestrictions
        allergies={allergies}
        onAllergiesChange={onAllergiesChange}
        aversions={aversions}
        onAversionsChange={onAversionsChange}
      />
    </div>
  );
}
