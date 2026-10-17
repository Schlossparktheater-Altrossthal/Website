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
      "fixed inset-0 z-50 bg-black/80 duration-200 max-sm:transition-none sm:bg-black/60 sm:backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const TEXT_FIELD =
  "input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, [contenteditable=true]";

const MOBILE_QUERY = "(max-width: 639px)";

/** Handy-Breite; ohne `matchMedia` (z. B. jsdom) gilt Desktop. */
function isMobileViewport() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Wie weit sich das Blatt über seine Ruhelage nach oben ziehen lässt. */
const STRETCH_MAX = 48;
/** Schließen ab diesem Anteil der Blatthöhe oder mit einem schnellen Wisch nach unten. */
const CLOSE_RATIO = 0.3;
const CLOSE_MIN = 80;
const FLICK_VELOCITY = 0.6; // px/ms
const SPRING = { stiffness: 380, damping: 32 };

/** Gummiband: je weiter gezogen, desto zäher, nie über `max`. */
function rubberBand(distance: number, max: number) {
  return max * (1 - 1 / (distance / max + 1));
}

/**
 * Mobiles Blatt mit Federphysik: fährt per Feder herein (Position wird direkt am Element
 * gesetzt, nicht per CSS-Animation, damit es immer in der Ruhelage ankommt), lässt sich am
 * Griff (`data-swipe-handle`) nach unten wegwischen und mit Widerstand etwas nach oben dehnen.
 * Beim Loslassen zählt die Geschwindigkeit: ein schneller Wisch schließt auch bei kurzem Weg.
 */
