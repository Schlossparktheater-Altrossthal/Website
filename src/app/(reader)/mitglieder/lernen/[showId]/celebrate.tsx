"use client";

import * as React from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";

import { CheckIcon, TrophyIcon } from "@/components/ui/action-icons";
import type { LearnRating } from "@/lib/skript/learn/schedule";
import { cn } from "@/lib/utils";

/** Belohnungen im Lernmodus (docs/Plan/lernmodus-plan.md, Runde 2): kurz, sparsam, abschaltbar. */

/** Kurzes Vibrieren (Android); iOS ignoriert es. */
export function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined") navigator.vibrate?.(pattern);
}

/** Zahl, die beim Erscheinen hochzählt. */
export function CountUp({
  value,
  format = (current) => String(Math.round(current)),
  className,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(reduced ? value : 0);
  React.useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: setShown });
    return () => controls.stop();
  }, [value, reduced]);
  return <span className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

const FLASH_STYLE: Record<LearnRating, string> = {
  1: "bg-destructive text-destructive-foreground",
  2: "bg-success text-success-foreground",
  3: "bg-success text-success-foreground",
  4: "bg-success text-success-foreground",
};

/**
 * Rückmeldung nach jeder Stelle: Häkchen steigt kurz auf (gewusst) bzw. dezente Farbe (Nochmal).
 * `token` wechselt bei jeder Bewertung.
 */
export function RatingFlash({ token, rating }: { token: number; rating: LearnRating | null }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center"
      aria-hidden
    >
      <AnimatePresence>
        {rating ? (
          <motion.span
            key={token}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full shadow-lg",
              FLASH_STYLE[rating],
            )}
          >
            {rating >= 2 ? (
              <CheckIcon className="h-6 w-6" />
            ) : (
              <span className="text-lg font-bold">↻</span>
            )}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Wer `RatingFlash` nutzt: `show(rating)` löst die Rückmeldung aus, sie verschwindet selbst. */
export function useRatingFlash() {
  const [state, setState] = React.useState<{ token: number; rating: LearnRating | null }>({
    token: 0,
    rating: null,
  });
  React.useEffect(() => {
    if (!state.rating) return;
    const timer = window.setTimeout(
      () => setState((current) => ({ ...current, rating: null })),
      650,
    );
    return () => window.clearTimeout(timer);
  }, [state]);
  const show = React.useCallback((rating: LearnRating) => {
    setState((current) => ({ token: current.token + 1, rating }));
    buzz(rating >= 2 ? 12 : [8, 40, 8]);
  }, []);
  return { ...state, show };
}

/**
 * Feier, wenn eine Szene sitzt: Vorhang geht auf, Pokal, Titel. Schließt nach kurzer Zeit oder
 * per Tippen; bei reduzierter Bewegung nur ein Einblenden.
 */
export function Celebration({
  title,
  description,
  onDone,
}: {
  title: string;
  description: string;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  React.useEffect(() => {
    buzz([20, 60, 20, 60, 40]);
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      data-testid="lernen-feier"
    >
      {reduced ? null : (
        <>
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-primary"
            initial={{ x: 0 }}
            animate={{ x: "-100%" }}
            transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: 0.15 }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-primary"
            initial={{ x: 0 }}
            animate={{ x: "100%" }}
            transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: 0.15 }}
          />
        </>
      )}
      <motion.div
        className="relative px-6 text-center"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.55, type: "spring", stiffness: 260, damping: 18 }}
      >
        <TrophyIcon className="mx-auto h-14 w-14 text-success" aria-hidden />
        <p className="mt-3 text-2xl font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </motion.div>
    </motion.div>
  );
}
