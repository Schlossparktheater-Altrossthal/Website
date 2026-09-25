import * as React from "react";

import { cn } from "@/lib/utils";

type ProfileFieldsetProps = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Gruppe zusammengehöriger Felder innerhalb eines Profilbereichs. */
export function ProfileFieldset({ title, description, children, className }: ProfileFieldsetProps) {
  return (
    <fieldset className={cn("min-w-0 space-y-4 py-5 first:pt-0 last:pb-0", className)}>
      <legend className="sr-only">{title}</legend>
      <div className="space-y-0.5" aria-hidden>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

type FieldProps = {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Label, Eingabe, Fehler und Hinweis in fester Reihenfolge und mit engem Abstand. */
export function ProfileField({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
