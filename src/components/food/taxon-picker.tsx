"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import type { TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 200;

/** Suche in der Lebensmittel-Taxonomie mit Ergebnisliste (für Dialoge). */
export function TaxonPicker({
  initialQuery = "",
  onPick,
  disabled,
}: {
  initialQuery?: string;
  onPick: (taxon: TaxonSuggestion) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TaxonSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/food/taxa?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((data: { items?: TaxonSuggestion[] }) => setResults(data.items ?? []))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("[taxon-picker] Suche fehlgeschlagen", error);
          }
        })
        .finally(() => setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Lebensmittel oder Allergen suchen"
        aria-label="In der Lebensmittel-Taxonomie suchen"
      />
      <ul className="max-h-72 space-y-1 overflow-y-auto" aria-live="polite">
        {results.map((taxon) => (
          <li key={taxon.code}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(taxon)}
              className={cn(
                "flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm",
                "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50",
              )}
            >
              <span className="font-medium text-foreground">{taxon.name}</span>
              <span className="text-xs text-muted-foreground">
                {[
                  taxon.path?.length ? taxon.path.join(" › ") : taxon.parentName,
                  taxon.lmiv ? "kennzeichnungspflichtig" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          </li>
        ))}
        {!loading && query.trim().length >= 2 && results.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">Nichts gefunden.</li>
        ) : null}
      </ul>
    </div>
  );
}
