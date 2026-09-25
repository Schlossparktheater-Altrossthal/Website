"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  DEFAULT_ROLE_PREFERENCE_WEIGHT,
  ONBOARDING_FOCUS_LABELS,
  RolePreferenceFormEntry,
  RolePreferenceFormState,
  buildPreferenceFormState,
  ProfileClientProps,
} from "../profile-shared";

type PreferenceLevel = "off" | "like" | "love";

const PREFERENCE_LEVELS: ReadonlyArray<{ value: PreferenceLevel; label: string }> = [
  { value: "off", label: "Nein" },
  { value: "like", label: "Gern" },
  { value: "love", label: "Sehr gern" },
];

const LEVEL_WEIGHTS: Record<Exclude<PreferenceLevel, "off">, number> = {
  like: DEFAULT_ROLE_PREFERENCE_WEIGHT,
  love: 90,
};

function getPreferenceLevel(entry: RolePreferenceFormEntry): PreferenceLevel {
  if (!entry.enabled || entry.weight <= 0) return "off";
  return entry.weight >= 75 ? "love" : "like";
}

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

  const setPreferenceLevel = useCallback(
    (domain: "acting" | "crew", code: string, level: PreferenceLevel) => {
      setPreferenceForm((prev) => {
        const entries = domain === "acting" ? prev.acting : prev.crew;
        const nextEntries = entries.map((entry) => {
          if (entry.code !== code) return entry;
          if (level === "off") return { ...entry, enabled: false };
          const currentLevel = getPreferenceLevel(entry);
          // Bestehende Gewichtung behalten, wenn die Stufe gleich bleibt.
          const weight = currentLevel === level ? entry.weight : LEVEL_WEIGHTS[level];
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
    () => JSON.stringify(preferenceForm) !== JSON.stringify(initialPreferences),
    [initialPreferences, preferenceForm],
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
          description="Wo möchtest du mitmachen? Mehrfachauswahl möglich."
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
        {groups.map((group) => (
          <section key={group.domain} className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">{group.title}</h4>
            <ul className="divide-y divide-border/50">
              {group.entries.map((pref) => {
                const level = getPreferenceLevel(pref);
                return (
                  <li key={pref.code} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {pref.title}
                        {pref.isCustom ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (individuell)
                          </span>
                        ) : null}
                      </p>
                      {pref.description ? (
                        <p
                          className="line-clamp-1 text-xs text-muted-foreground"
                          title={pref.description}
                        >
                          {pref.description}
                        </p>
                      ) : null}
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={pref.title}
                      className="inline-flex shrink-0 rounded-md bg-muted/60 p-0.5"
                    >
                      {PREFERENCE_LEVELS.map((option) => {
                        const active = level === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() =>
                              setPreferenceLevel(group.domain, pref.code, option.value)
                            }
                            className={cn(
                              "min-h-8 rounded px-2 text-xs font-medium transition sm:px-2.5",
                              active
                                ? option.value === "off"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

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
