/**
 * Folgen-Steuerung im Leser (docs/Plan/skript-mitlesen-plan.md, „Verhalten im Leser“): eigenes
 * Scrollen pausiert sofort; zurück geht es per Tipp, nach Ruhe in der Nähe der Live-Stelle oder
 * wenn die Live-Stelle eine vorausgeblätterte Person einholt. Reine Logik, ohne DOM.
 */

export type FollowState =
  | { mode: "following" }
  | {
      mode: "paused";
      /** Zeitpunkt der letzten eigenen Scroll-Bewegung. */
      lastInput: number;
      /** Stand die Person beim Wegscrollen vor der Live-Stelle (eigene Stelle ansehen)? */
      ahead: boolean;
    };

export type FollowOptions = {
  /** Ruhe, nach der in der Nähe wieder gefolgt wird. */
  resumeIdleMs: number;
  /** „In der Nähe“ in Achsen-Zeichen. */
  nearDistance: number;
  /**
   * Lesetempo allein: eigenes Scrollen korrigiert die Stelle – nach der Ruhe geht es an der
   * eigenen Position weiter, egal wie weit weg.
   */
  correctOnScroll: boolean;
};

export const LIVE_FOLLOW: FollowOptions = {
  resumeIdleMs: 8000,
  nearDistance: 600,
  correctOnScroll: false,
};

export const SOLO_TEMPO: FollowOptions = {
  resumeIdleMs: 2000,
  nearDistance: Infinity,
  correctOnScroll: true,
};

export const FOLLOWING: FollowState = { mode: "following" };

export function userInput(
  now: number,
  userPos: number,
  livePos: number,
  options: FollowOptions,
): FollowState {
  return { mode: "paused", lastInput: now, ahead: userPos > livePos + options.nearDistance };
}

export type ResumeDecision = { resume: false } | { resume: true; reanchor: boolean };

/** Prüft regelmäßig (je Frame), ob wieder gefolgt wird. */
export function checkResume(
  state: FollowState,
  now: number,
  userPos: number,
  livePos: number,
  options: FollowOptions,
): ResumeDecision {
  if (state.mode !== "paused") return { resume: false };
  const idle = now - state.lastInput >= options.resumeIdleMs;
  if (options.correctOnScroll) return idle ? { resume: true, reanchor: true } : { resume: false };
  // Vorausgeblättert: warten, bis die Live-Stelle die eigene Stelle erreicht.
  if (state.ahead) {
    return idle && livePos >= userPos ? { resume: true, reanchor: false } : { resume: false };
  }
  if (idle && Math.abs(userPos - livePos) <= options.nearDistance) {
    return { resume: true, reanchor: false };
  }
  return { resume: false };
}

/** Wie weit ein Frame die Ansicht bewegt: sanft, aber mindestens 1 px, große Sprünge sofort. */
export function scrollStep(delta: number, dtSeconds: number, viewport: number): number {
  const distance = Math.abs(delta);
  if (distance < 1) return 0;
  if (distance > viewport * 1.5) return delta;
  const step = Math.max(1, distance * Math.min(1, dtSeconds * 4));
  return Math.sign(delta) * Math.min(distance, step);
}
