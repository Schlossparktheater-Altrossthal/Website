"use client";

import { CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Schwebende Leiste für Aktionen auf mehreren ausgewählten Einträgen. Erscheint nur bei
 * Auswahl; Aktionen kommen als Kinder (Buttons, Menüs).
 */
export function BulkActionBar({
  count,
  noun = ["Eintrag", "Einträge"],
  onClear,
  children,
  className,
}: {
  count: number;
  noun?: [singular: string, plural: string];
  onClear: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Aktionen für Auswahl"
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2 text-popover-foreground shadow-lg",
        className,
      )}
    >
      <span className="px-1 text-sm font-medium tabular-nums" aria-live="polite">
        {count} {count === 1 ? noun[0] : noun[1]} ausgewählt
      </span>
      <span className="h-5 w-px bg-border" aria-hidden />
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onClear}
        aria-label="Auswahl aufheben"
        title="Auswahl aufheben"
      >
        <CloseIcon className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
