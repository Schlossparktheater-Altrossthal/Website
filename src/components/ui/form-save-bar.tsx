"use client";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormSaveBarProps = {
  dirty: boolean;
  submitting?: boolean;
  onReset?: () => void;
  submitLabel?: string;
  /** Text links neben den Aktionen, wenn `dirty` (Standard „Ungespeicherte Änderungen“). */
  dirtyLabel?: string;
  /** Formular-ID, falls die Leiste außerhalb des `<form>` steht. */
  form?: string;
  className?: string;
};

/**
 * Einheitliche Speichern-Leiste für Formulare. Bei ungespeicherten Änderungen haftet sie
 * unten am Bildschirmrand, damit „Speichern“ mobil ohne Scrollen erreichbar ist – über der
 * mobilen Navigationsleiste (`--members-bottom-nav` aus `MembersAppShell`), nicht dahinter.
 */
export function FormSaveBar({
  dirty,
  submitting = false,
  onReset,
  submitLabel = "Speichern",
  dirtyLabel = "Ungespeicherte Änderungen",
  form,
  className,
}: FormSaveBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 pt-2",
        dirty &&
          "sticky bottom-[var(--members-bottom-nav,0px)] z-20 -mx-4 mt-2 border-t border-border/60 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      {dirty ? (
        <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {dirtyLabel}
        </span>
      ) : null}
      {dirty && onReset ? (
        <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={submitting}>
          Verwerfen
        </Button>
      ) : null}
      <AsyncButton
        type="submit"
        form={form}
        size="sm"
        isLoading={submitting}
        loadingText="Speichern…"
        disabled={!dirty}
      >
        {submitLabel}
      </AsyncButton>
    </div>
  );
}
