"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cssColorToHex, hexToOklchValue } from "@/lib/theme/color-value";
import { cn } from "@/lib/utils";

import { variableLabel } from "./theme-utils";

type ThemeColorFieldProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Kompaktes Farbfeld: Farbfleck, Name und Wert in einer Zeile; Antippen öffnet Farbwähler
 * und Texteingabe (für oklch()/var()-Werte).
 */
export function ThemeColorField({ name, value, onChange, disabled }: ThemeColorFieldProps) {
  const hex = cssColorToHex(value);
  const inputId = React.useId();
  const label = variableLabel(name);
  return (
    <Popover modal>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-border",
          )}
          aria-label={`${label} (--${name}) bearbeiten`}
        >
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-md border border-border/60"
            style={{ background: value || "transparent" }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">{label}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {value || "Standard"}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="font-mono text-xs text-muted-foreground">--{name}</p>
        </div>
        <input
          type="color"
          aria-label={`Farbe für ${label} wählen`}
          className={cn(
            "h-24 w-full cursor-pointer rounded-md border border-border bg-transparent p-1",
            !hex && "cursor-not-allowed opacity-40",
          )}
          value={hex ?? "#000000"}
          disabled={!hex}
          onChange={(event) => {
            const next = hexToOklchValue(event.target.value);
            if (next) onChange(next);
          }}
        />
        <div className="space-y-1">
          <Label htmlFor={inputId} className="text-xs">
            Wert
          </Label>
          <Input
            id={inputId}
            value={value}
            maxLength={400}
            placeholder="leer = Standard"
            onChange={(event) => onChange(event.target.value)}
            className="font-mono text-xs"
          />
          {!hex && value ? (
            <p className="text-xs text-muted-foreground">
              Kein fester Farbwert (z. B. var(…)) – bitte als Text bearbeiten.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
