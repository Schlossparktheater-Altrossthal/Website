"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AllergenField } from "@/components/forms/allergen-field";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGEN_KIND_LABELS, ALLERGEN_KIND_OPTIONS } from "@/data/allergens";
import {
  ALLERGY_LEVEL_LABELS,
  ALLERGY_LEVEL_OPTIONS,
  ALLERGY_LEVEL_STYLES,
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
import { allergyInputSchema, aversionInputSchema } from "@/lib/profil/dietary-validation";
import { cn } from "@/lib/utils";
import { AllergyLevel, RestrictionKind } from "@prisma/client";
import { deleteAllergyAction, upsertAllergyAction } from "../actions/allergies";
import { deleteAversionAction, upsertAversionAction } from "../actions/aversions";
import { saveDietaryPreferenceAction } from "../actions/dietary";
import {
  type Allergy,
  type AllergyFormState,
  type Aversion,
  type AversionFormState,
  type DietaryFormState,
  type ProfileClientProps,
} from "../profile-shared";
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

const EMPTY_ALLERGY_FORM: AllergyFormState = {
  allergen: "",
  kind: RestrictionKind.ALLERGY,
  level: AllergyLevel.MILD,
  tracesOk: null,
  diagnosed: false,
  symptoms: "",
  treatment: "",
  note: "",
};

const EMPTY_AVERSION_FORM: AversionFormState = { label: "", note: "" };

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

  const [allergyState, setAllergyState] = useState<AllergyFormState>(EMPTY_ALLERGY_FORM);
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const [allergySubmitting, setAllergySubmitting] = useState(false);
  const [allergyDialogOpen, setAllergyDialogOpen] = useState(false);
  const [pendingDeleteAllergen, setPendingDeleteAllergen] = useState<string | null>(null);

  const [aversionState, setAversionState] = useState<AversionFormState>(EMPTY_AVERSION_FORM);
  const [editingAversionId, setEditingAversionId] = useState<string | null>(null);
  const [aversionError, setAversionError] = useState<string | null>(null);
  const [aversionSubmitting, setAversionSubmitting] = useState(false);
  const [aversionDialogOpen, setAversionDialogOpen] = useState(false);
  const [pendingDeleteAversion, setPendingDeleteAversion] = useState<string | null>(null);

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

  const handleAllergySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAllergyError(null);

    const parseResult = allergyInputSchema.safeParse({
      allergen: allergyState.allergen,
      kind: allergyState.kind,
      level: allergyState.level,
      tracesOk: allergyState.tracesOk,
      diagnosed: allergyState.diagnosed,
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
        kind: parseResult.data.kind,
        level: parseResult.data.level,
        tracesOk: parseResult.data.tracesOk,
        diagnosed: parseResult.data.diagnosed,
        symptoms: parseResult.data.symptoms,
        treatment: parseResult.data.treatment,
        note: parseResult.data.note,
      });
      if (!result.ok) {
        setAllergyError(result.error);
        toast.error(result.error);
        return;
      }
      const updated = result.data.allergy;
      const payload: Allergy = {
        id: updated.id,
        allergen: updated.allergen,
        kind: updated.kind,
        level: updated.level,
        tracesOk: updated.tracesOk,
        diagnosed: updated.diagnosed,
        symptoms: updated.symptoms,
        treatment: updated.treatment,
        note: updated.note,
        updatedAt: updated.updatedAt,
      };
      const nextAllergies = [...allergies];
      const index = nextAllergies.findIndex(
        (entry) =>
          entry.id === updated.id ||
          entry.allergen.toLowerCase() === updated.allergen.toLowerCase(),
      );
      if (index >= 0) {
        nextAllergies[index] = payload;
      } else {
        nextAllergies.push(payload);
      }
      nextAllergies.sort((a, b) => a.allergen.localeCompare(b.allergen, "de"));
      onAllergiesChange(nextAllergies);
      toast.success("Allergie gespeichert");
      setAllergyDialogOpen(false);
      setEditingAllergyId(null);
      setAllergyState(EMPTY_ALLERGY_FORM);
    } finally {
      setAllergySubmitting(false);
    }
  };

  const handleAllergyCreate = () => {
    setEditingAllergyId(null);
    setAllergyError(null);
    setAllergyState(EMPTY_ALLERGY_FORM);
    setAllergyDialogOpen(true);
  };

  const handleAllergyEdit = (entry: Allergy) => {
    setAllergyError(null);
    setAllergyDialogOpen(true);
    setEditingAllergyId(entry.id);
    setAllergyState({
      allergen: entry.allergen,
      kind: entry.kind as RestrictionKind,
      level: entry.level as AllergyLevel,
      tracesOk: entry.tracesOk,
      diagnosed: entry.diagnosed,
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
      onAllergiesChange(allergies.filter((entry) => entry.allergen !== allergen));
      toast.success("Allergie entfernt");
      if (editingAllergyId && allergyState.allergen === allergen) {
        setEditingAllergyId(null);
        setAllergyState(EMPTY_ALLERGY_FORM);
      }
    } finally {
      setAllergySubmitting(false);
    }
  };

  const handleAversionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAversionError(null);

    const parseResult = aversionInputSchema.safeParse({
      label: aversionState.label,
      note: aversionState.note || undefined,
    });

    if (!parseResult.success) {
      setAversionError(parseResult.error.issues[0]?.message ?? "Ungültige Eingaben");
      return;
    }

    setAversionSubmitting(true);
    try {
      const result = await upsertAversionAction({
        label: parseResult.data.label,
        note: parseResult.data.note,
      });
      if (!result.ok) {
        setAversionError(result.error);
        toast.error(result.error);
        return;
      }
      const updated = result.data.aversion;
      const payload: Aversion = {
        id: updated.id,
        label: updated.label,
        note: updated.note,
        updatedAt: updated.updatedAt,
      };
      const nextAversions = [...aversions];
      const index = nextAversions.findIndex(
        (entry) =>
          entry.id === updated.id || entry.label.toLowerCase() === updated.label.toLowerCase(),
      );
      if (index >= 0) {
        nextAversions[index] = payload;
      } else {
        nextAversions.push(payload);
      }
      nextAversions.sort((a, b) => a.label.localeCompare(b.label, "de"));
      onAversionsChange(nextAversions);
      toast.success("Besonderheit gespeichert");
      setAversionDialogOpen(false);
      setEditingAversionId(null);
      setAversionState(EMPTY_AVERSION_FORM);
    } finally {
      setAversionSubmitting(false);
    }
  };

  const handleAversionCreate = () => {
    setEditingAversionId(null);
    setAversionError(null);
    setAversionState(EMPTY_AVERSION_FORM);
    setAversionDialogOpen(true);
  };

  const handleAversionEdit = (entry: Aversion) => {
    setAversionError(null);
    setAversionDialogOpen(true);
    setEditingAversionId(entry.id);
    setAversionState({ label: entry.label, note: entry.note ?? "" });
  };

  const handleAversionDelete = async (label: string) => {
    setAversionSubmitting(true);
    try {
      const result = await deleteAversionAction(label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAversionsChange(aversions.filter((entry) => entry.label !== label));
      toast.success("Besonderheit entfernt");
      if (editingAversionId && aversionState.label === label) {
        setEditingAversionId(null);
        setAversionState(EMPTY_AVERSION_FORM);
      }
    } finally {
      setAversionSubmitting(false);
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
          <SectionHeader
            title="Ernährungsstil"
            as="h3"
            description="Damit die Verpflegung bei Proben und Aufführungen für alle passt."
          />
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
          title="Abneigungen & Besonderheiten"
          as="h3"
          description="Was du nicht magst oder nicht isst – ohne medizinischen Hintergrund."
          action={
            <Button type="button" size="sm" variant="outline" onClick={handleAversionCreate}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Besonderheit
            </Button>
          }
        />
        {aversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Besonderheiten hinterlegt.</p>
        ) : (
          <ul className="divide-y divide-border">
            {aversions.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{entry.label}</p>
                  {entry.note ? (
                    <p className="truncate text-xs text-muted-foreground">{entry.note}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleAversionEdit(entry)}
                  aria-label={`${entry.label} bearbeiten`}
                >
                  <EditIcon className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDeleteAversion(entry.label)}
                  aria-label={`${entry.label} entfernen`}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="plain" size="md" className="space-y-3">
        <SectionHeader
          title="Allergien & Unverträglichkeiten"
          as="h3"
          description="Bekannte Reaktionen und was im Notfall hilft."
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
          <ul className="divide-y divide-border">
            {allergies.map((entry) => {
              const levelStyle =
                ALLERGY_LEVEL_STYLES[entry.level as AllergyLevel] ?? ALLERGY_LEVEL_STYLES.MILD;
              const details = [entry.symptoms, entry.treatment, entry.note]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={entry.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {entry.allergen}
                      <Badge variant="muted" size="sm">
                        {ALLERGEN_KIND_LABELS[entry.kind as RestrictionKind] ?? entry.kind}
                      </Badge>
                      <Badge size="sm" className={cn("border", levelStyle.badge)}>
                        {ALLERGY_LEVEL_LABELS[entry.level as AllergyLevel] ?? entry.level}
                      </Badge>
                      {entry.tracesOk === false ? (
                        <Badge variant="warning" size="sm">
                          Keine Spuren
                        </Badge>
                      ) : null}
                      {!entry.diagnosed ? (
                        <Badge variant="ghost" size="sm">
                          nicht abgeklärt
                        </Badge>
                      ) : null}
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

      <Dialog open={aversionDialogOpen} onOpenChange={setAversionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAversionId ? "Besonderheit bearbeiten" : "Besonderheit hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAversionSubmit}>
            <ProfileField label="Besonderheit" htmlFor="aversion-label">
              <Input
                id="aversion-label"
                value={aversionState.label}
                onChange={(event) =>
                  setAversionState((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="z. B. keine Pilze"
              />
            </ProfileField>
            <ProfileField label="Notiz" htmlFor="aversion-note">
              <Textarea
                id="aversion-note"
                rows={2}
                value={aversionState.note}
                onChange={(event) =>
                  setAversionState((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="z. B. gilt auch für Trüffel"
              />
            </ProfileField>
            {aversionError ? <p className="text-sm text-destructive">{aversionError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAversionDialogOpen(false)}>
                Abbrechen
              </Button>
              <AsyncButton type="submit" isLoading={aversionSubmitting} loadingText="Speichern…">
                Speichern
              </AsyncButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={allergyDialogOpen} onOpenChange={setAllergyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAllergyId ? "Allergie bearbeiten" : "Allergie hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAllergySubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField
                label="Allergen"
                htmlFor="allergen"
                hint="Aus der Liste wählen oder selbst schreiben."
                className="sm:col-span-2"
              >
                <AllergenField
                  inputId="allergen"
                  value={allergyState.allergen}
                  onChange={(value) => setAllergyState((prev) => ({ ...prev, allergen: value }))}
                  onSelectEntry={(entry) =>
                    setAllergyState((prev) => ({ ...prev, kind: entry.kind }))
                  }
                  placeholder="z. B. Erdnüsse"
                />
              </ProfileField>
              <ProfileField label="Art" htmlFor="allergy-kind">
                <Select
                  value={allergyState.kind}
                  onValueChange={(value) =>
                    setAllergyState((prev) => ({ ...prev, kind: value as RestrictionKind }))
                  }
                >
                  <SelectTrigger id="allergy-kind">
                    <SelectValue placeholder="Art wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLERGEN_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    {ALLERGY_LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ProfileField>
              <ProfileField
                label="Spuren"
                htmlFor="allergy-traces"
                hint="Nicht angegeben zählt für die Küche als ungeklärt."
                className="sm:col-span-2"
              >
                <Select
                  value={toAllergyTracesChoice(allergyState.tracesOk)}
                  onValueChange={(value) =>
                    setAllergyState((prev) => ({
                      ...prev,
                      tracesOk: fromAllergyTracesChoice(value as AllergyTracesChoice),
                    }))
                  }
                >
                  <SelectTrigger id="allergy-traces">
                    <SelectValue placeholder="Spuren wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLERGY_TRACES_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ProfileField>
              <div className="flex items-start justify-between gap-4 sm:col-span-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Ärztlich abgeklärt</p>
                  <p className="text-xs text-muted-foreground">
                    Aus einer Untersuchung bekannt, nicht nur vermutet.
                  </p>
                </div>
                <Switch
                  checked={allergyState.diagnosed}
                  onCheckedChange={(checked) =>
                    setAllergyState((prev) => ({ ...prev, diagnosed: checked }))
                  }
                  aria-label="Ärztlich abgeklärt"
                />
              </div>
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
        open={pendingDeleteAversion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteAversion(null);
        }}
        title="Besonderheit entfernen?"
        description={`${pendingDeleteAversion ?? ""} wird aus deinem Profil gelöscht.`}
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setPendingDeleteAversion(null)}
        onConfirm={() => {
          const label = pendingDeleteAversion;
          setPendingDeleteAversion(null);
          if (label) void handleAversionDelete(label);
        }}
      />

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
