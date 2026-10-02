"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Für Screenreader; sichtbar nur mit `showDescription`. */
  description: string;
  showDescription?: boolean;
  /** Rechts neben dem Titel, z. B. eine Aktion. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  /** Fester Bereich unten (z. B. Speichern). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Blatt mit festem Kopf und Fuß, dazwischen scrollt der Inhalt. Baut auf `DialogContent` auf:
 * mobil von unten mit Wisch-Geste zum Schließen, ab 640 px ein zentrierter Dialog.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  showDescription = false,
  headerAction,
  children,
  footer,
  className,
}: BottomSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:p-0", className)}
      >
        <DialogHeader className="shrink-0 space-y-0.5 px-4 pb-3 pr-12 pt-6 sm:px-6 sm:pr-12 sm:pt-6">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            {headerAction}
          </div>
          <DialogDescription className={showDescription ? undefined : "sr-only"}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
