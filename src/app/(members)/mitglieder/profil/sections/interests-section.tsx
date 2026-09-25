"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { PlusIcon, XIcon } from "@/components/ui/action-icons";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { useInterestSuggestions } from "@/hooks/useInterestSuggestions";
import { saveInterestsAction } from "../actions/interests";
import {
  InterestsState,
  interestSchema,
  INTEREST_SEPARATOR_PATTERN,
  INTEREST_SEPARATOR_SPLIT_PATTERN,
} from "../profile-shared";

type InterestsSectionProps = {
  interests: string[];
  onInterestsChange: (next: string[]) => void;
};

// Lange Freitexte aus alten Einträgen sind als Vorschlag unbrauchbar.
const SUGGESTION_MAX_LENGTH = 24;

export function InterestsSection({ interests, onInterestsChange }: InterestsSectionProps) {
  const [state, setState] = useState<InterestsState>({ items: interests, dirty: false });
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { suggestions: interestSuggestions, loading: suggestionsLoading } =
    useInterestSuggestions();
  const availableInterestSuggestions = useMemo(() => {
    const selected = new Set(state.items.map((item) => item.toLowerCase()));
    return interestSuggestions
      .filter(
        (suggestion) =>
          suggestion.name &&
          suggestion.name.length <= SUGGESTION_MAX_LENGTH &&
          !selected.has(suggestion.name.toLowerCase()),
      )
      .slice(0, 10);
  }, [interestSuggestions, state.items]);

  useEffect(() => {
    setState({ items: interests, dirty: false });
  }, [interests]);

  const tryAddInterest = (rawValue: string) => {
    setError(null);
    const parsed = interestSchema.safeParse(rawValue);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültiges Interesse");
      return false;
    }
    const value = parsed.data;
    if (state.items.length >= MAX_INTERESTS_PER_USER) {
      setError(`Maximal ${MAX_INTERESTS_PER_USER} Interessen erlaubt.`);
      return false;
    }
    if (state.items.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      setError("Dieses Interesse ist bereits erfasst.");
      return false;
    }
    setState((prev) => ({ items: [...prev.items, value], dirty: true }));
    return true;
  };

  const handleInputChange = (value: string) => {
    if (!value) {
      setInput("");
      return;
    }

    if (!INTEREST_SEPARATOR_PATTERN.test(value)) {
      setInput(value);
      return;
    }

    const segments = value.split(INTEREST_SEPARATOR_SPLIT_PATTERN);
    const remainder = segments.pop() ?? "";

    segments.forEach((segment) => {
      const clean = segment.trim();
      if (clean) {
        tryAddInterest(clean);
      }
    });

    setInput(remainder.replace(/^\s+/, ""));
  };

  const addInterest = () => {
    if (tryAddInterest(input)) {
      setInput("");
    }
  };

  const removeInterest = (interest: string) => {
    setState((prev) => ({ items: prev.items.filter((item) => item !== interest), dirty: true }));
  };

  const resetInterests = () => {
    setState({ items: interests, dirty: false });
    setInput("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await saveInterestsAction(state.items);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setState({ items: result.data.interests, dirty: false });
      onInterestsChange(result.data.interests);
      toast.success("Interessen gespeichert");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="plain" size="md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="interestInput" className="text-sm font-medium text-foreground">
            Deine Interessen
          </label>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            {state.items.map((interest) => (
              <span
                key={interest}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-sm text-foreground"
              >
                <span className="truncate">{interest}</span>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`${interest} entfernen`}
                  onClick={() => removeInterest(interest)}
                >
                  <XIcon className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ))}
            <input
              id="interestInput"
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addInterest();
                } else if (event.key === "Backspace" && !input && state.items.length) {
                  removeInterest(state.items[state.items.length - 1]);
                }
              }}
              onBlur={() => {
                if (input.trim()) addInterest();
              }}
              enterKeyHint="done"
              placeholder={state.items.length ? "Weiteres …" : "z. B. Licht, Nähen, Gesang"}
              className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mit Enter oder Komma hinzufügen · höchstens {MAX_INTERESTS_PER_USER}
            </p>
          )}
        </div>

        {suggestionsLoading || availableInterestSuggestions.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Vorschläge</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestionsLoading ? (
                <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>
              ) : (
                availableInterestSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => {
                      if (tryAddInterest(suggestion.name)) {
                        setInput("");
                      }
                    }}
                  >
                    <PlusIcon className="h-3 w-3" aria-hidden />
                    {suggestion.name}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <FormSaveBar dirty={state.dirty} submitting={saving} onReset={resetInterests} />
      </form>
    </Card>
  );
}
