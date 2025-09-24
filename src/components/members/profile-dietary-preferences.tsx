"use client";

import { useCallback, useMemo, useState } from "react";
import { AllergyLevel } from "@prisma/client";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AllergyForm } from "@/components/forms/allergy-form";
import { useProfileCompletion } from "@/components/members/profile-completion-context";
import {
  DEFAULT_STRICTNESS_FOR_NONE,
  DIETARY_STRICTNESS_OPTIONS,
  DIETARY_STYLE_OPTIONS,
  NONE_STRICTNESS_LABEL,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
} from "@/data/dietary-preferences";
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

type DietaryPreferenceState = {
  style: DietaryStyleOption;
  customLabel: string | null;
  strictness: DietaryStrictnessOption;
};

type AllergyEntry = {
  allergen: string;
  level: AllergyLevel;
  symptoms?: string | null;
  treatment?: string | null;
  note?: string | null;
  updatedAt: string;
};

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; entry: AllergyEntry };

interface ProfileDietaryPreferencesProps {
  initialPreference: DietaryPreferenceState;
  initialAllergies: AllergyEntry[];
  onDietaryChange?: (data: {
    preference: DietaryPreferenceState;
    allergies: AllergyEntry[];
  }) => void;
}

export function ProfileDietaryPreferences({
  initialPreference,
  initialAllergies,
  onDietaryChange,
}: ProfileDietaryPreferencesProps) {
  const { setItemComplete } = useProfileCompletion();
  const [preference, setPreference] = useState<DietaryPreferenceState>(
    initialPreference,
  );
  const [draftStyle, setDraftStyle] = useState<DietaryStyleOption>(
    initialPreference.style,
  );
  const [draftStrictness, setDraftStrictness] =
    useState<DietaryStrictnessOption>(initialPreference.strictness);
  const [draftCustomStyle, setDraftCustomStyle] = useState(
    initialPreference.customLabel ?? "",
  );
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const [allergies, setAllergies] = useState<AllergyEntry[]>(() =>
    sortAllergies(initialAllergies),
  );
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deletingAllergen, setDeletingAllergen] = useState<string | null>(null);

  const emitDietaryChange = useCallback(
    (nextPreference: DietaryPreferenceState, nextAllergies: AllergyEntry[]) => {
      onDietaryChange?.({ preference: nextPreference, allergies: nextAllergies });
    },
    [onDietaryChange],
  );

  const styleRequiresCustom = draftStyle === "custom";
  const strictnessDisabled = draftStyle === "none";

  const hasPreferenceChanges = useMemo(() => {
    const custom = draftCustomStyle.trim();
    return (
      draftStyle !== preference.style ||
      draftStrictness !== preference.strictness ||
      (styleRequiresCustom
        ? custom !== (preference.customLabel ?? "")
        : preference.customLabel !== null)
    );
  }, [draftStyle, draftStrictness, draftCustomStyle, preference, styleRequiresCustom]);

  const preferenceLabel = useMemo(() => {
    const { label } = resolveDietaryStyleLabel(
      draftStyle,
      draftCustomStyle,
    );
    return label;
  }, [draftStyle, draftCustomStyle]);

  const strictnessLabel = useMemo(() => {
    return resolveDietaryStrictnessLabel(draftStyle, draftStrictness);
  }, [draftStyle, draftStrictness]);

  const handleSavePreference = async () => {
    setPreferenceError(null);
    if (styleRequiresCustom && !draftCustomStyle.trim()) {
      setPreferenceError("Bitte beschreibe deinen Ernährungsstil.");
      return;
    }
    setSavingPreference(true);
    try {
      const response = await fetch("/api/profile/dietary", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          style: draftStyle,
          strictness: draftStrictness,
          customLabel: styleRequiresCustom ? draftCustomStyle.trim() : null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : "Ernährungsstil konnte nicht gespeichert werden.";
        throw new Error(message);
      }
      const payload = (data as { preference?: unknown })?.preference;
      const nextPreference = normalizePreferencePayload(payload, {
        style: draftStyle,
        strictness: draftStrictness,
        customLabel: styleRequiresCustom ? draftCustomStyle.trim() : null,
      });
      setPreference(nextPreference);
      setDraftStyle(nextPreference.style);
      setDraftStrictness(nextPreference.strictness);
      setDraftCustomStyle(nextPreference.customLabel ?? "");
      setItemComplete("dietary", true);
      toast.success("Ernährungsinformationen aktualisiert.");
      emitDietaryChange(nextPreference, allergies);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ernährungsstil konnte nicht gespeichert werden.";
      setPreferenceError(message);
      toast.error(message);
    } finally {
      setSavingPreference(false);
    }
  };

  const openCreateDialog = () => setDialogState({ mode: "create" });
  const openEditDialog = (entry: AllergyEntry) =>
    setDialogState({ mode: "edit", entry });
  const closeDialog = () => setDialogState(null);

  const handleAllergySubmit = async (data: {
    allergen: string;
    level: AllergyLevel;
    symptoms?: string;
    treatment?: string;
    note?: string;
  }) => {
    const response = await fetch("/api/allergies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : "Allergie konnte nicht gespeichert werden.";
      throw new Error(message);
    }
    const saved = (await response.json().catch(() => null)) as
      | (AllergyEntry & { id?: string })
      | null;
    const entry: AllergyEntry = {
      allergen: saved?.allergen ?? data.allergen,
      level: saved?.level ?? data.level,
      symptoms: saved?.symptoms ?? data.symptoms,
      treatment: saved?.treatment ?? data.treatment,
      note: saved?.note ?? data.note,
      updatedAt: saved?.updatedAt ?? new Date().toISOString(),
    };
    setAllergies((prev) => {
      const next = sortAllergies([
        ...prev.filter(
          (item) => item.allergen.toLowerCase() !== entry.allergen.toLowerCase(),
        ),
        entry,
      ]);
      emitDietaryChange(preference, next);
      return next;
    });
    setDialogState(null);
  };

  const handleDeleteAllergy = async (allergen: string) => {
    setDeletingAllergen(allergen);
    try {
      const response = await fetch(
        `/api/allergies?allergen=${encodeURIComponent(allergen)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Allergie konnte nicht entfernt werden.";
        throw new Error(message);
      }
      setAllergies((prev) => {
        const next = prev.filter(
          (entry) => entry.allergen.toLowerCase() !== allergen.toLowerCase(),
        );
        emitDietaryChange(preference, next);
        return next;
      });
      toast.success("Allergie entfernt.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Allergie konnte nicht entfernt werden.";
      toast.error(message);
    } finally {
      setDeletingAllergen(null);
    }
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-background/85 shadow-lg shadow-primary/5">
      <CardHeader className="space-y-3 px-6 pb-4 pt-6 sm:px-7">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          Ernährung &amp; Verträglichkeiten
        </div>
        <CardTitle className="text-xl">Passe deinen Ernährungsstil an</CardTitle>
        <p className="text-sm text-muted-foreground">
          Teile uns mit, wie wir bei Verpflegung, Proben und Events auf dich achten
          können und verwalte Allergien oder Unverträglichkeiten zentral.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 sm:px-7">
        <section className="space-y-4 rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                Ernährungsstil
              </label>
              <Select value={draftStyle} onValueChange={(value) => {
                const next = value as DietaryStyleOption;
                setDraftStyle(next);
                if (next === "none") {
                  setDraftStrictness(DEFAULT_STRICTNESS_FOR_NONE);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Wähle deinen Ernährungsstil" />
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">
                Strenge / Flexibilität
              </label>
              <Select
                value={draftStrictness}
                disabled={strictnessDisabled}
                onValueChange={(value) =>
                  setDraftStrictness(value as DietaryStrictnessOption)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wie strikt ist deine Ernährung?" />
                </SelectTrigger>
                <SelectContent>
                  {DIETARY_STRICTNESS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {strictnessDisabled ? (
                <p className="text-xs text-muted-foreground">
                  {NONE_STRICTNESS_LABEL}
                </p>
              ) : null}
            </div>
            {styleRequiresCustom ? (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground/90" htmlFor="profile-dietary-custom">
                  Eigene Beschreibung
                </label>
                <Input
                  id="profile-dietary-custom"
                  value={draftCustomStyle}
                  onChange={(event) => setDraftCustomStyle(event.target.value)}
                  placeholder="z.B. Paleo, Clean Eating, Intervallfasten"
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground/80">Vorschau</p>
              <p>{preferenceLabel}</p>
              <p>{strictnessLabel}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleSavePreference}
              disabled={!hasPreferenceChanges || savingPreference}
            >
              {savingPreference ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Speichern …
                </>
              ) : (
                "Einstellungen speichern"
              )}
            </Button>
          </div>
          {preferenceError ? (
            <p className="text-xs text-destructive">{preferenceError}</p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Allergien &amp; Unverträglichkeiten
              </h3>
              <p className="text-xs text-muted-foreground">
                Hinterlege relevante Informationen für Notfälle und Planungen.
              </p>
            </div>
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Neu hinzufügen
            </Button>
          </div>
          {allergies.length ? (
            <ul className="space-y-3">
              {allergies.map((entry) => (
                <li
                  key={entry.allergen}
                  className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {entry.allergen}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[0.7rem]",
                          ALLERGY_LEVEL_STYLES[entry.level].badge,
                        )}
                      >
                        {levelLabel(entry.level)}
                      </Badge>
                    </div>
                    {entry.note ? (
                      <p className="text-xs text-muted-foreground">
                        Hinweis: {entry.note}
                      </p>
                    ) : null}
                    {entry.symptoms ? (
                      <p className="text-xs text-muted-foreground">
                        Symptome: {entry.symptoms}
                      </p>
                    ) : null}
                    {entry.treatment ? (
                      <p className="text-xs text-muted-foreground">
                        Behandlung: {entry.treatment}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      Aktualisiert am {formatDate(entry.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(entry)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteAllergy(entry.allergen)}
                      disabled={deletingAllergen === entry.allergen}
                    >
                      {deletingAllergen === entry.allergen ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      Entfernen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Noch keine Allergien hinterlegt.
            </div>
          )}
        </section>
      </CardContent>

      <Dialog open={dialogState !== null} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? `${dialogState.entry.allergen} bearbeiten`
                : "Neue Allergie hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          {dialogState ? (
            <AllergyForm
              initialData={
                dialogState.mode === "edit"
                  ? {
                      allergen: dialogState.entry.allergen,
                      level: dialogState.entry.level,
                      symptoms: dialogState.entry.symptoms ?? "",
                      treatment: dialogState.entry.treatment ?? "",
                      note: dialogState.entry.note ?? "",
                    }
                  : undefined
              }
              onSubmit={async (data) => {
                await handleAllergySubmit(data);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function normalizePreferencePayload(
  payload: unknown,
  fallback: DietaryPreferenceState,
): DietaryPreferenceState {
  if (
    payload &&
    typeof payload === "object" &&
    "style" in payload &&
    typeof (payload as { style?: unknown }).style === "string"
  ) {
    const styleRaw = (payload as { style: string }).style;
    const style = isDietaryStyleOption(styleRaw) ? styleRaw : fallback.style;

    const customRaw = (payload as { customLabel?: unknown }).customLabel;
    const customLabel =
      typeof customRaw === "string" ? customRaw.trim() || null : null;

    const strictnessRaw = (payload as { strictness?: unknown }).strictness;
    const strictness =
      typeof strictnessRaw === "string" && isDietaryStrictnessOption(strictnessRaw)
        ? (strictnessRaw as DietaryStrictnessOption)
        : fallback.strictness;

    return {
      style,
      customLabel,
      strictness,
    };
  }
  return fallback;
}

function sortAllergies(entries: AllergyEntry[]) {
  return [...entries].sort((a, b) =>
    a.allergen.localeCompare(b.allergen, "de-DE", {
      sensitivity: "base",
    }),
  );
}

function levelLabel(level: AllergyLevel) {
  switch (level) {
    case "MILD":
      return "Leicht";
    case "MODERATE":
      return "Mittel";
    case "SEVERE":
      return "Stark";
    case "LETHAL":
      return "Kritisch";
    default:
      return level;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return dateFormatter.format(date);
}

function isDietaryStyleOption(value: string): value is DietaryStyleOption {
  return DIETARY_STYLE_OPTIONS.some((option) => option.value === value);
}

function isDietaryStrictnessOption(value: string): value is DietaryStrictnessOption {
  return DIETARY_STRICTNESS_OPTIONS.some((option) => option.value === value);
}
