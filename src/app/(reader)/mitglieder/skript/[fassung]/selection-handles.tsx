"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { wordRefAt, type WordRef } from "./use-word-drag";

/**
 * Anfasser an Anfang und Ende der Auswahl im Notizmodus (docs/Plan/skript-notizen-plan.md):
 * wie die gewohnte Textauswahl am Handy, nur ohne System-Menü. Die Griffe beanspruchen die
 * Berührung für sich (`touch-action: none`), Wischen daneben scrollt weiter.
 */

type Edge = "start" | "end";
type Point = { x: number; y: number; height: number };

function edges(): { start: Point; end: Point } | null {
  const marks = [...document.querySelectorAll("[data-note-selection]")];
  if (!marks.length) return null;
  const first = marks[0].getClientRects()[0];
  const lastRects = marks[marks.length - 1].getClientRects();
  const last = lastRects[lastRects.length - 1];
  if (!first || !last) return null;
  return {
    start: { x: first.left, y: first.bottom, height: first.height },
    end: { x: last.right, y: last.bottom, height: last.height },
  };
}

export function SelectionHandles({
  /** Ändert sich bei jeder neuen Auswahl – dann neu messen. */
  selectionKey,
  onMove,
}: {
  selectionKey: string | null;
  onMove: (edge: Edge, word: WordRef) => void;
}) {
  const [points, setPoints] = React.useState<{ start: Point; end: Point } | null>(null);
  const dragging = React.useRef<Edge | null>(null);
  /** Abstand Finger → Zeilenmitte beim Anfassen; gesucht wird immer auf Zeilenhöhe. */
  const reach = React.useRef(0);

  React.useLayoutEffect(() => {
    if (!selectionKey) {
      setPoints(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      setPoints(edges());
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [selectionKey]);

  if (!points || typeof document === "undefined") return null;

  const handle = (edge: Edge, point: Point) => (
    <span
      key={edge}
      role="presentation"
      data-selection-handle={edge}
      className="fixed z-40 flex h-11 w-11 -translate-x-1/2 touch-none items-start justify-center"
      style={{ left: point.x, top: point.y }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = edge;
        reach.current = event.clientY - (point.y - point.height / 2);
      }}
      onPointerMove={(event) => {
        if (dragging.current !== edge) return;
        const word = wordRefAt(event.clientX, event.clientY - reach.current);
        if (word) onMove(edge, word);
      }}
      onPointerUp={() => {
        dragging.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        className={cn("block h-4 w-4 rounded-full bg-primary shadow-sm ring-2 ring-background")}
      />
    </span>
  );

  return createPortal(
    <>
      {handle("start", points.start)}
      {handle("end", points.end)}
    </>,
    document.body,
  );
}
