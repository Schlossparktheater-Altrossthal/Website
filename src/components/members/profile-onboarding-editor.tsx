"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { OnboardingFocus } from "@prisma/client";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BACKGROUND_TAGS,
  findMatchingBackgroundTag,
  normalizeBackgroundLabel,
} from "@/data/onboarding-backgrounds";

const CURRENT_YEAR = new Date().getFullYear();

const focusOptions: { value: OnboardingFocus; label: string; description: string }[] = [
  {
    value: "acting",
    label: "Schauspiel",
    description: "Auf der Bühne stehen, Rollen gestalten und im Rampenlicht wirken.",
  },
  {
    value: "tech",
    label: "Gewerke",
    description: "Organisation, Technik, Kostüm oder Bühnenbau – hinter den Kulissen anpacken.",
  },
  {
    value: "both",
    label: "Schauspiel & Gewerke",
    description: "Flexibel zwischen Bühne und Gewerken wechseln und situativ entscheiden.",
  },
];

const BASE_BACKGROUND_SUGGESTIONS = [
  "Schule",
  "Berufsschule",
  "Universität",
  "Ausbildung",
  "Beruf",
] as const;

const updatedAtFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface ProfileOnboardingState {
  focus: OnboardingFocus | null;
  background: string | null;
  backgroundClass: string | null;
  notes: string | null;
  memberSinceYear: number | null;
  updatedAt: string | null;
}

interface ProfileOnboardingEditorProps {
  initialState: ProfileOnboardingState;
  onChange?: (state: ProfileOnboardingState) => void;
}

