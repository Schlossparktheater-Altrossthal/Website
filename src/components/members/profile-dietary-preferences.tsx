"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AllergyLevel } from "@prisma/client";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  resolveDietaryStyleLabel,
  resolveDietaryStrictnessLabel,
  type DietaryStrictnessOption,
  type DietaryStyleOption,
} from "@/data/dietary-preferences";
import { ALLERGY_LEVEL_STYLES } from "@/data/allergy-styles";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

type DietaryPreferenceState = {
  style: DietaryStyleOption;
  customLabel: string | null;
  strictness: DietaryStrictnessOption;
};

function normalizePreferenceState(
  state: DietaryPreferenceState,
): DietaryPreferenceState {
  const style = state.style === "none" ? "omnivore" : state.style;
  const customRaw = typeof state.customLabel === "string" ? state.customLabel.trim() : "";
  const customLabel = style === "custom" ? customRaw || null : null;
  const strictness = style === "omnivore" ? DEFAULT_STRICTNESS_FOR_NONE : state.strictness;

  return {
    style,
    customLabel,
    strictness,
  } satisfies DietaryPreferenceState;
}

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
  const preference = useMemo(
    () => normalizePreferenceState(initialPreference),
    [initialPreference],
  );

  useEffect(() => {
    setItemComplete("dietary", true);
  }, [setItemComplete]);

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

  const preferenceLabel = useMemo(() => {
    const { label } = resolveDietaryStyleLabel(
      preference.style,
      preference.customLabel,
    );
    return label;
  }, [preference.customLabel, preference.style]);

  const showCustomLabel =
    preference.style === "custom" && preference.customLabel;

  const strictnessLabel = useMemo(
    () => resolveDietaryStrictnessLabel(preference.style, preference.strictness),
    [preference.strictness, preference.style],
  );

  const isAllesesser =
    preference.style === "omnivore" || preference.style === "none";

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
        <CardTitle className="text-xl">Ernährungsprofil &amp; Hinweise</CardTitle>
        <p className="text-sm text-muted-foreground">
          Teile uns mit, wie wir bei Verpflegung, Proben und Events auf dich achten
          können und verwalte Allergien oder Unverträglichkeiten zentral.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 sm:px-7">
        <section className="space-y-4 rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Ernährungsstil
            </h3>
            <p className="text-xs text-muted-foreground">
              Wir planen dich standardmäßig als Allesesser ein. Besondere Wünsche oder Einschränkungen teilst du am besten direkt über die Allergieverwaltung oder im persönlichen Gespräch mit dem Team.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
            <p className="text-sm font-semibold text-foreground">{preferenceLabel}</p>
            {showCustomLabel ? (
              <p className="text-xs text-muted-foreground">
                Eigene Beschreibung: {preference.customLabel}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {isAllesesser
                ? "Strengegrade sind für diesen Standard nicht erforderlich."
                : `Strengegrad: ${strictnessLabel}`}
            </p>
          </div>
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
