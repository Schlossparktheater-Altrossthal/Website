"use client";

import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

/**
 * Sofortige Rückmeldung am angeklickten Link, solange die Zielseite lädt.
 * Muss innerhalb eines `<Link>` stehen. Erscheint mit kurzer Verzögerung, damit schnelle
 * Wechsel (Cache/Vorabladen) nicht flackern.
 */
export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none size-1.5 shrink-0 rounded-full bg-primary opacity-0 transition-opacity",
        pending && "animate-pulse opacity-100 delay-100",
        className,
      )}
    />
  );
}
