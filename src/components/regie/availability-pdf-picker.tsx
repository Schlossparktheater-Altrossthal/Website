"use client";

import * as React from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  AVAILABILITY_MODE_HINTS,
  AVAILABILITY_MODE_LABELS,
  AVAILABILITY_MODES,
  AVAILABILITY_WEEK_OPTIONS,
  availabilityQuery,
  parseAvailabilityRange,
  type AvailabilityRange,
} from "@/lib/regie/availability-range";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "regie-verfuegbarkeit-pdf";

/** Gemerkte Auswahl (Browser) oder Vorgabe. */
export function useSavedAvailabilityRange(initial?: AvailabilityRange) {
  const [range, setRange] = React.useState<AvailabilityRange>(
    initial ?? parseAvailabilityRange(null, null),
  );
  const load = React.useCallback(() => {
    if (initial) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) setRange(parseAvailabilityRange(saved.mode, String(saved.weeks)));
    } catch {
      // ungültig gespeichert: Vorgabe behalten
    }
  }, [initial]);
  const update = (next: AvailabilityRange) => {
    setRange(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // privater Modus o. Ä.
    }
  };
  return { range, update, load };
}

/** Auswahl „welche Tage“ + „wie viele Wochen“ – im PDF-Fenster und in der Probenmappe. */
export function AvailabilityRangeFields({
  range,
  onChange,
}: {
  range: AvailabilityRange;
  onChange: (range: AvailabilityRange) => void;
}) {
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Welche Tage?</legend>
        {AVAILABILITY_MODES.map((mode) => {
          const active = range.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...range, mode })}
              className={cn(
                "flex w-full min-h-12 items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0 rounded-full border-2",
                  active
                    ? "border-primary bg-primary shadow-[inset_0_0_0_2px_var(--background)]"
                    : "border-muted-foreground/50",
                )}
              />
              <span>
                <span className="block font-medium">{AVAILABILITY_MODE_LABELS[mode]}</span>
                <span className="block text-xs text-muted-foreground">
                  {AVAILABILITY_MODE_HINTS[mode]}
                </span>
              </span>
            </button>
          );
        })}
      </fieldset>
      <div className="space-y-2">
        <p className="text-sm font-medium">Zeitraum</p>
        <SegmentedControl
          aria-label="Zeitraum"
          fullWidth
          size="md"
          value={String(range.weeks)}
          onValueChange={(value) => onChange({ ...range, weeks: Number(value) })}
          options={AVAILABILITY_WEEK_OPTIONS.map((weeks) => ({
            value: String(weeks),
            label: weeks === 1 ? "diese Woche" : `${weeks} Wochen`,
          }))}
        />
      </div>
    </div>
  );
}

/** „PDF“-Knopf der Verfügbarkeit: fragt erst, welche Fassung erstellt werden soll. */
export function AvailabilityPdfButton({
  pdfHref,
  initial,
  size = "md",
  className,
}: {
  pdfHref: string;
  /** Vorauswahl aus der aktuellen Ansicht (sonst gemerkte Auswahl). */
  initial?: AvailabilityRange;
  size?: "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { range, update, load } = useSavedAvailabilityRange(initial);
  const href = `${pdfHref}?${availabilityQuery(range)}`;

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={className}
        onClick={() => {
          load();
          setOpen(true);
        }}
      >
        PDF
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Verfügbarkeit als PDF"
        description="Welche Fassung soll erstellt werden?"
        showDescription
        footer={
          <div className="flex gap-2 p-4 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button asChild className="flex-1">
              <a href={href} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
                PDF öffnen
              </a>
            </Button>
          </div>
        }
      >
        <AvailabilityRangeFields range={range} onChange={update} />
        <p className="mt-3 text-xs text-muted-foreground">
          Mit Gründen und den probbaren Szenen je Tag.
        </p>
      </BottomSheet>
    </>
  );
}
