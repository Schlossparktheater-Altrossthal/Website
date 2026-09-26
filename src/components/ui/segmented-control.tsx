"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Zugänglicher Name, falls `label` nur ein Icon oder eine Kurzform ist. */
  ariaLabel?: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "md";
  /** Segmente teilen sich die volle Breite (mobil). */
  fullWidth?: boolean;
  className?: string;
  /** Klassen für das aktive Segment, z. B. Statusfarben. */
  activeClassName?: (value: T) => string | undefined;
};

/** Kleine Auswahl aus 2–4 Optionen (Filter, Status). Für Seitenbereiche `SectionNav` verwenden. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "sm",
  fullWidth = false,
  className,
  activeClassName,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3 text-sm",
              fullWidth && "flex-1",
              active
                ? cn(
                    "bg-background text-foreground shadow-sm ring-1 ring-border",
                    activeClassName?.(option.value),
                  )
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
