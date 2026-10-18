"use client";

import * as React from "react";

import { fromAxis, toAxis, type LiveAxis } from "@/lib/skript/live/axis";
import {
  FOLLOWING,
  checkResume,
  scrollStep,
  userInput,
  type FollowOptions,
  type FollowState,
} from "@/lib/skript/live/follow";
import { advance } from "@/lib/skript/live/tempo";

/**
 * Leser folgt einer Live-Stelle (docs/Plan/skript-mitlesen-plan.md, Phase 1). Die Quelle liefert
 * je Frame eine Achsen-Position: heute das Lesetempo, später Person bzw. Schätzung im Raum.
 */
export type LiveSource = {
  /** Aktuelle Live-Stelle (Achsen-Zeichen). */
  position: (now: number) => number;
  /** Eigene Stelle übernehmen (Lesetempo: Korrektur durch Scrollen). */
  reanchor: (position: number) => void;
};

/** Lesezeile: Anteil der Höhe zwischen Kopfleiste und unterer Leiste. */
export const READING_LINE = 0.35;

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export type LiveFollowStatus = {
  following: boolean;
  /** Absätze von der eigenen Stelle bis zur Live-Stelle (negativ = Live-Stelle liegt oben). */
  blocksAway: number;
  /** Lesezeile in px vom oberen Fensterrand (für die Markierung). */
  lineY: number;
};

