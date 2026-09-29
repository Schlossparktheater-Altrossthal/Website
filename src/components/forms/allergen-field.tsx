"use client";

import { useId, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  ALLERGEN_KIND_LABELS,
  suggestAllergens,
  type AllergenCatalogEntry,
} from "@/data/allergens";
import { cn } from "@/lib/utils";

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
 * Eingabefeld mit Vorschlägen aus dem Allergen-Katalog. Freitext bleibt möglich, weil keine
 * Liste alle Sonderfälle kennt: Tippen filtert, Pfeiltasten wählen aus, Enter übernimmt.
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
  const suggestions = useMemo(() => suggestAllergens(value, 8), [value]);
  const listboxId = useId();
  const showList = open && suggestions.length > 0;

  const select = (entry: AllergenCatalogEntry) => {
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
              <span className="text-muted-foreground"> · {ALLERGEN_KIND_LABELS[entry.kind]}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
