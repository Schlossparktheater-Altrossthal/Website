"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const CLOSE_DISTANCE = 80;

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
 * Mobiles Blatt von unten: Griff und Kopf lassen sich nach unten wischen, der Inhalt scrollt
 * innerhalb der Bildschirmhöhe (`dvh`, damit die Browserleiste nichts verdeckt).
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
  const [offset, setOffset] = React.useState(0);
  const start = React.useRef<number | null>(null);

  const [wasOpen, setWasOpen] = React.useState(open);
  // Beim erneuten Öffnen ohne Versatz starten (Zustand aus Props, ohne Effekt).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOffset(0);
  }

  const dragHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      // Knöpfe im Kopf (Schließen, Aktionen) bleiben normal klickbar.
      if (event.target instanceof Element && event.target.closest("button, a")) return;
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (start.current === null) return;
      setOffset(Math.max(0, event.clientY - start.current));
    },
    onPointerUp: () => {
      if (start.current === null) return;
      start.current = null;
      if (offset > CLOSE_DISTANCE) onOpenChange(false);
      else setOffset(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setOffset(0);
    },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={offset ? { transform: `translateY(${offset}px)`, transition: "none" } : undefined}
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl p-0 [&>button:first-child]:top-5",
          className,
        )}
      >
        <div className="shrink-0 touch-none select-none px-4 pb-3 pt-2" {...dragHandlers}>
          <span
            aria-hidden
            className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-muted-foreground/40"
          />
          <SheetHeader className="space-y-0.5 pr-8 text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-lg">{title}</SheetTitle>
              {headerAction}
            </div>
            <SheetDescription className={showDescription ? undefined : "sr-only"}>
              {description}
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
