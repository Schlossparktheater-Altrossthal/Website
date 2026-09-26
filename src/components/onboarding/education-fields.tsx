"use client";

import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  BSZ_CAMPUSES,
  EDUCATION_CATEGORIES,
  type BszCampusId,
  type EducationValue,
} from "@/lib/education/schools";
import { cn } from "@/lib/utils";

type EducationSuggestions = {
  classes: Record<BszCampusId, string[]>;
  schools: string[];
  work: string[];
  universities: string[];
};

const EMPTY_SUGGESTIONS: EducationSuggestions = {
  classes: { altrossthal: [], canaletto: [] },
  schools: [],
  work: [],
  universities: [],
};

function useEducationSuggestions(onboardingToken?: string) {
  const [suggestions, setSuggestions] = useState<EducationSuggestions>(EMPTY_SUGGESTIONS);
  useEffect(() => {
    let cancelled = false;
    const query = onboardingToken ? `?token=${encodeURIComponent(onboardingToken)}` : "";
    fetch(`/api/onboarding/education-suggestions${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: EducationSuggestions | null) => {
        if (!cancelled && data) setSuggestions({ ...EMPTY_SUGGESTIONS, ...data });
      })
      .catch((error) => console.warn("[education-suggestions]", error));
    return () => {
      cancelled = true;
    };
  }, [onboardingToken]);
  return suggestions;
}

function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function TextWithSuggestions({
  label,
  value,
  placeholder,
  suggestions,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  suggestions: string[];
  onChange: (next: string) => void;
}) {
  const id = useId();
  const visible = suggestions.filter((entry) => entry.toLowerCase() !== value.trim().toLowerCase());
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {visible.length ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Häufige Angaben">
          {visible.slice(0, 8).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => onChange(entry)}
              className="inline-flex min-h-8 items-center rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {entry}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type EducationFieldsProps = {
  value: EducationValue;
  onChange: (next: EducationValue) => void;
  /** Onboarding-Link für Vorschläge ohne Anmeldung (neue Mitglieder). */
  onboardingToken?: string;
  className?: string;
};

/**
 * Schule/Ausbildung/Studium erfassen. Bei „Schule“ wird direkt gefragt, ob man am BSZ in
 * Altroßthal, an der Canalettostraße oder an einer anderen Schule ist – die beiden
 * BSZ-Standorte müssen sauber zuordenbar sein. Vorschläge stammen aus Angaben anderer.
 */
export function EducationFields({
  value,
  onChange,
  onboardingToken,
  className,
}: EducationFieldsProps) {
  const suggestions = useEducationSuggestions(onboardingToken);
  const update = (patch: Partial<EducationValue>) => onChange({ ...value, ...patch });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Was machst du gerade?</p>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EDUCATION_CATEGORIES.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={value.kind === option.value}
              onClick={() => update({ kind: option.value })}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      {value.kind === "school" ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Wo gehst du zur Schule?</p>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            {BSZ_CAMPUSES.map((campus) => (
              <ChoiceButton
                key={campus.id}
                selected={value.campus === campus.id}
                onClick={() => update({ campus: campus.id, schoolName: "" })}
              >
                <span>{campus.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{campus.detail}</span>
              </ChoiceButton>
            ))}
            <ChoiceButton
              selected={value.campus === "other"}
              onClick={() => update({ campus: "other" })}
            >
              <span>Andere Schule</span>
            </ChoiceButton>
          </div>
        </div>
      ) : null}

      {value.kind === "school" && value.campus === "other" ? (
        <TextWithSuggestions
          label="Name der Schule"
          value={value.schoolName}
          placeholder="z. B. Gymnasium Dresden-Plauen"
          suggestions={suggestions.schools}
          onChange={(schoolName) => update({ schoolName })}
        />
      ) : null}

      {value.kind === "school" && value.campus ? (
        <TextWithSuggestions
          label={value.campus === "other" ? "Klasse (optional)" : "Klasse"}
          value={value.className}
          placeholder="z. B. BG 12"
          suggestions={value.campus === "other" ? [] : suggestions.classes[value.campus]}
          onChange={(className) => update({ className })}
        />
      ) : null}

      {value.kind === "work" ? (
        <TextWithSuggestions
          label="Ausbildung, Beruf oder Tätigkeit (optional)"
          value={value.workDescription}
          placeholder="z. B. Ausbildung zum Gärtner"
          suggestions={suggestions.work}
          onChange={(workDescription) => update({ workDescription })}
        />
      ) : null}

      {value.kind === "university" ? (
        <TextWithSuggestions
          label="Hochschule (optional)"
          value={value.universityName}
          placeholder="z. B. TU Dresden"
          suggestions={suggestions.universities}
          onChange={(universityName) => update({ universityName })}
        />
      ) : null}

      {value.kind === "other" ? (
        <TextWithSuggestions
          label="Beschreibung (optional)"
          value={value.otherDescription}
          placeholder="Kurze Beschreibung"
          suggestions={[]}
          onChange={(otherDescription) => update({ otherDescription })}
        />
      ) : null}
    </div>
  );
}
