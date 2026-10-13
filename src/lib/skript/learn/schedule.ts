import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade,
} from "ts-fsrs";

/** Planung mit FSRS (docs/Plan/lernmodus-plan.md); läuft gleich auf Client und Server. */

export type LearnRating = 1 | 2 | 3 | 4;

export const RATING_LABEL: Record<LearnRating, string> = {
  1: "Nochmal",
  2: "Schwer",
  3: "Gut",
  4: "Leicht",
};

/** Gespeicherter FSRS-Zustand eines Abschnitts (wie ScriptLearnCard, Daten als ISO-Text). */
export type CardState = {
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
};

const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: true }),
);

function toCard(state: CardState | null, now: Date): Card {
  if (!state) return createEmptyCard(now);
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

function fromCard(card: Card): CardState {
  return {
    state: card.state,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function applyRating(state: CardState | null, rating: LearnRating, at: Date): CardState {
  return fromCard(scheduler.next(toCard(state, at), at, rating as Grade).card);
}

/** Nächster Abstand je Bewertung (für die Knöpfe der Abfrage). */
export function previewIntervals(state: CardState | null, now: Date) {
  const preview = scheduler.repeat(toCard(state, now), now);
  const result = {} as Record<LearnRating, number>;
  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    result[rating as LearnRating] = preview[rating].card.due.getTime() - now.getTime();
  }
  return result;
}

export function formatInterval(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} T`;
  return `${Math.round(days / 30)} Mon`;
}

/**
 * Bewertung aus dem Verhalten (L6): Halten/alles aufgedeckt → Nochmal, ein Teil → Schwer,
 * nichts → Gut. „Leicht“ gibt es nur von Hand.
 */
export function autoRating(revealed: number, total: number, wholeRevealed: boolean): LearnRating {
  if (wholeRevealed || (total > 0 && revealed / total >= 0.5)) return 1;
  if (revealed > 0) return 2;
  return 3;
}

export type Stage = "full" | "cloze" | "initials" | "hidden";

export const STAGE_LABEL: Record<Stage, string> = {
  full: "Volltext",
  cloze: "Lücken",
  initials: "Anfangsbuchstaben",
  hidden: "Verdeckt",
};

/** Ab dieser Stabilität (Tage) gilt ein Abschnitt als „sitzt“. */
export const SOLID_DAYS = 7;

/** Stufe im Automatik-Modus: neu → Lücken, < 3 Tage → Anfangsbuchstaben, sonst verdeckt. */
export function autoStage(state: CardState | null, changed: boolean): Stage {
  if (!state || changed || state.state === State.New) return "cloze";
  if (state.state === State.Relearning || state.stability < 3) return "initials";
  return "hidden";
}

export type Progress = "new" | "learning" | "solid";

export function progressOf(state: CardState | null, changed: boolean): Progress {
  if (!state || state.state === State.New) return "new";
  if (changed || state.state !== State.Review || state.stability < SOLID_DAYS) return "learning";
  return "solid";
}
