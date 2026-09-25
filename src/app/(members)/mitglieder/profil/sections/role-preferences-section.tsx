"use client";

import { HeartIcon } from "@/components/ui/action-icons";
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

const NEXT_LEVEL: Record<PreferenceLevel, PreferenceLevel> = {
  off: "like",
  like: "love",
  love: "off",
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Antippen wechselt:</span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="h-3.5 w-3.5 text-primary" aria-hidden /> Gern
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="h-3.5 w-3.5 fill-current text-primary" aria-hidden /> Sehr gern
          </span>
          <span>→ wieder aus</span>
        </p>
        {groups.map((group) => {
          const chosen = group.entries.filter((pref) => getPreferenceLevel(pref) !== "off").length;
          return (
            <section key={group.domain} className="space-y-2">
              <h4 className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {group.title}
                {chosen ? <span className="text-primary">{chosen} gewählt</span> : null}
              </h4>
              <ul className="flex flex-wrap gap-2">
                {group.entries.map((pref) => {
                  const level = getPreferenceLevel(pref);
                  const next = NEXT_LEVEL[level];
                  const levelLabel = PREFERENCE_LEVELS.find((o) => o.value === level)?.label;
                  return (
                    <li key={pref.code}>
                      <button
                        type="button"
                        title={pref.description ?? undefined}
                        aria-label={`${pref.title}: ${levelLabel}`}
                        aria-pressed={level !== "off"}
                        onClick={() => setPreferenceLevel(group.domain, pref.code, next)}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          level === "off" &&
                            "border-border/70 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                          level === "like" && "border-primary/50 bg-primary/12 text-foreground",
                          level === "love" &&
                            "border-primary bg-primary text-primary-foreground shadow-sm",
                        )}
                      >
                        {level !== "off" ? (
                          <HeartIcon
                            className={cn(
                              "h-4 w-4",
                              level === "love" ? "fill-current" : "text-primary",
                            )}
                            aria-hidden
                          />
                        ) : null}
                        {pref.title}
                        {pref.isCustom ? <span className="text-xs opacity-70">(eigen)</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
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
