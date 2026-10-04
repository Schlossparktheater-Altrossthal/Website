"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  ALLERGEN_KIND_LABELS,
  findAllergenEntry,
  suggestAllergens,
  type AllergenCatalogEntry,
} from "@/data/allergens";
import type { TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { cn } from "@/lib/utils";

type Suggestion = AllergenCatalogEntry & { parentName?: string | null; isGroup?: boolean };

const SEARCH_DELAY_MS = 200;

/** Taxon-Vorschlag → Katalogform; die Art kommt aus dem Katalog, sonst aus der Taxon-Art. */
function fromTaxon(taxon: TaxonSuggestion): Suggestion {
  const catalog = findAllergenEntry(taxon.name);
  return {
    value: taxon.code,
    label: taxon.name,
    kind: catalog?.kind ?? (taxon.kind === "SENSITIVITY" ? "INTOLERANCE" : "ALLERGY"),
    aliases: [],
    parentName: taxon.parentName,
    isGroup: taxon.isGroup,
  };
}

/**
 * Vorschläge aus der Lebensmittel-Taxonomie (`/api/food/taxa`), solange die Suche läuft oder
 * nicht erreichbar ist aus dem lokalen Katalog.
 */
function useSuggestions(query: string): Suggestion[] {
  const catalog = useMemo(() => suggestAllergens(query, 8), [query]);
  const [remote, setRemote] = useState<{ query: string; items: Suggestion[] } | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/food/taxa?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { items?: TaxonSuggestion[] } | null) => {
          if (data?.items) setRemote({ query, items: data.items.map(fromTaxon) });
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("[allergen-field] Taxonomie-Suche fehlgeschlagen", error);
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return remote && remote.query === query && remote.items.length > 0 ? remote.items : catalog;
}

type AllergenFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Wird gerufen, wenn der Text aus dem Katalog stammt – die Art lässt sich damit vorbelegen. */
  onSelectEntry?: (entry: AllergenCatalogEntry) => void;
  inputId?: string;
  placeholder?: string;
  describedBy?: string;
};

/**
 * Eingabefeld mit Vorschlägen aus der Lebensmittel-Taxonomie (docs/Plan/ernaehrung-rezepte-ui-plan.md).
 * Freitext bleibt möglich und wird beim Speichern automatisch zugeordnet oder als „wird geprüft“
 * markiert. Tippen filtert, Pfeiltasten wählen aus, Enter übernimmt.
 */
export function AllergenField({
  value,
  onChange,
  onSelectEntry,
  inputId,
  placeholder,
  describedBy,
}: AllergenFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useSuggestions(value);
  const listboxId = useId();
  const showList = open && suggestions.length > 0;

  const select = (entry: Suggestion) => {
    onChange(entry.label);
    onSelectEntry?.(entry);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showList) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((previous) => {
        const next = event.key === "ArrowDown" ? previous + 1 : previous - 1;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    }
  };

  return (
    <Popover
      open={showList}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActiveIndex(-1);
      }}
    >
      {/* Anker statt Trigger: `PopoverTrigger` würde dem Feld `type="button"` geben und es damit
          unbeschreibbar machen. */}
      <PopoverAnchor asChild>
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="max-h-64 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1"
      >
        <ul id={listboxId} role="listbox" aria-label="Vorschläge" className="text-sm">
          {suggestions.map((entry, index) => (
            <li
              key={entry.value}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5",
                index === activeIndex && "bg-muted",
              )}
              // Mousedown statt Click, damit der Fokus im Feld bleibt und der Wert gesetzt wird.
              onMouseDown={(event) => {
                event.preventDefault();
                select(entry);
              }}
            >
              <span className="font-medium text-foreground">{entry.label}</span>
              <span className="text-muted-foreground">
                {" · "}
                {entry.parentName ?? ALLERGEN_KIND_LABELS[entry.kind]}
              </span>
              {entry.isGroup ? (
                <span className="block text-xs text-muted-foreground">
                  Gilt für alle Unterarten – nur bestimmte? Dann einzeln wählen.
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
