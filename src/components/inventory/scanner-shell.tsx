"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { QrScanner, type ScanSignal } from "@/components/inventory/qr-scanner";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  XCircleIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SheetSnap = "peek" | "half" | "full";

export type ScanToast = {
  key: number;
  tone: "ok" | "warn" | "error";
  title: string;
  detail?: string;
};

const SNAP_ORDER: SheetSnap[] = ["peek", "half", "full"];
const SNAP_HEIGHT: Record<SheetSnap, string> = {
  peek: "max-h-0",
  half: "max-h-[38dvh]",
  full: "max-h-[68dvh]",
};
const TOAST_MS = 2500;

export function ScanToneIcon({
  tone,
  className,
}: {
  tone: "ok" | "warn" | "error" | "pending";
  className?: string;
}) {
  if (tone === "ok") return <CheckCircleIcon className={cn("text-success", className)} />;
  if (tone === "error") return <XCircleIcon className={cn("text-destructive", className)} />;
  return <AlertTriangleIcon className={cn("text-warning", className)} />;
}

/**
 * Vollbild-Scanner fürs Handy: Kamera über den ganzen Bildschirm, oben Schließen + Kontext,
 * unten ein Blatt mit drei Stufen (eingeklappt / halb / fast voll) und einer festen Leiste
 * in Daumenreichweite. Liegt per Portal über Menü und Bottom-Leiste; Dialoge öffnen darüber.
 */
export function ScannerShell({
  closeHref,
  title,
  context,
  onScan,
  paused,
  hint,
  signal,
  toast,
  summary,
  snap,
  onSnapChange,
  children,
  footer,
}: {
  closeHref: string;
  title: string;
  /** Chip unter der Kopfzeile, z. B. das aktuelle Ziel. */
  context?: React.ReactNode;
  onScan: (text: string) => void;
  paused: boolean;
  hint: string;
  signal: ScanSignal | null;
  toast: ScanToast | null;
  /** Kopfzeile des Blatts, auch eingeklappt sichtbar. */
  summary: React.ReactNode;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [visibleToast, setVisibleToast] = React.useState<ScanToast | null>(null);
  const drag = React.useRef<{ y: number } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    setVisibleToast(toast);
    const timer = window.setTimeout(() => setVisibleToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Seite darunter soll nicht mitscrollen.
  React.useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  const step = (direction: 1 | -1) => {
    const index = SNAP_ORDER.indexOf(snap) + direction;
    onSnapChange(SNAP_ORDER[Math.max(0, Math.min(SNAP_ORDER.length - 1, index))]!);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { y: event.clientY };
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const delta = event.clientY - start.y;
    if (Math.abs(delta) > 30) {
      step(delta < 0 ? 1 : -1);
    } else {
      onSnapChange(snap === "peek" ? "half" : "peek");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <QrScanner
        variant="fullscreen"
        onScan={onScan}
        paused={paused}
        hint={hint}
        signal={signal}
        controlsClassName="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3"
      />

      <div className="pointer-events-none relative flex flex-col items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] [&>*]:pointer-events-auto">
        <div className="flex max-w-[calc(100%-9rem)] items-center gap-2">
          <Button asChild size="icon" variant="subtle" aria-label="Scanner schließen">
            <Link href={closeHref}>
              <CloseIcon />
            </Link>
          </Button>
          <p className="truncate rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white">
            {title}
          </p>
        </div>
        {context}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col">
        {visibleToast ? (
          <div
            key={visibleToast.key}
            role="status"
            className="mx-3 mb-3 flex items-start gap-3 rounded-xl bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2"
          >
            <ScanToneIcon tone={visibleToast.tone} className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{visibleToast.title}</p>
              {visibleToast.detail ? (
                <p className="text-xs break-words text-muted-foreground">{visibleToast.detail}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="rounded-t-2xl bg-background shadow-[0_-8px_24px_rgb(0_0_0/0.25)]">
          <button
            type="button"
            className="block w-full touch-none px-4 pt-2 pb-2 text-left"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (drag.current = null)}
            onClick={(event) => {
              // Nur Tastatur (detail 0); Maus/Touch laufen über die Pointer-Ereignisse.
              if (event.detail === 0) onSnapChange(snap === "peek" ? "half" : "peek");
            }}
            aria-expanded={snap !== "peek"}
            aria-label={snap === "peek" ? "Liste aufklappen" : "Liste einklappen"}
          >
            <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-muted-foreground/40" />
            {summary}
          </button>
          <div
            className={cn(
              "overflow-y-auto overscroll-contain transition-[max-height] duration-200",
              SNAP_HEIGHT[snap],
            )}
            aria-hidden={snap === "peek"}
          >
            {children}
          </div>
          <div className="border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
