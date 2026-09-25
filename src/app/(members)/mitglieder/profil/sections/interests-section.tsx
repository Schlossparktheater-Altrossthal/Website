"use client";

import { Loader2Icon } from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      .filter((suggestion) => suggestion.name && !selected.has(suggestion.name.toLowerCase()))
      .slice(0, 12);
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
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Interessen</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="interestInput">Neues Interesse</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="interestInput"
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addInterest();
                  }
                }}
                placeholder="z.B. Regie, Lichttechnik"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" onClick={addInterest}>
                Hinzufügen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximal {MAX_INTERESTS_PER_USER} Einträge. Du kannst mehrere Begriffe nacheinander
              hinzufügen.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {state.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Interessen hinterlegt.</p>
            ) : (
              state.items.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs"
                >
                  {interest}
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground transition hover:text-destructive"
                    aria-label={`${interest} entfernen`}
                    onClick={() => removeInterest(interest)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Beliebte Tags</p>
            <div className="flex flex-wrap gap-2">
              {suggestionsLoading ? (
                <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>
              ) : availableInterestSuggestions.length > 0 ? (
                availableInterestSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => {
                      if (tryAddInterest(suggestion.name)) {
                        setInput("");
                      }
                    }}
                  >
                    <span>{suggestion.name}</span>
                    {suggestion.usage > 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {suggestion.usage}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Keine Vorschläge verfügbar.</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={resetInterests}
              disabled={!state.dirty}
              className="w-full sm:w-auto"
            >
              Änderungen verwerfen
            </Button>
            <Button type="submit" disabled={!state.dirty || saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                "Interessen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
