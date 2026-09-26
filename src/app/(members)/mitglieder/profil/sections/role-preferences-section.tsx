"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  RolePreferenceLevelHint,
  RolePreferenceLevelPicker,
} from "@/components/onboarding/role-preference-level-picker";
import { FOCUS_BADGE_STYLES } from "@/config/category-colors";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { SectionHeader } from "@/components/ui/section-header";
import {
  deriveOnboardingFocusFromPreferences,
  normalizeRolePreferenceWeight,
} from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";
import { type OnboardingFocus } from "@prisma/client";
import { saveRolePreferencesAction, type SaveRolePreferencesInput } from "../actions/onboarding";
import {
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
  /** Herkunft der Wünsche, wenn sie aus einer früheren Produktion vorgeschlagen werden. */
  inheritedFromLabel?: string | null;
};

export function RolePreferencesSection({
  onboarding,
  rolePreferences,
  onRolePreferencesChange,
  onOnboardingChange,
  inheritedFromLabel = null,
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

  const setPreferenceWeight = useCallback(
    (domain: "acting" | "crew", code: string, weight: number | null) => {
      setPreferenceForm((prev) => {
        const entries = domain === "acting" ? prev.acting : prev.crew;
        const nextEntries = entries.map((entry) => {
          if (entry.code !== code) return entry;
          if (weight === null) return { ...entry, enabled: false };
          return {
            ...entry,
            enabled: true,
            weight: normalizeRolePreferenceWeight(weight),
          } satisfies RolePreferenceFormEntry;
        });
        return domain === "acting"
          ? { ...prev, acting: nextEntries }
          : { ...prev, crew: nextEntries };
      });
    },
    [],
  );

  const dirty = useMemo(
    // Vorschläge aus einer früheren Produktion gelten erst nach dem Speichern.
    () =>
      Boolean(inheritedFromLabel) ||
      JSON.stringify(preferenceForm) !== JSON.stringify(initialPreferences),
    [inheritedFromLabel, initialPreferences, preferenceForm],
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

  const groups = [
    { domain: "acting" as const, title: "Schauspiel", entries: preferenceForm.acting },
    { domain: "crew" as const, title: "Gewerke", entries: preferenceForm.crew },
  ];

  return (
    <Card variant="plain" size="md">
      <form onSubmit={handlePreferenceSubmit} className="space-y-4">
        <SectionHeader
          title="Rollen- und Gewerkewünsche"
          description="Wo möchtest du mitmachen?"
          action={
            effectiveFocus ? (
              <Badge
                variant="outline"
                size="sm"
                className={cn("border", FOCUS_BADGE_STYLES[effectiveFocus])}
              >
                {ONBOARDING_FOCUS_LABELS[effectiveFocus]}
              </Badge>
            ) : null
          }
        />
        {inheritedFromLabel ? (
          <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-foreground">
            Vorschlag aus {inheritedFromLabel}. Prüfe die Auswahl und speichere sie für diese
            Produktion.
          </p>
        ) : null}
        <RolePreferenceLevelHint />
        {groups.map((group) => {
          const chosen = group.entries.filter((pref) => pref.enabled && pref.weight > 0).length;
          return (
            <section key={group.domain} className="space-y-2">
              <h4 className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {group.title}
                {chosen ? <span className="text-primary">{chosen} gewählt</span> : null}
              </h4>
              <div className="grid gap-2 xl:grid-cols-2">
                {group.entries.map((pref) => (
                  <RolePreferenceLevelPicker
                    key={pref.code}
                    title={pref.title}
                    description={pref.description}
                    badge={
                      pref.isCustom ? (
                        <Badge variant="outline" size="sm">
                          Eigenes Gewerk
                        </Badge>
                      ) : null
                    }
                    enabled={pref.enabled}
                    weight={pref.weight}
                    onChange={(weight) => setPreferenceWeight(group.domain, pref.code, weight)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {preferenceError ? <p className="text-sm text-destructive">{preferenceError}</p> : null}
        <FormSaveBar
          dirty={dirty}
          submitting={preferenceSubmitting}
          onReset={() => {
            setPreferenceForm(initialPreferences);
            setPreferenceError(null);
          }}
        />
      </form>
    </Card>
  );
}