export function ProfileOnboardingEditor({
  initialState,
  onChange,
}: ProfileOnboardingEditorProps) {
  const [focus, setFocus] = useState<OnboardingFocus>(initialState.focus ?? "acting");
  const [background, setBackground] = useState(initialState.background ?? "");
  const [backgroundClass, setBackgroundClass] = useState(initialState.backgroundClass ?? "");
  const [notes, setNotes] = useState(initialState.notes ?? "");
  const [memberSinceYear, setMemberSinceYear] = useState(
    initialState.memberSinceYear ? String(initialState.memberSinceYear) : "",
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialState.updatedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeBackgroundTag = useMemo(
    () => findMatchingBackgroundTag(background),
    [background],
  );
  const requiresBackgroundClass = activeBackgroundTag?.requiresClass ?? false;
  const backgroundClassSuggestions = useMemo(
    () => activeBackgroundTag?.getClassSuggestions?.() ?? [],
    [activeBackgroundTag],
  );
  const backgroundTagValueKeys = useMemo(
    () => new Set(BACKGROUND_TAGS.map((tag) => normalizeBackgroundLabel(tag.value))),
    [],
  );
  const filteredBackgroundSuggestions = useMemo(
    () =>
      BASE_BACKGROUND_SUGGESTIONS.filter((suggestion) => {
        const key = normalizeBackgroundLabel(suggestion);
        if (!key) return false;
        return !backgroundTagValueKeys.has(key);
      }),
    [backgroundTagValueKeys],
  );

  const formattedUpdatedAt = useMemo(() => {
    if (!updatedAt) return null;
    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.valueOf())) return null;
    return updatedAtFormatter.format(parsed);
  }, [updatedAt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setError(null);
    setSuccess(null);

    const trimmedBackground = background.trim();
    if (!trimmedBackground) {
      setError("Bitte beschreibe kurz deinen schulischen oder beruflichen Hintergrund.");
      return;
    }
    if (trimmedBackground.length > 200) {
      setError("Bitte nutze maximal 200 Zeichen für deinen Hintergrund.");
      return;
    }

    const trimmedClass = backgroundClass.trim();
    if (requiresBackgroundClass && !trimmedClass) {
      setError(activeBackgroundTag?.classRequiredError ?? "Bitte gib deine Klasse an.");
      return;
    }
    if (trimmedClass.length > 120) {
      setError("Klassenangaben dürfen maximal 120 Zeichen enthalten.");
      return;
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > 2000) {
      setError("Notizen dürfen maximal 2000 Zeichen enthalten.");
      return;
    }

    const trimmedYear = memberSinceYear.trim();
    let parsedYear: number | null = null;
    if (trimmedYear) {
      const parsed = Number.parseInt(trimmedYear, 10);
      if (
        !Number.isFinite(parsed) ||
        trimmedYear.length !== 4 ||
        parsed < 1900 ||
        parsed > CURRENT_YEAR
      ) {
        setError(`Bitte gib ein gültiges Jahr zwischen 1900 und ${CURRENT_YEAR} an.`);
        return;
      }
      parsedYear = parsed;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          focus,
          background: trimmedBackground,
          backgroundClass: trimmedClass || null,
          notes: trimmedNotes || null,
          memberSinceYear: parsedYear,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Onboarding konnte nicht gespeichert werden.";
        throw new Error(message);
      }

      const onboarding = (payload?.onboarding ?? null) as
        | (ProfileOnboardingState & { focus: OnboardingFocus })
        | null;

      const nextState: ProfileOnboardingState = {
        focus: onboarding?.focus ?? focus,
        background: onboarding?.background ?? trimmedBackground,
        backgroundClass: onboarding?.backgroundClass ?? (trimmedClass ? trimmedClass : null),
        notes: onboarding?.notes ?? (trimmedNotes ? trimmedNotes : null),
        memberSinceYear:
          typeof onboarding?.memberSinceYear === "number"
            ? onboarding.memberSinceYear
            : parsedYear,
        updatedAt: onboarding?.updatedAt ?? new Date().toISOString(),
      } satisfies ProfileOnboardingState;

      setFocus(nextState.focus ?? focus);
      setBackground(nextState.background ?? "");
      setBackgroundClass(nextState.backgroundClass ?? "");
      setNotes(nextState.notes ?? "");
      setMemberSinceYear(nextState.memberSinceYear ? String(nextState.memberSinceYear) : "");
      setUpdatedAt(nextState.updatedAt);

      setSuccess("Onboarding gespeichert.");
      toast.success("Onboarding gespeichert.");
      onChange?.(nextState);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Onboarding konnte nicht gespeichert werden.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Dein Onboarding</p>
            <p className="text-xs text-muted-foreground">
              Aktualisiere Schwerpunkt, Hintergrund und Notizen – diese Angaben sind intern sichtbar.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {formattedUpdatedAt ? `Zuletzt bearbeitet am ${formattedUpdatedAt}` : "Noch keine Aktualisierung"}
          </Badge>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Schwerpunkt
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {focusOptions.map((option) => {
            const active = focus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border p-4 text-left transition",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/70 hover:text-foreground",
                )}
                onClick={() => setFocus(option.value)}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Was machst du aktuell?</span>
          <Input
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            placeholder="z.B. BSZ Altroßthal – Berufsschule"
          />
          <span className="text-xs text-muted-foreground">
            Kurze Info zu Schule, Ausbildung oder Beruf hilft uns beim Einordnen.
          </span>
          <div className="space-y-2 pt-2">
            {BACKGROUND_TAGS.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_TAGS.map((tag) => {
                  const isActive = activeBackgroundTag?.id === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-[0.7rem] transition",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                      )}
                      onClick={() => setBackground(tag.value)}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            )}
            {filteredBackgroundSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filteredBackgroundSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-[0.7rem] text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => setBackground(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">
            {requiresBackgroundClass ? "Klasse oder Jahrgang (erforderlich)" : "Klasse oder Jahrgang (optional)"}
          </span>
          <Input
            value={backgroundClass}
            onChange={(event) => setBackgroundClass(event.target.value)}
            placeholder={activeBackgroundTag?.classPlaceholder ?? "z.B. BFS 23A"}
          />
          <span className="text-xs text-muted-foreground">
            {requiresBackgroundClass
              ? activeBackgroundTag?.classHelper ??
                "Bitte gib deine Klasse an, damit wir dich richtig zuordnen können."
              : "Hilft uns bei der Planung innerhalb der Produktionen – falls nicht relevant, lass das Feld frei."}
          </span>
          {backgroundClassSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {backgroundClassSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-border px-3 py-1 text-[0.7rem] text-muted-foreground transition hover:border-primary hover:text-primary"
                  onClick={() => setBackgroundClass(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Seit wann bist du dabei?</span>
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={memberSinceYear}
            onChange={(event) => setMemberSinceYear(event.target.value)}
            placeholder={`z.B. ${CURRENT_YEAR}`}
            min={1900}
            max={CURRENT_YEAR}
          />
          <span className="text-xs text-muted-foreground">
            Wenn du neu startest, lass das Feld frei oder nutze das aktuelle Jahr.
          </span>
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Notizen für das Team (optional)</span>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Besondere Erfahrungen, Wünsche oder Hinweise"
            rows={5}
          />
          <span className="text-xs text-muted-foreground">
            Diese Informationen sehen nur eingeloggte Mitglieder und helfen bei der Zusammenarbeit.
          </span>
        </label>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted-foreground">
          Änderungen werden direkt gespeichert und sind sofort im Profil sichtbar.
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
