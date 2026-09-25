"use client";

import { Loader2Icon } from "@/components/ui/action-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_BADGE_STYLES } from "@/config/category-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deriveOnboardingFocusFromPreferences,
  getRolePreferenceWeightLabel,
  normalizeRolePreferenceWeight,
} from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";
import { type OnboardingFocus } from "@prisma/client";
import { saveRolePreferencesAction, type SaveRolePreferencesInput } from "../actions/onboarding";
import {
  DEFAULT_ROLE_PREFERENCE_WEIGHT,
  ONBOARDING_FOCUS_LABELS,
  RolePreferenceFormEntry,
  RolePreferenceFormState,
  buildPreferenceFormState,
  ProfileClientProps,
} from "../profile-shared";

type RolePreferencesSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  rolePreferences: ProfileClientProps["rolePreferences"];
  onRolePreferencesChange: (next: ProfileClientProps["rolePreferences"]) => void;
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
};

export function RolePreferencesSection({
  onboarding,
  rolePreferences,
  onRolePreferencesChange,
  onOnboardingChange,
}: RolePreferencesSectionProps) {
  const initialPreferences = useMemo(
    () => buildPreferenceFormState(rolePreferences),
    [rolePreferences],
  );
  const [preferenceForm, setPreferenceForm] = useState<RolePreferenceFormState>(initialPreferences);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceSubmitting, setPreferenceSubmitting] = useState(false);
  const preferenceSource = onboarding?.preferences?.length
    ? onboarding.preferences
    : rolePreferences;
  const focusCandidates = useMemo(
    () =>
      (preferenceSource ?? []).map((pref) => ({
        domain: pref.domain,
        weight: pref.weight,
      })),
    [preferenceSource],
  );
  const derivedFocus = useMemo(
    () => deriveOnboardingFocusFromPreferences(focusCandidates) ?? null,
    [focusCandidates],
  );
  const storedFocus = (onboarding?.focus as OnboardingFocus | null) ?? null;
  const effectiveFocus = derivedFocus ?? storedFocus;

  useEffect(() => {
    setPreferenceForm(initialPreferences);
  }, [initialPreferences]);

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

  const changePreferenceWeight = useCallback(
    (domain: "acting" | "crew", code: string, weight: number) => {
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
    },
    [],
  );

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
      const serverFocus = result.data.focus;
      const nextFocus =
        serverFocus ??
        deriveOnboardingFocusFromPreferences(saved) ??
        (onboarding?.focus as OnboardingFocus | null) ??
        effectiveFocus;
      onRolePreferencesChange(saved);
      if (onboarding) {
        onOnboardingChange({
          ...onboarding,
          focus: (nextFocus ?? onboarding.focus ?? "acting") as OnboardingFocus,
          preferences: saved,
        });
      }
      setPreferenceForm(buildPreferenceFormState(saved));
      toast.success("Präferenzen gespeichert");
    } finally {
      setPreferenceSubmitting(false);
    }
  };

  const actingPreferences = preferenceForm.acting;
  const crewPreferences = preferenceForm.crew;

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Rollenpräferenzen</CardTitle>
          {effectiveFocus ? (
            <Badge
              variant="outline"
              className={cn(
                "w-fit rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide",
                FOCUS_BADGE_STYLES[effectiveFocus],
              )}
            >
              {ONBOARDING_FOCUS_LABELS[effectiveFocus]}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Markiere, in welchen Bereichen du aktiv sein möchtest und wie intensiv du dich einbringen
          willst. Dein Fokus ergibt sich automatisch aus deiner Auswahl.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-6" onSubmit={handlePreferenceSubmit}>
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Schauspiel</h4>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {actingPreferences.map((pref) => {
                  const weightLabel = getRolePreferenceWeightLabel(pref.weight);
                  return (
                    <div
                      key={pref.code}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-4 transition",
                        pref.enabled
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background",
                      )}
                    >
                      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-medium">{pref.title}</h5>
                            {pref.isCustom ? (
                              <Badge
                                variant="outline"
                                className="border-primary/40 bg-primary/10 text-primary"
                              >
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
                              changePreferenceWeight(
                                "acting",
                                pref.code,
                                event.currentTarget.valueAsNumber,
                              )
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
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {crewPreferences.map((pref) => {
                  const weightLabel = getRolePreferenceWeightLabel(pref.weight);
                  return (
                    <div
                      key={pref.code}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-4 transition",
                        pref.enabled
                          ? "border-primary/70 bg-primary/5"
                          : "border-border bg-background",
                      )}
                    >
                      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-medium">{pref.title}</h5>
                            {pref.isCustom ? (
                              <Badge
                                variant="outline"
                                className="border-primary/40 bg-primary/10 text-primary"
                              >
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
                              changePreferenceWeight(
                                "crew",
                                pref.code,
                                event.currentTarget.valueAsNumber,
                              )
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
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
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
