"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

/**
 * Stufenloser Regler (Radix). Bei Touch reagiert nur der Griff: Die Spur lässt vertikales
 * Scrollen durch (`touch-pan-y`) und ignoriert Berührungen, damit man beim Scrollen durch
 * lange Listen nicht versehentlich Werte verstellt. Maus/Stift dürfen auf die Spur klicken.
 */
export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabel?: string }
>(({ className, thumbLabel, onPointerDown, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-8 w-full touch-pan-y select-none items-center data-[disabled]:opacity-50",
      className,
    )}
    {...props}
    onPointerDown={(event) => {
      onPointerDown?.(event);
      const target = event.target as HTMLElement;
      if (event.pointerType === "touch" && !target.closest("[data-slider-thumb]")) {
        // Radix überspringt seinen Handler bei `defaultPrevented` (kein Sprung zur
        // Berührungsstelle). Touch fängt den Pointer implizit am Ziel ein; ohne Freigabe würde
        // Radix' onPointerMove den Wert beim Scrollen trotzdem verschieben.
        event.preventDefault();
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      }
    }}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted-foreground/25">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      data-slider-thumb=""
      aria-label={thumbLabel}
      className={cn(
        "relative block h-5 w-5 touch-none rounded-full border-2 border-primary bg-background shadow-sm transition-transform",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-110",
        // Größere unsichtbare Greiffläche für Finger (44 px).
        "before:absolute before:-inset-3 before:content-['']",
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