function useSheetPhysics(
  contentRef: React.RefObject<HTMLDivElement | null>,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  const state = React.useRef({
    y: 0,
    velocity: 0,
    frame: 0,
    drag: null as null | { pointerId: number; startY: number; startOffset: number },
    samples: [] as { t: number; y: number }[],
  });

  const apply = React.useCallback(
    (y: number) => {
      const el = contentRef.current;
      if (!el) return;
      state.current.y = y;
      if (Math.abs(y) < 0.5) {
        el.style.transform = "";
        el.style.boxShadow = "";
      } else if (y < 0) {
        // Nach oben gedehnt: Schatten in Blattfarbe füllt die Lücke zum unteren Rand.
        el.style.transform = `translateY(${y}px)`;
        el.style.boxShadow = `0 ${Math.ceil(-y)}px 0 0 var(--background)`;
      } else {
        el.style.transform = `translateY(${y}px)`;
        el.style.boxShadow = "";
      }
      const overlay = overlayRef.current;
      if (overlay) {
        const height = el.offsetHeight || 1;
        overlay.style.opacity = y > 0 ? String(Math.max(0, 1 - y / height)) : "";
      }
    },
    [contentRef, overlayRef],
  );

  const stop = React.useCallback(() => {
    if (state.current.frame) window.cancelAnimationFrame(state.current.frame);
    state.current.frame = 0;
  }, []);

  /** Gedämpfte Feder zum Ziel; `onRest` nach dem Einschwingen. */
  const animateTo = React.useCallback(
    (target: number, onRest?: () => void) => {
      stop();
      if (prefersReducedMotion()) {
        apply(target);
        onRest?.();
        return;
      }
      let last = performance.now();
      const step = (now: number) => {
        const s = state.current;
        const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
        last = now;
        const force = -SPRING.stiffness * (s.y - target) - SPRING.damping * s.velocity;
        s.velocity += force * dt;
        const y = s.y + s.velocity * dt;
        if (Math.abs(y - target) < 0.5 && Math.abs(s.velocity) < 20) {
          s.velocity = 0;
          s.frame = 0;
          apply(target);
          onRest?.();
          return;
        }
        apply(y);
        s.frame = window.requestAnimationFrame(step);
      };
      state.current.frame = window.requestAnimationFrame(step);
    },
    [apply, stop],
  );

  // Hereinfahren, sobald Radix das Blatt einhängt (die Komponente selbst bleibt auch
  // geschlossen eingehängt): unterhalb des Bildschirms starten, dann federnd in die Ruhelage.
  const enterRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) {
        stop();
        return;
      }
      if (!isMobileViewport()) return;
      state.current.velocity = 0;
      state.current.drag = null;
      apply(el.offsetHeight || window.innerHeight);
      animateTo(0);
    },
    [apply, animateTo, stop],
  );

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-swipe-handle]")) return;
      if (target.closest("button, a, input, textarea, select, [role='button']")) return;
      if (!isMobileViewport()) return;
      stop();
      // Offene Tastatur zuerst einklappen: sonst springt das Blatt beim Loslassen mit ihr.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches(TEXT_FIELD)) active.blur();
      // Mitten in der Feder greifen: von der aktuellen Position weiterziehen.
      const s = state.current;
      const startOffset =
        s.y < 0 ? -STRETCH_MAX * (1 / (1 - Math.min(0.95, -s.y / STRETCH_MAX)) - 1) : s.y;
      s.drag = { pointerId: event.pointerId, startY: event.clientY, startOffset };
      s.samples = [{ t: event.timeStamp, y: event.clientY }];
      s.velocity = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const s = state.current;
      if (!s.drag || s.drag.pointerId !== event.pointerId) return;
      const raw = s.drag.startOffset + event.clientY - s.drag.startY;
      apply(raw >= 0 ? raw : -rubberBand(-raw, STRETCH_MAX));
      s.samples.push({ t: event.timeStamp, y: event.clientY });
      if (s.samples.length > 6) s.samples.shift();
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      const s = state.current;
      if (!s.drag || s.drag.pointerId !== event.pointerId) return;
      s.drag = null;
      const first = s.samples[0];
      const last = s.samples[s.samples.length - 1];
      const dt = last && first ? last.t - first.t : 0;
      const velocity = dt > 0 ? (last.y - first.y) / dt : 0; // px/ms
      const height = contentRef.current?.offsetHeight ?? window.innerHeight;
      const farEnough = s.y > Math.max(CLOSE_MIN, height * CLOSE_RATIO);
      const flicked = velocity > FLICK_VELOCITY && s.y > 10;
      s.velocity = velocity * 1000;
      if ((farEnough && velocity > -0.2) || flicked) {
        // Mit Schwung hinaus, dann schließen (Radix' Ausblende-Animation startet unten).
        animateTo(height, close);
      } else {
        animateTo(0);
      }
    },
    onPointerCancel: () => {
      state.current.drag = null;
      animateTo(0);
    },
  };

  return { handlers, enterRef };
}

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
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const { handlers, enterRef } = useSheetPhysics(contentRef, overlayRef, () =>
    closeRef.current?.click(),
  );
  const setContentNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      enterRef(node);
    },
    [enterRef],
  );
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => setMobile(isMobileViewport()), []);
  const keyboard = useKeyboardInset(mobile);
  // `autoFocus` greift schon beim Einhängen, Radix meldet dann kein onOpenAutoFocus mehr.
  React.useEffect(() => {
    if (!isMobileViewport()) return;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        contentRef.current?.contains(active) &&
        active.matches(TEXT_FIELD)
      )
        contentRef.current.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(keyboard.bottom
      ? { bottom: keyboard.bottom, maxHeight: Math.round(keyboard.height * 0.95) }
      : null),
  };

  return (
    <DialogPortal>
      <DialogOverlay ref={overlayRef} />
      <DialogPrimitive.Content
        ref={setContentNode}
        className={cn(
          // Mobil ein Blatt von unten, ab 640 px ein zentrierter Dialog.
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[90dvh] w-full gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-7 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:animate-none",
          // Keine CSS-Transition auf der Federposition, sonst gleitet das Blatt erst nach unten.
          "max-sm:transition-none",
          "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-90 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[49%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[46%]",
          // Desktop: federnd mit leichtem Überschwingen auf, schnell und weich zu.
          "sm:data-[state=open]:duration-300 sm:data-[state=open]:ease-[cubic-bezier(0.34,1.4,0.64,1)] sm:data-[state=closed]:duration-150 sm:data-[state=closed]:ease-in motion-reduce:animate-none",
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
