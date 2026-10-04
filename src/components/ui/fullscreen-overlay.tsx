"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface FullscreenOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Beschriftung für Screenreader. */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Legt Inhalte bildschirmfüllend über die Seite (Portal, damit Sidebar/Bottom-Leiste und
 * transformierte Eltern nicht stören). Wo der Browser es kann (Android, Desktop), wird zusätzlich
 * der echte Vollbildmodus angefordert, um die Browserleisten auszublenden – iPhone-Safari
 * unterstützt das nicht, dort bleibt es beim Overlay. Escape bzw. Verlassen des
 * Browser-Vollbilds schließen das Overlay.
 */
export function FullscreenOverlay({
  open,
  onClose,
  label,
  className,
  children,
}: FullscreenOverlayProps) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const root = document.documentElement;
    let enteredNative = false;
    if (typeof root.requestFullscreen === "function" && !document.fullscreenElement) {
      root
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          enteredNative = true;
        })
        .catch(() => {
          // nicht erlaubt oder nicht unterstützt – Overlay reicht
        });
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const handleFullscreenChange = () => {
      if (enteredNative && !document.fullscreenElement) onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