export function useLiveFollow({
  enabled,
  suspended,
  axis,
  refs,
  topRef,
  bottomRef,
  source,
  options,
}: {
  enabled: boolean;
  /** Bearbeiten/Notieren: nicht scrollen, danach wie nach eigenem Scrollen weiter. */
  suspended: boolean;
  axis: LiveAxis;
  refs: React.RefObject<(HTMLElement | null)[]>;
  topRef: React.RefObject<HTMLElement | null>;
  bottomRef: React.RefObject<HTMLElement | null>;
  source: LiveSource;
  options: FollowOptions;
}) {
  const [status, setStatus] = React.useState<LiveFollowStatus>({
    following: true,
    blocksAway: 0,
    lineY: 0,
  });
  const state = React.useRef<FollowState>(FOLLOWING);
  const hint = React.useRef(0);
  const latest = React.useRef({ axis, source, options, suspended });
  React.useEffect(() => {
    latest.current = { axis, source, options, suspended };
  });

  const readingLine = React.useCallback(() => {
    const top = topRef.current?.getBoundingClientRect().bottom ?? 0;
    const bottom = bottomRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    return top + Math.max(0, bottom - top) * READING_LINE;
  }, [topRef, bottomRef]);

  /** Eigene Stelle: Absatz auf der Lesezeile, Suche ab dem zuletzt gefundenen. */
  const userPosition = React.useCallback(
    (lineY: number) => {
      const elements = refs.current ?? [];
      const count = elements.length;
      if (!count) return 0;
      const rectAt = (index: number) => elements[index]?.getBoundingClientRect() ?? null;
      let index = Math.min(Math.max(hint.current, 0), count - 1);
      // Nach oben, solange der Absatz unter der Lesezeile beginnt.
      while (index > 0) {
        const rect = rectAt(index);
        if (rect && rect.height > 0 && rect.top <= lineY) break;
        index -= 1;
      }
      // Nach unten, solange der nächste sichtbare Absatz noch über der Lesezeile beginnt.
      for (let next = index + 1; next < count; next += 1) {
        const rect = rectAt(next);
        if (!rect || rect.height === 0) continue;
        if (rect.top > lineY) break;
        index = next;
      }
      hint.current = index;
      const rect = rectAt(index);
      const fraction = rect && rect.height > 0 ? (lineY - rect.top) / rect.height : 0;
      return toAxis(latest.current.axis, { index, fraction });
    },
    [refs],
  );

  /** Bildschirm-Y einer Achsen-Position (ausgeblendete Absätze: nächster sichtbarer). */
  const screenY = React.useCallback(
    (position: number) => {
      const elements = refs.current ?? [];
      const point = fromAxis(latest.current.axis, position);
      for (let index = point.index; index < elements.length; index += 1) {
        const rect = elements[index]?.getBoundingClientRect();
        if (!rect || rect.height === 0) continue;
        return index === point.index ? rect.top + rect.height * point.fraction : rect.top;
      }
      return null;
    },
    [refs],
  );

  const interrupt = React.useCallback(() => {
    const { source: current, options: opts } = latest.current;
    const now = performance.now();
    const lineY = readingLine();
    state.current = userInput(now, userPosition(lineY), current.position(now), opts);
  }, [readingLine, userPosition]);

  const resume = React.useCallback(() => {
    state.current = FOLLOWING;
  }, []);

  /** Ab der eigenen Stelle weiter (Lesetempo „Hier weiterlesen“, Start). */
  const startHere = React.useCallback(() => {
    latest.current.source.reanchor(userPosition(readingLine()));
    state.current = FOLLOWING;
  }, [readingLine, userPosition]);

  React.useEffect(() => {
    if (!enabled) return;
    state.current = FOLLOWING;
    // Scrollen in Seitenleiste oder Dialogen bewegt die Seite nicht.
    const onInput = (event: Event) => {
      if (!insideOwnScroller(event.target)) interrupt();
    };
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && !isEditable(event.target)) interrupt();
    };
    // Klick auf die Scrollleiste landet auf <html>.
    const onMouse = (event: MouseEvent) => {
      if (event.target === document.documentElement) interrupt();
    };
    window.addEventListener("wheel", onInput, { passive: true });
    window.addEventListener("touchmove", onInput, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouse);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const { source: current, options: opts, suspended: hold } = latest.current;
      const lineY = readingLine();
      const live = current.position(now);
      const user = userPosition(lineY);
      if (hold) {
        state.current = userInput(now, user, live, opts);
      } else {
        const decision = checkResume(state.current, now, user, live, opts);
        if (decision.resume) {
          if (decision.reanchor) current.reanchor(user);
          state.current = FOLLOWING;
        }
      }
      const following = state.current.mode === "following";
      const target = following ? screenY(current.position(now)) : null;
      if (target !== null) {
        const step = scrollStep(target - lineY, dt, window.innerHeight);
        if (step) window.scrollBy({ top: step, behavior: "instant" });
      }
      const axisNow = latest.current.axis;
      const blocksAway = fromAxis(axisNow, live).index - fromAxis(axisNow, user).index;
      setStatus((prev) =>
        prev.following === following &&
        prev.blocksAway === blocksAway &&
        Math.abs(prev.lineY - lineY) < 1
          ? prev
          : { following, blocksAway, lineY },
      );
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("touchmove", onInput);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouse);
    };
  }, [enabled, interrupt, readingLine, screenY, userPosition]);

  return { status, interrupt, resume, startHere };
}

function insideOwnScroller(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("aside, [role='dialog']");
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Lesetempo allein (E9): die Stelle läuft mit dem Sprechtempo je Szene × Faktor weiter, solange
 * `running`. Kein Raum, kein Netz nötig.
 */
export function useTempoSource(
  axis: LiveAxis,
  rates: number[],
  factor: number,
  running: boolean,
): LiveSource {
  const position = React.useRef(0);
  const last = React.useRef<number | null>(null);
  const params = React.useRef({ axis, rates, factor, running });
  React.useEffect(() => {
    params.current = { axis, rates, factor, running };
    if (!running) last.current = null;
  });
  return React.useMemo<LiveSource>(
    () => ({
      position: (now) => {
        const { axis: a, rates: r, factor: f, running: on } = params.current;
        if (on && last.current !== null) {
          position.current = advance(a, r, position.current, (now - last.current) / 1000, f);
        }
        last.current = on ? now : null;
        return position.current;
      },
      reanchor: (value) => {
        position.current = value;
        last.current = params.current.running ? performance.now() : null;
      },
    }),
    [],
  );
}
