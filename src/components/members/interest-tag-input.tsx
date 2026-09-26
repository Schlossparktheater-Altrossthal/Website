"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { PlusIcon, XIcon } from "@/components/ui/action-icons";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
import { useInterestSuggestions } from "@/hooks/useInterestSuggestions";

const interestSchema = z
  .string()
  .trim()
  .min(2, "Interesse ist zu kurz")
  .max(80, "Interesse ist zu lang");

const INTEREST_SEPARATOR_PATTERN = /[;,\n]/;
const INTEREST_SEPARATOR_SPLIT_PATTERN = /[,;\n]+/;
// Lange Freitexte aus alten Einträgen sind als Vorschlag unbrauchbar.
const SUGGESTION_MAX_LENGTH = 24;

type InterestTagInputProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
};

/** Schlagwort-Eingabe für Interessen mit Vorschlägen (Profil und Rückkehrer-Wizard). */
export function InterestTagInput({ id, label, value, onChange }: InterestTagInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { suggestions, loading } = useInterestSuggestions();

  const availableSuggestions = useMemo(() => {
    const selected = new Set(value.map((item) => item.toLowerCase()));
    return suggestions
      .filter(
        (suggestion) =>
          suggestion.name &&
          suggestion.name.length <= SUGGESTION_MAX_LENGTH &&
          !selected.has(suggestion.name.toLowerCase()),
      )
      .slice(0, 10);
  }, [suggestions, value]);

  // Arbeitet auf einer Zwischenliste, damit mehrere Einträge aus einer Eingabe landen.
  const tryAdd = (items: string[], rawValue: string): string[] | null => {
    setError(null);
    const parsed = interestSchema.safeParse(rawValue);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültiges Interesse");
      return null;
    }
    const next = parsed.data;
    if (items.length >= MAX_INTERESTS_PER_USER) {
      setError(`Maximal ${MAX_INTERESTS_PER_USER} Interessen erlaubt.`);
      return null;
    }
    if (items.some((entry) => entry.toLowerCase() === next.toLowerCase())) {
      setError("Dieses Interesse ist bereits erfasst.");
      return null;
    }
    return [...items, next];
  };

  const addFromInput = () => {
    const next = tryAdd(value, input);
    if (next) {
      onChange(next);
      setInput("");
    }
  };

  const handleInputChange = (raw: string) => {
    if (!INTEREST_SEPARATOR_PATTERN.test(raw)) {
      setInput(raw);
      return;
    }
    const segments = raw.split(INTEREST_SEPARATOR_SPLIT_PATTERN);
    const remainder = segments.pop() ?? "";
    let items = value;
    for (const segment of segments) {
      const clean = segment.trim();
      if (!clean) continue;
      items = tryAdd(items, clean) ?? items;
    }
    if (items !== value) onChange(items);
    setInput(remainder.replace(/^\s+/, ""));
  };

  const remove = (interest: string) => onChange(value.filter((item) => item !== interest));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
          {value.map((interest) => (
            <span
              key={interest}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-sm text-foreground"
            >
              <span className="truncate">{interest}</span>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={`${interest} entfernen`}
                onClick={() => remove(interest)}
              >
                <XIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={id}
            value={input}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFromInput();
              } else if (event.key === "Backspace" && !input && value.length) {
                remove(value[value.length - 1]);
              }
            }}
            onBlur={() => {
              if (input.trim()) addFromInput();
            }}
            enterKeyHint="done"
            placeholder={value.length ? "Weiteres …" : "z. B. Licht, Nähen, Gesang"}
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

      {loading || availableSuggestions.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Vorschläge</p>
          <div className="flex flex-wrap gap-1.5">
            {loading ? (
              <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>
            ) : (
              availableSuggestions.map((suggestion) => (
                <button
                  key={suggestion.name}
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  onClick={() => {
                    const next = tryAdd(value, suggestion.name);
                    if (next) onChange(next);
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
    </div>
  );
}
