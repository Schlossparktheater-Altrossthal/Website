"use client";

import * as React from "react";

/**
 * Notizmodus: Wörter durch Ziehen auswählen (docs/Plan/skript-notizen-plan.md, Schritt 2).
 * Maus und Stift ziehen sofort; der Finger hält kurz und zieht dann – wie bei der gewohnten
 * Textmarkierung, ohne dass normales Wischen das Scrollen verliert.
 */

const HOLD_MS = 280;
/** Bewegung während des Haltens, ab der es als Scrollen gilt. */
const SLOP_PX = 10;

/** Wort als Daten – React baut die Elemente beim Markieren neu, ein Element veraltet also. */
export type WordRef = { blockId: string; partIndex: number; offset: number };

function wordRef(element: Element | null | undefined): WordRef | null {
  const word = element?.closest("[data-w]");
  const blockId = word?.closest("[data-block]")?.getAttribute("data-block");
  const part = word?.closest("[data-part]")?.getAttribute("data-part");
  if (!word || !blockId || part === null || part === undefined) return null;
  return { blockId, partIndex: Number(part), offset: Number(word.getAttribute("data-w")) };
}

/** Wort unter einem Bildschirmpunkt. */
export function wordRefAt(x: number, y: number) {
  return wordRef(document.elementFromPoint(x, y));
}

const same = (a: WordRef | null, b: WordRef | null) =>
  !!a && !!b && a.blockId === b.blockId && a.partIndex === b.partIndex && a.offset === b.offset;

export function useWordDrag(
  root: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  /** Ziehen begonnen bzw. fortgesetzt: Auswahl vom Start- bis zum aktuellen Wort. */
  onDrag: (from: WordRef, to: WordRef) => void,
) {
  const onDragRef = React.useRef(onDrag);
  React.useEffect(() => {
    onDragRef.current = onDrag;
  }, [onDrag]);
  /** Nach einem Ziehen den folgenden Klick verschlucken (sonst würde er die Auswahl ändern). */
  const suppressClick = React.useRef(false);

  React.useEffect(() => {
    const element = root.current;
    if (!enabled || !element) return;
    let anchor: WordRef | null = null;
    let last: WordRef | null = null;
    let active = false;
    let timer = 0;
    let startX = 0;
    let startY = 0;

    const move = (x: number, y: number) => {
      const word = wordRefAt(x, y);
      if (!anchor || !word || same(word, last)) return;
      last = word;
      onDragRef.current(anchor, word);
    };
    const begin = () => {
      if (!anchor) return;
      active = true;
      suppressClick.current = true;
      last = anchor;
      navigator.vibrate?.(8);
      onDragRef.current(anchor, anchor);
    };
    const reset = () => {
      window.clearTimeout(timer);
      anchor = null;
      last = null;
      active = false;
    };

    // Finger: halten, dann ziehen.
    const onTouchStart = (event: TouchEvent) => {
      // Nach langem Halten feuert oft kein Klick – Sperre spätestens hier aufheben.
      suppressClick.current = false;
      reset();
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const target = wordRef(event.target instanceof Element ? event.target : null);
      if (!target) return;
      anchor = target;
      startX = touch.clientX;
      startY = touch.clientY;
      timer = window.setTimeout(begin, HOLD_MS);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!anchor || !touch) return;
      if (!active) {
        if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > SLOP_PX) reset();
        return;
      }
      event.preventDefault();
      move(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => reset();

    // Maus und Stift: sofort ziehen.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      suppressClick.current = false;
      reset();
      const target = wordRef(event.target instanceof Element ? event.target : null);
      if (!target) return;
      anchor = target;
      startX = event.clientX;
      startY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !anchor) return;
      if (!active) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) <= SLOP_PX / 2) return;
        begin();
      }
      move(event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch") reset();
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    // Am Dokument: Touch-Ereignisse gehen an das Startelement, das React beim Markieren ersetzt.
    // Nicht passiv: während des Ziehens darf die Seite nicht scrollen.
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      reset();
      element.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [enabled, root]);

  /** Im Klick-Handler aufrufen: true, wenn der Klick zum Ziehen gehörte. */
  return React.useCallback(() => {
    const suppressed = suppressClick.current;
    suppressClick.current = false;
    return suppressed;
  }, []);
}
