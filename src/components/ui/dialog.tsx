"use client";

import { XIcon } from "@/components/ui/action-icons";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const CLOSE_DISTANCE = 80;
const MOBILE_QUERY = "(max-width: 639px)";

/** Handy-Breite; ohne `matchMedia` (z. B. jsdom) gilt Desktop. */
function isMobileViewport() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Mobil nach unten wischen zum Schließen: startet nur auf Elementen mit `data-swipe-handle`
 * (Griffleiste, Dialogkopf), damit der Inhalt normal scrollt und Knöpfe klickbar bleiben.
 */
function useSwipeToClose(close: () => void) {
  const [offset, setOffset] = React.useState(0);
  const start = React.useRef<number | null>(null);

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-swipe-handle]")) return;
      if (target.closest("button, a, input, textarea, select, [role='button']")) return;
      if (!isMobileViewport()) return;
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
      if (offset > CLOSE_DISTANCE) close();
      else setOffset(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setOffset(0);
    },
  };

  return { offset, handlers };
}

const TEXT_FIELD =
  "input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, [contenteditable=true]";

/**
 * Mobile Tastatur: iOS verkleinert beim Einblenden nur den sichtbaren Bereich, nicht `dvh`.
 * Liefert, wie weit die Tastatur von unten hereinragt und wie hoch der sichtbare Bereich ist.
 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = React.useState({ bottom: 0, height: 0 });
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setInset(bottom > 1 ? { bottom, height: viewport.height } : { bottom: 0, height: 0 });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, onOpenAutoFocus, onFocus, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement);
  const { offset, handlers } = useSwipeToClose(() => closeRef.current?.click());
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => setMobile(isMobileViewport()), []);
  const keyboard = useKeyboardInset(mobile);

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(keyboard.bottom
      ? { bottom: keyboard.bottom, maxHeight: Math.round(keyboard.height * 0.95) }
      : null),
    ...(offset ? { transform: `translateY(${offset}px)`, transition: "none" } : null),
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        className={cn(
          // Mobil ein Blatt von unten, ab 640 px ein zentrierter Dialog.
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[90dvh] w-full gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-7 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          className,
        )}
        style={mergedStyle}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented || !isMobileViewport()) return;
          // Mobil nicht gleich ins erste Feld springen: die Tastatur würde mit dem Blatt aufklappen
          // und es verdecken. Fokus auf den Dialog selbst, auch wenn ein Feld `autoFocus` hat.
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        onFocus={(event) => {
          onFocus?.(event);
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.matches(TEXT_FIELD)) return;
          if (!isMobileViewport()) return;
          // Nach dem Einblenden der Tastatur das Feld in den sichtbaren Teil holen.
          window.setTimeout(
            () => target.scrollIntoView({ block: "center", behavior: "smooth" }),
            300,
          );
        }}
        {...handlers}
        {...props}
      >
        {/* Griffleiste zum Wegwischen, nur mobil. */}
        <div
          aria-hidden
          data-swipe-handle
          className="absolute inset-x-0 top-0 z-10 h-7 touch-none sm:hidden"
        >
          <span className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/40" />
        </div>
        {children}
        <DialogPrimitive.Close
          ref={closeRef}
          className="absolute right-4 top-7 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:top-4 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Schließen</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-swipe-handle
    className={cn("flex touch-none flex-col space-y-1.5 pr-6 text-left sm:touch-auto", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:gap-0 sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
